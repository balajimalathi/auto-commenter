import { readFile, writeFile, appendFile, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import * as browser from './browser.js';
import type { Skill } from './skill-loader.js';

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
        description: 'Read contents of a file. Use for skill instructions (SKILL.md), tracking data, personalization, subreddit rules, product info, or memory. Paths are relative to project root.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path relative to project root (e.g. .claude/skills/reddit-commenter/SKILL.md, tracking/reddit/2026-02-04.md)',
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
        name: 'browser_navigate',
        description: 'Navigate the browser to a URL. Use for Reddit pages (subreddits, posts, inbox).',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'Full URL to navigate to (e.g. https://www.reddit.com/r/chatgptpro/new/)',
            },
          },
          required: ['url'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'browser_snapshot',
        description: 'Get the page structure (accessibility tree). Use to understand page layout before clicking or typing.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'browser_get_text',
        description: 'Get the visible text content of the current page. Use to read post content, comments, or page content.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'browser_extract_posts',
        description: 'Extract Reddit posts from the current page. Returns title, url, author, subreddit for each post.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'browser_click',
        description: 'Click an element. Provide a brief description or selector. Use after browser_snapshot to identify elements.',
        parameters: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector or element description (e.g. button[type="submit"], textarea, .comment-box)',
            },
          },
          required: ['selector'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'browser_type',
        description: 'Type text into an input element. Use for comment box, search, etc.',
        parameters: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector for the input (e.g. textarea, div[contenteditable="true"])',
            },
            text: {
              type: 'string',
              description: 'Text to type',
            },
          },
          required: ['selector', 'text'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'browser_scroll',
        description: 'Scroll the page down to load more content.',
        parameters: {
          type: 'object',
          properties: {
            pixels: {
              type: 'string',
              description: 'Pixels to scroll (default 500)',
            },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'browser_current_url',
        description: 'Get the current page URL.',
        parameters: {
          type: 'object',
          properties: {},
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

      case 'browser_navigate': {
        const url = args.url as string;
        await browser.navigate(url);
        return JSON.stringify({ success: true, url });
      }

      case 'browser_snapshot': {
        const snapshot = await browser.getAccessibilityTree();
        return snapshot.length > 4000 ? snapshot.substring(0, 4000) + '\n...[truncated]' : snapshot;
      }

      case 'browser_get_text': {
        const text = await browser.getTextContent();
        return text.length > 8000 ? text.substring(0, 8000) + '\n...[truncated]' : text;
      }

      case 'browser_extract_posts': {
        const posts = await browser.extractRedditPosts();
        return JSON.stringify(posts, null, 2);
      }

      case 'browser_click': {
        const selector = args.selector as string;
        await browser.click(selector);
        return JSON.stringify({ success: true });
      }

      case 'browser_type': {
        const selector = args.selector as string;
        const text = args.text as string;
        await browser.type(selector, text);
        return JSON.stringify({ success: true });
      }

      case 'browser_scroll': {
        const pixels = parseInt(String(args.pixels || 500), 10);
        await browser.scrollDown(pixels);
        return JSON.stringify({ success: true });
      }

      case 'browser_current_url': {
        const url = await browser.getCurrentUrl();
        return JSON.stringify({ url });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return JSON.stringify({ error: message });
  }
}
