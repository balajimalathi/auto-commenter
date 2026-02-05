/**
 * MCP client that connects to playwriter MCP server and forwards execute/reset calls.
 * Uses the playwriter npm package installed on the host (global or project dependency).
 * Playwriter controls the browser via the extension relay (port 19988).
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

let client: Client | null = null;
let transport: StdioClientTransport | null = null;

export interface ExecuteResult {
  text: string;
  isError?: boolean;
}

/**
 * Connect to playwriter MCP server. Spawns the host-installed playwriter as subprocess.
 * Uses `playwriter mcp` (expects playwriter in PATH from global/project install).
 */
export async function connect(): Promise<void> {
  if (client) {
    return;
  }

  transport = new StdioClientTransport({
    command: 'playwriter',
    args: ['mcp'],
    stderr: 'pipe',
    env: { ...process.env } as Record<string, string>,
  });

  client = new Client({
    name: 'agent0',
    version: '1.0.0',
  });

  await client.connect(transport);
  await client.ping();
}

/**
 * Disconnect from playwriter MCP and cleanup.
 */
export async function disconnect(): Promise<void> {
  if (client) {
    try {
      await client.close();
    } catch {
      // Ignore close errors
    }
    client = null;
  }
  transport = null;
}

/**
 * Check if connected to playwriter MCP.
 */
export function isConnected(): boolean {
  return client !== null;
}

/**
 * Call playwriter's execute tool with Playwright code.
 * Code runs in browser context with { page, state, context } in scope.
 */
export async function callExecute(code: string, timeout = 30000): Promise<ExecuteResult> {
  if (!client) {
    throw new Error('Playwriter MCP not connected. Call connect() first.');
  }

  // Pass timeout both as a tool argument (for Playwriter's VM) and as an MCP
  // request option (to prevent the MCP SDK's 60s default from killing long calls).
  const result = await client.callTool(
    { name: 'execute', arguments: { code, timeout } },
    undefined,
    { timeout: timeout + 15000 },
  );

  const content = (result as { content?: Array<{ type: string; text?: string }> }).content;
  if (result.isError) {
    const text = extractText(content);
    return { text, isError: true };
  }

  const text = extractText(content);
  return { text, isError: false };
}

/**
 * Call playwriter's reset tool to reconnect browser/context.
 */
export async function callReset(): Promise<void> {
  if (!client) {
    throw new Error('Playwriter MCP not connected. Call connect() first.');
  }

  await client.callTool({
    name: 'reset',
    arguments: {},
  });
}

function extractText(content?: Array<{ type: string; text?: string }>): string {
  const list = content ?? [];
  const textPart = list.find((c) => c.type === 'text' && c.text != null);
  return textPart && typeof textPart.text === 'string' ? textPart.text : '';
}
