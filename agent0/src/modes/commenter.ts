import { output } from '../ui/output.js';
import { createSpinner, BatchProgress } from '../ui/progress.js';
import { errorRecovery } from '../ui/prompts.js';
import { loadSkill, loadResource } from '../skill-loader.js';
import { executeCommentWorkflow } from '../agent-loop.js';
import { waitBetweenComments, waitForScroll } from '../timing.js';
import { connectBrowser, closeBrowser, navigate, scrollDown, extractRedditPosts } from '../browser.js';

/**
 * Parse instruction to extract subreddit and count
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
 * Run commenter mode - post specific number of comments
 */
export async function runCommenterMode(
  skillName: string,
  instruction: string
): Promise<void> {
  output.header('Agent0 Commenter Mode');

  const { subreddit, count } = parseInstruction(instruction);

  if (!subreddit) {
    output.error('Could not parse subreddit from instruction');
    output.info('Example: "Post 3 comments on r/chatgptpro"');
    return;
  }

  output.info(`Target: r/${subreddit}`);
  output.info(`Comments to post: ${count}`);

  try {
    // Load skill
    const skill = await loadSkill(skillName);
    output.success(`Loaded skill: ${skill.name}`);

    // Verify subreddit is configured
    const subredditsContent = await loadResource(skill, 'subreddits');
    if (subredditsContent && !subredditsContent.includes(`r/${subreddit}`)) {
      output.warning(`r/${subreddit} is not in configured subreddits. Proceeding anyway...`);
    }

    // Connect to browser
    await connectBrowser();

    // Start progress tracking
    const progress = new BatchProgress(count, `r/${subreddit}`);
    progress.start();

    let completed = 0;
    let consecutiveErrors = 0;
    const maxErrors = 3;

    // Post comments
    for (let i = 0; i < count; i++) {
      if (consecutiveErrors >= maxErrors) {
        output.error(`Stopping after ${maxErrors} consecutive errors`);
        break;
      }

      progress.update(completed, `Comment ${i + 1}/${count}`);

      const result = await executeCommentWorkflow(skill, subreddit);

      if (result.success) {
        completed++;
        consecutiveErrors = 0;
        progress.increment(`Comment ${completed}/${count}`);

        if (result.isLead) {
          output.success(`Lead found: ${result.leadRelevance} relevance`);
        }

        // Wait between comments (if not last)
        if (i < count - 1) {
          await waitBetweenComments();
        }
      } else {
        consecutiveErrors++;
        output.warning(`Comment ${i + 1} failed: ${result.error}`);

        const recovery = await errorRecovery(result.error || 'Unknown error');

        if (recovery === 'retry') {
          i--; // Retry this iteration
          continue;
        } else if (recovery === 'skip') {
          continue;
        } else {
          break;
        }
      }
    }

    progress.complete(`Posted ${completed}/${count} comments on r/${subreddit}`);

    // Summary
    output.divider();
    output.info(`Completed: ${completed}/${count} comments`);
    output.info(`Tracking: tracking/${skill.platform}/${new Date().toISOString().split('T')[0]}.md`);

  } catch (error) {
    output.error(`Commenter mode failed: ${error}`);
  } finally {
    await closeBrowser();
  }
}

/**
 * Auto-scroll and comment mode
 * Scrolls through subreddit, selects posts, comments, and continues
 */
export async function runAutoScrollMode(
  skillName: string,
  subreddit: string,
  maxComments: number = 5
): Promise<void> {
  output.header('Agent0 Auto-Scroll Mode');
  output.info(`Target: r/${subreddit}`);
  output.info(`Max comments: ${maxComments}`);

  try {
    const skill = await loadSkill(skillName);
    await connectBrowser();

    // Navigate to subreddit
    const spinner = createSpinner(`Loading r/${subreddit}...`);
    spinner.start();
    
    await navigate(`https://www.reddit.com/r/${subreddit}/new/`);
    spinner.succeed(`Loaded r/${subreddit}`);

    let commented = 0;
    let scrollCount = 0;
    const maxScrolls = 20;

    while (commented < maxComments && scrollCount < maxScrolls) {
      // Get posts
      const posts = await extractRedditPosts();
      
      if (posts.length === 0) {
        output.warning('No posts found, scrolling...');
        await scrollDown(800);
        await waitForScroll();
        scrollCount++;
        continue;
      }

      // Try to comment on first suitable post
      output.info(`Found ${posts.length} posts, attempting comment...`);

      const result = await executeCommentWorkflow(skill, subreddit);

      if (result.success) {
        commented++;
        output.success(`Comment ${commented}/${maxComments} posted`);

        if (commented < maxComments) {
          await waitBetweenComments();
        }
      }

      // Scroll to find more posts
      await scrollDown(600);
      await waitForScroll();
      scrollCount++;
    }

    output.divider();
    output.success(`Auto-scroll complete: ${commented} comments posted`);

  } catch (error) {
    output.error(`Auto-scroll failed: ${error}`);
  } finally {
    await closeBrowser();
  }
}
