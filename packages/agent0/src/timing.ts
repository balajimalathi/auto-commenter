import { output } from './ui/output.js';
import { countdown } from './ui/progress.js';

export interface TimingConfig {
  betweenCommentsMin: number;
  betweenCommentsMax: number;
  betweenSubredditsMin: number;
  betweenSubredditsMax: number;
  scrollDelay: number;
  actionDelay: number;
}

/**
 * Get timing configuration from environment
 */
export function getTimingConfig(): TimingConfig {
  return {
    betweenCommentsMin: parseInt(
      process.env.AGENT0_DELAY_BETWEEN_COMMENTS_MIN || '0',
      10
    ),
    betweenCommentsMax: parseInt(
      process.env.AGENT0_DELAY_BETWEEN_COMMENTS_MAX || '120000',
      10
    ),
    betweenSubredditsMin: parseInt(
      process.env.AGENT0_DELAY_BETWEEN_SUBREDDITS_MIN || '300000',
      10
    ),
    betweenSubredditsMax: parseInt(
      process.env.AGENT0_DELAY_BETWEEN_SUBREDDITS_MAX || '900000',
      10
    ),
    scrollDelay: 2000, // 2 seconds between scrolls
    actionDelay: 1000, // 1 second between browser actions
  };
}

/**
 * Generate a random delay between min and max (in ms)
 */
export function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Wait for a random duration between min and max
 */
export async function waitRandom(
  minMs: number,
  maxMs: number,
  showMessage = true
): Promise<void> {
  const delay = randomDelay(minMs, maxMs);
  
  if (showMessage && delay > 5000) {
    const seconds = Math.ceil(delay / 1000);
    await countdown(seconds, 'Waiting');
  } else {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

/**
 * Wait between comments (0-2 minutes)
 */
export async function waitBetweenComments(): Promise<void> {
  const config = getTimingConfig();
  const delay = randomDelay(config.betweenCommentsMin, config.betweenCommentsMax);
  
  if (delay > 5000) {
    output.dim(`Waiting ${Math.ceil(delay / 1000)}s before next comment...`);
    await countdown(Math.ceil(delay / 1000), 'Cooldown');
  } else if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

/**
 * Wait between subreddits (5-15 minutes)
 */
export async function waitBetweenSubreddits(): Promise<void> {
  const config = getTimingConfig();
  const delay = randomDelay(config.betweenSubredditsMin, config.betweenSubredditsMax);
  const seconds = Math.ceil(delay / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  output.info(`Waiting ${minutes}m ${remainingSeconds}s before next subreddit...`);
  await countdown(seconds, 'Subreddit cooldown');
}

/**
 * Short delay for scroll actions
 */
export async function waitForScroll(): Promise<void> {
  const config = getTimingConfig();
  const delay = randomDelay(1000, config.scrollDelay);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Short delay between browser actions
 */
export async function waitForAction(): Promise<void> {
  const config = getTimingConfig();
  const delay = randomDelay(500, config.actionDelay);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Estimate batch completion time
 */
export function estimateBatchTime(
  remainingComments: number,
  remainingSubreddits: number
): string {
  const config = getTimingConfig();
  
  // Average comment time (including analysis, generation, posting)
  const avgCommentTime = 30000; // 30 seconds
  
  // Average delay between comments
  const avgCommentDelay = (config.betweenCommentsMin + config.betweenCommentsMax) / 2;
  
  // Average delay between subreddits
  const avgSubredditDelay = (config.betweenSubredditsMin + config.betweenSubredditsMax) / 2;
  
  const totalCommentTime = remainingComments * (avgCommentTime + avgCommentDelay);
  const totalSubredditDelay = remainingSubreddits * avgSubredditDelay;
  
  const totalMs = totalCommentTime + totalSubredditDelay;
  
  return formatDuration(totalMs);
}
