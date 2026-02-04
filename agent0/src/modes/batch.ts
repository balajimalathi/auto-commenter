import { output } from '../ui/output.js';
import { BatchProgress } from '../ui/progress.js';
import { errorRecovery } from '../ui/prompts.js';
import { loadSkill, loadTracking, parseTracking, parseSubreddits, loadResource, Skill } from '../skill-loader.js';
import { executeCommentWorkflow } from '../agent-loop.js';
import { logSubredditComplete, logBatchProgress } from '../memory.js';
import { waitBetweenComments, waitBetweenSubreddits, estimateBatchTime } from '../timing.js';
import { connectBrowser, closeBrowser } from '../browser.js';

interface SubredditStatus {
  name: string;
  todayComments: number;
  dailyLimit: number;
  remaining: number;
}

/**
 * Run batch mode - fill today's quota
 */
export async function runBatchMode(skillName: string): Promise<void> {
  output.header('Agent0 Batch Mode');

  try {
    // Load skill
    const skill = await loadSkill(skillName);
    output.success(`Loaded skill: ${skill.name}`);

    // Connect to browser
    await connectBrowser();

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

    // Show status
    output.divider();
    output.info(`Quota: ${totalCompleted}/${totalDaily} (${totalRemaining} remaining)`);
    output.info(`Estimated time: ${estimateBatchTime(totalRemaining, statuses.filter(s => s.remaining > 0).length)}`);
    output.divider();

    output.table(statuses.map(s => ({
      Subreddit: `r/${s.name}`,
      Today: s.todayComments,
      Limit: s.dailyLimit,
      Remaining: s.remaining,
    })));

    output.divider();

    // Start batch progress
    const progress = new BatchProgress(totalRemaining, 'Batch progress');
    progress.start();

    let completedThisSession = 0;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;

    // Sort subreddits by priority (least activity first)
    const sortedStatuses = [...statuses]
      .filter(s => s.remaining > 0)
      .sort((a, b) => a.todayComments - b.todayComments);

    // Process each subreddit
    for (const status of sortedStatuses) {
      if (consecutiveErrors >= maxConsecutiveErrors) {
        output.error(`Stopping after ${maxConsecutiveErrors} consecutive errors`);
        break;
      }

      output.info(`\nStarting r/${status.name} (${status.remaining} comments to go)`);

      let subredditComments = 0;

      // Post comments for this subreddit
      for (let i = 0; i < status.remaining; i++) {
        progress.update(
          completedThisSession,
          `r/${status.name} (${subredditComments + 1}/${status.remaining})`
        );

        const result = await executeCommentWorkflow(skill, status.name);

        if (result.success) {
          completedThisSession++;
          subredditComments++;
          consecutiveErrors = 0;
          
          await logBatchProgress(skill, status.name, subredditComments, status.remaining);
          progress.increment(`r/${status.name} (${subredditComments}/${status.remaining})`);

          // Wait between comments (if not last)
          if (i < status.remaining - 1) {
            await waitBetweenComments();
          }
        } else {
          consecutiveErrors++;
          
          if (result.error?.includes('All visible posts') || 
              result.error?.includes('No suitable posts')) {
            output.warning(`Skipping r/${status.name}: ${result.error}`);
            break; // Move to next subreddit
          }

          const recovery = await errorRecovery(result.error || 'Unknown error');
          
          if (recovery === 'retry') {
            i--; // Retry this iteration
            continue;
          } else if (recovery === 'skip') {
            continue; // Skip to next comment
          } else {
            output.info('Stopping batch mode');
            break;
          }
        }
      }

      // Log subreddit completion
      if (subredditComments > 0) {
        await logSubredditComplete(skill, status.name, subredditComments);
        output.success(`Completed r/${status.name}: ${subredditComments} comments`);
      }

      // Wait between subreddits (if not last)
      const isLast = sortedStatuses.indexOf(status) === sortedStatuses.length - 1;
      if (!isLast && subredditComments > 0) {
        await waitBetweenSubreddits();
      }
    }

    progress.complete(`Batch complete: ${completedThisSession} comments posted`);

    // Final report
    printBatchReport(skill, statuses, completedThisSession);

  } catch (error) {
    output.error(`Batch mode failed: ${error}`);
  } finally {
    await closeBrowser();
  }
}

/**
 * Print batch completion report
 */
function printBatchReport(
  skill: Skill,
  statuses: SubredditStatus[],
  completedThisSession: number
): void {
  output.divider();
  output.header('Batch Completion Report');

  output.info(`Total written this session: ${completedThisSession}`);
  
  output.table(statuses.map(s => ({
    Subreddit: `r/${s.name}`,
    Written: `${s.dailyLimit - s.remaining}/${s.dailyLimit}`,
    Status: s.remaining === 0 ? '✓ Complete' : `${s.remaining} remaining`,
  })));

  output.divider();
  output.info(`Tracking file: tracking/${skill.platform}/${new Date().toISOString().split('T')[0]}.md`);
  output.info(`Leads file: leads/${skill.platform}.md`);
}
