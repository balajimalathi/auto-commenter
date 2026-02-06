import { output } from '../ui/output.js';
import { loadSkill, loadTracking, parseTracking, parseTargets, loadResource } from '../skill-loader.js';
import { runBatchWithToolCalling } from '../agent-runner.js';

interface TargetStatus {
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
    
    // Get target configuration
    const targetsContent = await loadResource(skill, 'targets');
    if (!targetsContent) {
      output.error('No targets.md found');
      return;
    }

    const targets = parseTargets(targetsContent);
    if (targets.length === 0) {
      output.error('No targets configured');
      return;
    }

    // Get current tracking status
    const trackingContent = await loadTracking(skill);
    const tracking = trackingContent ? parseTracking(trackingContent) : [];

    // Calculate status for each target
    const statuses: TargetStatus[] = targets.map(target => {
      const tracked = tracking.find(t => t.target === target.name);
      const todayComments = tracked?.todayComments || 0;
      return {
        name: target.name,
        todayComments,
        dailyLimit: target.dailyLimit,
        remaining: Math.max(0, target.dailyLimit - todayComments),
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

    // Determine table header based on platform
    const targetLabel = skill.platform === 'reddit' ? 'Subreddit' : 'Target';
    const targetPrefix = skill.platform === 'reddit' ? 'r/' : '';
    
    output.table(statuses.map(s => ({
      [targetLabel]: `${targetPrefix}${s.name}`,
      Today: s.todayComments,
      Limit: s.dailyLimit,
      Remaining: s.remaining,
    })));

    output.divider();

    // Build tracking summary for the LLM
    const trackingSummary = statuses
      .filter(s => s.remaining > 0)
      .map(s => `${targetPrefix}${s.name}: ${s.todayComments}/${s.dailyLimit} (${s.remaining} remaining)`)
      .join('\n');

    // Run the agentic loop - LLM handles everything from here
    await runBatchWithToolCalling(skillName, trackingSummary);

  } catch (error) {
    output.error(`Batch mode failed: ${error}`);
  }
}
