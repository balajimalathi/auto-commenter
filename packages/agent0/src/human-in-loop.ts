import { output } from './ui/output.js';
import { confirmWithTimeout } from './ui/prompts.js';

export interface HumanInLoopConfig {
  waitMs: number;
  autoApprove: boolean;
}

/**
 * Get human-in-the-loop configuration
 */
export function getHumanInLoopConfig(): HumanInLoopConfig {
  const waitMsEnv = process.env.HUMAN_IN_LOOP_WAIT_MS || '0';
  const waitMs = waitMsEnv === '0' ? 0 : parseInt(waitMsEnv, 10);
  
  return {
    waitMs,
    autoApprove: process.env.HUMAN_IN_LOOP_AUTO_APPROVE === 'true',
  };
}

/**
 * Request approval for a comment before posting
 */
export async function approveComment(
  comment: string,
  context: {
    subreddit: string;
    postTitle: string;
  }
): Promise<boolean> {
  const config = getHumanInLoopConfig();

  output.divider();
  output.info(`Subreddit: r/${context.subreddit}`);
  output.info(`Post: ${context.postTitle}`);
  output.comment(comment);

  const approved = await confirmWithTimeout({
    message: 'Post this comment?',
    timeoutMs: config.waitMs,
    defaultValue: config.autoApprove,
  });

  return approved;
}

/**
 * Request approval for a reply
 */
export async function approveReply(
  reply: string,
  context: {
    originalComment: string;
    username: string;
  }
): Promise<boolean> {
  const config = getHumanInLoopConfig();

  output.divider();
  output.dim(`Replying to u/${context.username}:`);
  output.dim(context.originalComment.substring(0, 200) + '...');
  output.comment(reply, 'Proposed Reply');

  const approved = await confirmWithTimeout({
    message: 'Send this reply?',
    timeoutMs: config.waitMs,
    defaultValue: config.autoApprove,
  });

  return approved;
}

/**
 * Request approval for a new post
 */
export async function approvePost(
  title: string,
  content: string,
  subreddit: string
): Promise<boolean> {
  const config = getHumanInLoopConfig();

  output.divider();
  output.info(`Creating post in r/${subreddit}`);
  output.post(title, content);

  const approved = await confirmWithTimeout({
    message: 'Create this post?',
    timeoutMs: config.waitMs,
    defaultValue: config.autoApprove,
  });

  return approved;
}

/**
 * Request approval for lead follow-up
 */
export async function approveLeadFollowUp(
  action: string,
  leadInfo: {
    username: string;
    subreddit: string;
    relevance: string;
  }
): Promise<boolean> {
  const config = getHumanInLoopConfig();

  output.divider();
  output.info(`Lead: u/${leadInfo.username} (r/${leadInfo.subreddit})`);
  output.info(`Relevance: ${leadInfo.relevance}`);
  output.dim(`Action: ${action}`);

  const approved = await confirmWithTimeout({
    message: 'Proceed with this action?',
    timeoutMs: config.waitMs,
    defaultValue: config.autoApprove,
  });

  return approved;
}

/**
 * Pause for user review (non-blocking notification)
 */
export function notifyUser(message: string): void {
  output.info(message);
  output.dim('(Continuing in background...)');
}

/**
 * Ask user for input with timeout (falls back to default)
 */
export async function promptWithTimeout(
  message: string,
  defaultValue: string,
  timeoutMs?: number
): Promise<string> {
  const config = getHumanInLoopConfig();
  const timeout = timeoutMs || config.waitMs;

  return new Promise((resolve) => {
    let resolved = false;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log(`\n(Using default: "${defaultValue}")`);
        resolve(defaultValue);
      }
    }, timeout);

    // Simple prompt
    process.stdout.write(`${message} [${defaultValue}]: `);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      process.stdin.once('data', (data) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          const input = data.toString().trim();
          resolve(input || defaultValue);
        }
      });
    }
  });
}
