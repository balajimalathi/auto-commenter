import { output } from '../ui/output.js';
import { runCommenterWithToolCalling } from '../agent-runner.js';

/**
 * Parse instruction to extract target and count for display
 * Examples:
 * - "Post 3 comments on r/nocode" (Reddit)
 * - "Write one reply on For you" (Twitter)
 * - "Comment on r/nocode" (Reddit)
 */
function parseInstruction(instruction: string): {
  target: string;
  count: number;
} {
  // Extract target - could be r/subreddit or timeline tab name
  const subredditMatch = instruction.match(/r\/(\w+)/i);
  const target = subredditMatch ? subredditMatch[1] : '';

  // Extract count
  const countMatch = instruction.match(/(\d+)\s*(?:comments?|replies?)/i);
  const oneMatch = instruction.match(/\bone\b/i);
  
  let count = 1;
  if (countMatch) {
    count = parseInt(countMatch[1], 10);
  } else if (oneMatch) {
    count = 1;
  }

  return { target, count };
}

/**
 * Run commenter mode - post specific number of comments using LLM tool calling
 */
export async function runCommenterMode(
  skillName: string,
  instruction: string
): Promise<void> {
  const { target, count } = parseInstruction(instruction);

  if (!target) {
    output.error('Could not parse target from instruction');
    output.info('Example: "Post 3 comments on r/nocode" or "Write one reply on For you"');
    return;
  }

  // Determine if it's a Reddit subreddit (starts with r/) or Twitter target
  const isSubreddit = instruction.toLowerCase().includes('r/');
  const targetLabel = isSubreddit ? `r/${target}` : target;
  const actionLabel = isSubreddit ? 'Comments' : 'Replies';
  
  output.info(`Target: ${targetLabel}`);
  output.info(`${actionLabel} to post: ${count}`);

  try {
    // Run the agentic loop - LLM handles the workflow
    await runCommenterWithToolCalling(skillName, instruction);

  } catch (error) {
    output.error(`Commenter mode failed: ${error}`);
  }
}
