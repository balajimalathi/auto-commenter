import { output } from '../ui/output.js';
import { runTrendingWithToolCalling } from '../agent-runner.js';

/**
 * Run trending mode - find trending posts for inspiration using LLM tool calling
 */
export async function runTrendingMode(
  skillName: string,
  targetSubreddit?: string
): Promise<void> {
  if (targetSubreddit) {
    output.info(`Finding trending posts in r/${targetSubreddit}...`);
  } else {
    output.info('Finding trending posts across configured subreddits...');
  }

  try {
    // Run the agentic loop - LLM handles the workflow
    await runTrendingWithToolCalling(skillName, targetSubreddit);

  } catch (error) {
    output.error(`Trending mode failed: ${error}`);
  }
}
