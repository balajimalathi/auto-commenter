import { readFile, writeFile, appendFile, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import * as browser from './browser.js';
import type { Skill } from './skill-loader.js';
import { output } from './ui/output.js';

export type ToolContext = {
  skill?: Skill;
  projectRoot: string;
};

// OpenAI-compatible tool definition format
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string; items?: { type: string } }>;
      required?: string[];
    };
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

/**
 * Tool definitions for LLM tool calling
 */
export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read contents of a file. Use for skill instructions, tracking data, personalization, subreddit rules, product info, or memory. Paths are relative to project root. Resources are inside .claude/skills/<skill>/resources/.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path relative to project root. Examples: .claude/skills/reddit-commenter/SKILL.md, .claude/skills/reddit-commenter/resources/subreddits.md, .claude/skills/reddit-commenter/resources/personalization_reddit.md, tracking/reddit/2026-02-05.md, .claude/skills/reddit-commenter/memory.md',
            },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Write or overwrite a file. Use to update tracking files, leads, or create new files. Paths are relative to project root.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path relative to project root',
            },
            content: {
              type: 'string',
              description: 'Content to write to the file',
            },
          },
          required: ['path', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'append_file',
        description: 'Append content to a file. Use for memory.md, tracking logs, or leads. Paths are relative to project root.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path relative to project root',
            },
            content: {
              type: 'string',
              description: 'Content to append',
            },
          },
          required: ['path', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_dir',
        description: 'List files and directories. Use to discover available skills or files in a directory.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path relative to project root (e.g. .claude/skills, tracking/reddit)',
            },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'playwriter_execute',
        description:
          'Execute Playwriter/Playwright JavaScript in the browser. Scope: page, state, context, accessibilitySnapshot, getCDPSession, etc. Use semicolons for multi-statement scripts. Return values via return statement or JSON.stringify. Examples: await page.goto(url), await page.locator(sel).click(), await accessibilitySnapshot({ page })',
        parameters: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'JavaScript code to run in the browser',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds (default 30000)',
            },
          },
          required: ['code'],
        },
      },
    },
  ];
}

/**
 * Execute a tool call and return the result
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const root = ctx.projectRoot;

  try {
    switch (name) {
      case 'read_file': {
        const path = args.path as string;
        const fullPath = join(root, path);
        if (!fullPath.startsWith(root)) {
          return JSON.stringify({ error: 'Path outside project root' });
        }
        if (!existsSync(fullPath)) {
          return JSON.stringify({ error: `File not found: ${path}` });
        }
        const content = await readFile(fullPath, 'utf-8');
        return content;
      }

      case 'write_file': {
        const path = args.path as string;
        const content = args.content as string;
        const fullPath = join(root, path);
        if (!fullPath.startsWith(root)) {
          return JSON.stringify({ error: 'Path outside project root' });
        }
        await writeFile(fullPath, content, 'utf-8');
        return JSON.stringify({ success: true, path });
      }

      case 'append_file': {
        const path = args.path as string;
        const content = args.content as string;
        const fullPath = join(root, path);
        if (!fullPath.startsWith(root)) {
          return JSON.stringify({ error: 'Path outside project root' });
        }
        await appendFile(fullPath, content, 'utf-8');
        return JSON.stringify({ success: true, path });
      }

      case 'list_dir': {
        const path = args.path as string;
        const fullPath = join(root, path);
        if (!fullPath.startsWith(root)) {
          return JSON.stringify({ error: 'Path outside project root' });
        }
        if (!existsSync(fullPath)) {
          return JSON.stringify({ error: `Directory not found: ${path}` });
        }
        const entries = await readdir(fullPath, { withFileTypes: true });
        const result = entries.map(e => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : 'file',
        }));
        return JSON.stringify(result, null, 2);
      }

      case 'playwriter_execute': {
        const code = args.code as string;
        const timeout = (args.timeout as number) ?? 30000;
        const result = await browser.executeScript(code, timeout);
        if (result.isError) {
          return JSON.stringify({ error: result.text });
        }
        return result.text;
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    output.error(`Tool "${name}" failed: ${message}`);
    return JSON.stringify({ error: message });
  }
}
