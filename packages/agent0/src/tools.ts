import { readFile, writeFile, appendFile, readdir } from 'fs/promises';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import * as browser from './browser.js';
import type { Skill } from './skill-loader.js';
import { output } from './ui/output.js';
import { logToolCall, logToolResult, logPlaywriterError } from './logger.js';

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
        description: 'Read contents of a file. Use for skill instructions, tracking data, personalization, target rules, product info, or memory. Paths are relative to project root. Resources are inside .claude/skills/<skill>/resources/.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path relative to project root. Examples: .claude/skills/reddit-commenter/SKILL.md, .claude/skills/reddit-commenter/resources/targets.md, .claude/skills/reddit-commenter/resources/personalization_reddit.md, tracking/reddit/2026-02-05.md, .claude/skills/reddit-commenter/memory.md, .claude/skills/twitter-commenter/resources/targets.md, .claude/skills/twitter-commenter/resources/personalization_twitter.md',
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
              description: 'Path relative to project root (e.g. .claude/skills, tracking/reddit, tracking/twitter)',
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
  const startTime = Date.now();

  // Log tool call
  logToolCall(name, args);

  try {
    let result: string;

    switch (name) {
      case 'read_file': {
        const path = args.path as string;
        const fullPath = join(root, path);
        if (!fullPath.startsWith(root)) {
          result = JSON.stringify({ error: 'Path outside project root' });
          break;
        }
        
        // If file doesn't exist and it's a tracking file, try to create from template
        if (!existsSync(fullPath) && path.startsWith('tracking/')) {
          const pathParts = path.split('/');
          if (pathParts.length === 3 && pathParts[2].match(/^\d{4}-\d{2}-\d{2}\.md$/)) {
            // It's a tracking file with date format: tracking/{platform}/YYYY-MM-DD.md
            const platform = pathParts[1];
            const templatePath = join(root, 'tracking', platform, 'template.md');
            
            if (existsSync(templatePath)) {
              let templateContent = await readFile(templatePath, 'utf-8');
              
              // Replace date placeholder with today's date
              const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
              templateContent = templateContent.replace(/\[YYYY-MM-DD\]/g, today);
              
              // Ensure tracking directory exists
              const trackingDir = join(root, 'tracking', platform);
              if (!existsSync(trackingDir)) {
                mkdirSync(trackingDir, { recursive: true });
              }
              
              // Create the tracking file
              await writeFile(fullPath, templateContent, 'utf-8');
              result = templateContent;
              break;
            }
          }
        }
        
        if (!existsSync(fullPath)) {
          result = JSON.stringify({ error: `File not found: ${path}` });
          break;
        }
        const content = await readFile(fullPath, 'utf-8');
        result = content;
        break;
      }

      case 'write_file': {
        const path = args.path as string;
        const content = args.content as string;
        const fullPath = join(root, path);
        if (!fullPath.startsWith(root)) {
          result = JSON.stringify({ error: 'Path outside project root' });
          break;
        }
        await writeFile(fullPath, content, 'utf-8');
        result = JSON.stringify({ success: true, path });
        break;
      }

      case 'append_file': {
        const path = args.path as string;
        const content = args.content as string;
        const fullPath = join(root, path);
        if (!fullPath.startsWith(root)) {
          result = JSON.stringify({ error: 'Path outside project root' });
          break;
        }
        await appendFile(fullPath, content, 'utf-8');
        result = JSON.stringify({ success: true, path });
        break;
      }

      case 'list_dir': {
        const path = args.path as string;
        const fullPath = join(root, path);
        if (!fullPath.startsWith(root)) {
          result = JSON.stringify({ error: 'Path outside project root' });
          break;
        }
        if (!existsSync(fullPath)) {
          result = JSON.stringify({ error: `Directory not found: ${path}` });
          break;
        }
        const entries = await readdir(fullPath, { withFileTypes: true });
        const dirResult = entries.map(e => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : 'file',
        }));
        result = JSON.stringify(dirResult, null, 2);
        break;
      }

      case 'playwriter_execute': {
        const code = args.code as string;
        const timeout = (args.timeout as number) ?? 30000;
        const browserResult = await browser.executeScript(code, timeout);
        if (browserResult.isError) {
          const errorMessage = browserResult.text;
          result = JSON.stringify({ error: errorMessage });
          
          // Log to dedicated playwriter error log
          const durationMs = Date.now() - startTime;
          logPlaywriterError({
            code,
            error: errorMessage,
            timeout,
            durationMs,
            skill: ctx.skill?.name,
            context: ctx.skill ? `${ctx.skill.platform}-commenter` : undefined,
          });
        } else {
          result = browserResult.text;
        }
        break;
      }

      default:
        result = JSON.stringify({ error: `Unknown tool: ${name}` });
    }

    const durationMs = Date.now() - startTime;
    
    // Check for errors in result
    let error: string | undefined;
    try {
      const parsed = JSON.parse(result);
      if (parsed.error) {
        error = parsed.error;
      }
    } catch {
      // Not JSON or no error field - that's fine
    }

    // Log tool result
    logToolResult(name, result, durationMs, error);

    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : 'Unknown error';
    output.error(`Tool "${name}" failed: ${message}`);
    
    const errorResult = JSON.stringify({ error: message });
    
    // If playwriter_execute failed, log to dedicated error log
    if (name === 'playwriter_execute') {
      const code = (args.code as string) || '';
      const timeout = (args.timeout as number) ?? 30000;
      logPlaywriterError({
        code,
        error: message,
        timeout,
        durationMs,
        skill: ctx.skill?.name,
        context: ctx.skill ? `${ctx.skill.platform}-commenter` : undefined,
      });
    }
    
    // Log tool result with error
    logToolResult(name, errorResult, durationMs, message);
    
    return errorResult;
  }
}
