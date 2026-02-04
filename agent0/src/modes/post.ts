import { output } from '../ui/output.js';
import { runPostWithToolCalling } from '../agent-runner.js';

/**
 * Run post mode - write and publish a new post using LLM tool calling
 */
export async function runPostMode(
  skillName: string,
  content: string
): Promise<void> {
  if (!content.trim()) {
    output.error('Post content/instruction is required');
    output.info('Example: "Write a post about AI tools in r/chatgptpro"');
    return;
  }

  output.info(`Creating post: ${content.substring(0, 50)}...`);

  try {
    // Run the agentic loop - LLM handles the workflow
    await runPostWithToolCalling(skillName, content);

  } catch (error) {
    output.error(`Post mode failed: ${error}`);
  }
}
