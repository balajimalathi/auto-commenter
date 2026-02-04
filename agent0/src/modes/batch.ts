import { output } from '../ui/output.js';
import { loadSkill, loadTracking, parseTracking, parseSubreddits, loadResource } from '../skill-loader.js';
import { runBatchWithToolCalling } from '../agent-runner.js';

interface SubredditStatus {
  name: string;
  todayComments: number;
  dailyLimit: number;
  remaining: number;
}

/**
 * Run batch mode - fill today's quota using LLM tool calling
 */
export async function runBatchMode(skillName: string): Promise<void> {
  try {
    // Pre-load skill to show status summary
    const skill = await loadSkill(skillName);
    
    // Get subreddit configuration
    const subredditsContent = await loadResource(skill, 'subreddits');
    if (!subredditsContent) {
      output.error('No subreddits.md found');
      return;
    }

    const subreddits = parseSubreddits(subredditsContent);
    if (subreddits.length === 0) {
      output.error('No subreddits configured');
      return;
    }

    // Get current tracking status
    const trackingContent = await loadTracking(skill);
    const tracking = trackingContent ? parseTracking(trackingContent) : [];

    // Calculate status for each subreddit
    const statuses: SubredditStatus[] = subreddits.map(sub => {
      const tracked = tracking.find(t => t.subreddit === sub.name);
      const todayComments = tracked?.todayComments || 0;
      return {
        name: sub.name,
        todayComments,
        dailyLimit: sub.dailyLimit,
        remaining: Math.max(0, sub.dailyLimit - todayComments),
      };
    });

    // Calculate totals
    const totalRemaining = statuses.reduce((sum, s) => sum + s.remaining, 0);
    const totalDaily = statuses.reduce((sum, s) => sum + s.dailyLimit, 0);
    const totalCompleted = totalDaily - totalRemaining;

    if (totalRemaining === 0) {
      output.success('All quotas completed for today!');
      return;
    }

    // Show pre-run status summary
    output.divider();
    output.info(`Current quota: ${totalCompleted}/${totalDaily} (${totalRemaining} remaining)`);
    output.divider();

    output.table(statuses.map(s => ({
      Subreddit: `r/${s.name}`,
      Today: s.todayComments,
      Limit: s.dailyLimit,
      Remaining: s.remaining,
    })));

    output.divider();

    // Build tracking summary for the LLM
    const trackingSummary = statuses
      .filter(s => s.remaining > 0)
      .map(s => `r/${s.name}: ${s.todayComments}/${s.dailyLimit} (${s.remaining} remaining)`)
      .join('\n');

    // Run the agentic loop - LLM handles everything from here
    await runBatchWithToolCalling(skillName, trackingSummary);

  } catch (error) {
    output.error(`Batch mode failed: ${error}`);
  }
}
