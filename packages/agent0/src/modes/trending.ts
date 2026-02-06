import { output } from '../ui/output.js';
import { runTrendingWithToolCalling } from '../agent-runner.js';

/**
 * Run trending mode - find trending posts for inspiration using LLM tool calling
 */
export async function runTrendingMode(
  skillName: string,
  target?: string
): Promise<void> {
  if (target) {
    // Determine if it's a Reddit subreddit or Twitter target
    const isSubreddit = target.toLowerCase().startsWith('r/') || !target.includes(' ');
    const targetLabel = isSubreddit ? `r/${target.replace('r/', '')}` : target;
    output.info(`Finding trending content in ${targetLabel}...`);
  } else {
    output.info('Finding trending content across configured targets...');
  }

  try {
    // Run the agentic loop - LLM handles the workflow
    await runTrendingWithToolCalling(skillName, target);

  } catch (error) {
    output.error(`Trending mode failed: ${error}`);
  }
}
