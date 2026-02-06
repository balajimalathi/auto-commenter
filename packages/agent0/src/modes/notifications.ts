import { output } from '../ui/output.js';
import { runNotificationsWithToolCalling } from '../agent-runner.js';

/**
 * Run notifications mode - check and respond to notifications using LLM tool calling
 */
export async function runNotificationsMode(skillName: string): Promise<void> {
  // Platform will be determined by the skill, but we can show a generic message
  output.info('Checking notifications...');

  try {
    // Run the agentic loop - LLM handles the workflow
    await runNotificationsWithToolCalling(skillName);

  } catch (error) {
    output.error(`Notifications mode failed: ${error}`);
  }
}
