/**
 * MCP client that connects to playwriter MCP server and forwards execute/reset calls.
 * Playwriter controls the browser via the extension relay (port 19988).
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Monorepo root (parent of packages/) */
function getMonorepoRoot(): string {
  const agent0Root = path.resolve(__dirname, '..'); // packages/agent0
  return path.resolve(agent0Root, '..', '..'); // repo root
}

let client: Client | null = null;
let transport: StdioClientTransport | null = null;

export interface ExecuteResult {
  text: string;
  isError?: boolean;
}

/**
 * Connect to playwriter MCP server. Spawns the server as subprocess and connects via stdio.
 * Playwriter MCP will ensure the relay is running and wait for extension connection.
 */
export async function connect(): Promise<void> {
  if (client) {
    return;
  }

  const monorepoRoot = getMonorepoRoot();
  transport = new StdioClientTransport({
    command: 'pnpm',
    args: ['--filter', 'playwriter', 'run', 'mcp'],
    cwd: monorepoRoot,
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

  const result = await client.callTool({
    name: 'execute',
    arguments: { code, timeout },
  });

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
