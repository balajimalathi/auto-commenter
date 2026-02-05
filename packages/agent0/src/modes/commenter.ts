import { output } from '../ui/output.js';
import { runCommenterWithToolCalling } from '../agent-runner.js';

/**
 * Parse instruction to extract subreddit and count for display
 * Examples:
 * - "Post 3 comments on r/chatgptpro"
 * - "Write one comment on r/Subreddit"
 * - "Comment on r/nocode"
 */
function parseInstruction(instruction: string): {
  subreddit: string;
  count: number;
} {
  // Extract subreddit
  const subredditMatch = instruction.match(/r\/(\w+)/i);
  const subreddit = subredditMatch ? subredditMatch[1] : '';

  // Extract count
  const countMatch = instruction.match(/(\d+)\s*comments?/i);
  const oneMatch = instruction.match(/\bone\b/i);
  
  let count = 1;
  if (countMatch) {
    count = parseInt(countMatch[1], 10);
  } else if (oneMatch) {
    count = 1;
  }

  return { subreddit, count };
}

/**
 * Run commenter mode - post specific number of comments using LLM tool calling
 */
export async function runCommenterMode(
  skillName: string,
  instruction: string
): Promise<void> {
  const { subreddit, count } = parseInstruction(instruction);

  if (!subreddit) {
    output.error('Could not parse subreddit from instruction');
    output.info('Example: "Post 3 comments on r/chatgptpro"');
    return;
  }

  output.info(`Target: r/${subreddit}`);
  output.info(`Comments to post: ${count}`);

  try {
    // Run the agentic loop - LLM handles the workflow
    await runCommenterWithToolCalling(skillName, instruction);

  } catch (error) {
    output.error(`Commenter mode failed: ${error}`);
  }
}
