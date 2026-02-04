import { output } from './ui/output.js';
import { createSpinner } from './ui/progress.js';
import { Skill, loadResource, getTodayTrackingPath } from './skill-loader.js';
import { readMemory, logComment, logLeadFound, logError } from './memory.js';
import * as browser from './browser.js';
import * as llm from './llm.js';
import { approveComment } from './human-in-loop.js';
import { waitForAction, waitForScroll } from './timing.js';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

export interface CommentResult {
  success: boolean;
  postUrl?: string;
  postTitle?: string;
  commentUrl?: string;
  error?: string;
  isLead?: boolean;
  leadRelevance?: string;
}

/**
 * Execute the single comment workflow (SKILL.md steps 1-8)
 */
export async function executeCommentWorkflow(
  skill: Skill,
  subreddit: string
): Promise<CommentResult> {
  const spinner = createSpinner('Initializing...');
  
  try {
    // Step 1: Load resources and check tracking
    spinner.start('Loading resources...');
    
    const personalization = await loadResource(skill, 'personalization_reddit');
    const subredditsInfo = await loadResource(skill, 'subreddits');
    const productInfo = await loadResource(skill, 'product');
    const memory = await readMemory(skill);
    
    if (!personalization) {
      throw new Error('Personalization file not found');
    }

    // Extract subreddit-specific rules
    const subredditRules = extractSubredditRules(subredditsInfo || '', subreddit);

    spinner.succeed('Resources loaded');

    // Step 2: Navigate to subreddit and explore posts
    spinner.start(`Navigating to r/${subreddit}...`);
    
    await browser.navigate(`https://www.reddit.com/r/${subreddit}/new/`);
    await waitForAction();

    // Check login status
    const isLoggedIn = await browser.isLoggedIntoReddit();
    if (!isLoggedIn) {
      throw new Error('Not logged into Reddit. Please log in and try again.');
    }

    spinner.succeed(`Loaded r/${subreddit}`);

    // Extract posts
    spinner.start('Finding suitable posts...');
    
    const posts = await browser.extractRedditPosts();
    
    if (posts.length === 0) {
      await browser.scrollDown(800);
      await waitForScroll();
      const morePosts = await browser.extractRedditPosts();
      if (morePosts.length === 0) {
        throw new Error('No posts found in subreddit');
      }
      posts.push(...morePosts);
    }

    // Get already commented posts from tracking
    const commentedUrls = await getCommentedUrls(skill);

    // Filter out already commented posts
    const availablePosts = posts.filter(p => !commentedUrls.includes(p.url));
    
    if (availablePosts.length === 0) {
      throw new Error('All visible posts have already been commented on today');
    }

    spinner.succeed(`Found ${availablePosts.length} potential posts`);

    // Step 3: Analyze posts and select one
    spinner.start('Analyzing posts...');

    let selectedPost = null;
    let analysis = null;

    for (const post of availablePosts.slice(0, 5)) {
      analysis = await llm.analyzePost(
        `Title: ${post.title}\nAuthor: ${post.author}\nSubreddit: r/${subreddit}`,
        subredditRules
      );

      if (analysis.worthCommenting) {
        selectedPost = post;
        break;
      }
    }

    if (!selectedPost || !analysis) {
      throw new Error('No suitable posts found for commenting');
    }

    spinner.succeed(`Selected: "${selectedPost.title.substring(0, 50)}..."`);

    // Step 3b: Navigate to post for deep analysis
    spinner.start('Analyzing post content...');
    
    await browser.navigate(selectedPost.url);
    await waitForAction();

    const postContent = await browser.getTextContent();
    const postSummary = await llm.summarizePost(postContent.substring(0, 3000));

    spinner.succeed('Post analyzed');

    // Step 4: Generate comment
    spinner.start('Generating comment...');

    const comment = await llm.generateComment(
      `Title: ${selectedPost.title}\n\nContent: ${postSummary}\n\nSuggested angle: ${analysis.suggestedAngle}`,
      personalization,
      subredditRules,
      memory
    );

    spinner.succeed('Comment generated');

    // Step 5: Personalization review
    spinner.start('Reviewing comment...');

    const review = await llm.reviewComment(comment, personalization, postSummary);
    
    const finalComment = review.approved ? comment : (review.revisedComment || comment);

    if (!review.approved && review.issues.length > 0) {
      output.warning(`Comment revised: ${review.issues.join(', ')}`);
    }

    spinner.succeed('Comment reviewed');

    // Human-in-the-loop approval
    const approved = await approveComment(finalComment, {
      subreddit,
      postTitle: selectedPost.title,
    });

    if (!approved) {
      await logComment(skill, subreddit, selectedPost.title, 'skipped');
      return {
        success: false,
        postUrl: selectedPost.url,
        postTitle: selectedPost.title,
        error: 'Comment rejected by user',
      };
    }

    // Step 6: Post comment
    spinner.start('Posting comment...');

    const posted = await postComment(finalComment);

    if (!posted) {
      throw new Error('Failed to post comment');
    }

    spinner.succeed('Comment posted!');

    // Step 7: Check for lead
    let isLead = false;
    let leadRelevance: string | undefined;

    if (productInfo) {
      const leadCheck = await llm.checkForLead(
        `${selectedPost.title}\n${postSummary}`,
        productInfo
      );

      if (leadCheck.isLead) {
        isLead = true;
        leadRelevance = leadCheck.relevance;
        await logLeadFound(skill, subreddit, selectedPost.author, leadCheck.relevance);
        await appendToLeadsFile(skill, selectedPost, leadCheck);
        output.success(`Lead found: u/${selectedPost.author} (${leadCheck.relevance})`);
      }
    }

    // Step 8: Update tracking
    await logComment(skill, subreddit, selectedPost.title, 'success');
    await updateTrackingFile(skill, subreddit, selectedPost, finalComment);

    return {
      success: true,
      postUrl: selectedPost.url,
      postTitle: selectedPost.title,
      isLead,
      leadRelevance,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    spinner.fail(errorMessage);
    await logError(skill, 'Comment workflow', errorMessage);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Extract subreddit-specific rules from subreddits.md
 */
function extractSubredditRules(content: string, subreddit: string): string {
  // Try to find the section for this subreddit
  const regex = new RegExp(
    `### r/${subreddit}[\\s\\S]*?(?=### r/|$)`,
    'i'
  );
  
  const match = content.match(regex);
  return match ? match[0] : `Subreddit: r/${subreddit}`;
}

/**
 * Get list of URLs already commented on today
 */
async function getCommentedUrls(skill: Skill): Promise<string[]> {
  const trackingPath = getTodayTrackingPath(skill);
  
  if (!existsSync(trackingPath)) {
    return [];
  }

  const content = await readFile(trackingPath, 'utf-8');
  const urls: string[] = [];
  
  // Extract URLs from tracking file
  const urlRegex = /https:\/\/www\.reddit\.com\/r\/\w+\/comments\/\w+/g;
  let match;
  
  while ((match = urlRegex.exec(content)) !== null) {
    urls.push(match[0]);
  }

  return urls;
}

/**
 * Post comment to Reddit
 */
async function postComment(comment: string): Promise<boolean> {
  try {
    // Find and click comment box
    const commentBoxSelectors = [
      '[data-testid="comment-composer-button"]',
      'button[aria-label*="comment"]',
      '[placeholder*="comment"]',
      '.CommentForm textarea',
      'div[contenteditable="true"]',
    ];

    let clicked = false;
    for (const selector of commentBoxSelectors) {
      try {
        await browser.click(selector);
        clicked = true;
        break;
      } catch {
        continue;
      }
    }

    if (!clicked) {
      // Try scrolling down to find comment box
      await browser.scrollDown(300);
      await waitForAction();
      
      for (const selector of commentBoxSelectors) {
        try {
          await browser.click(selector);
          clicked = true;
          break;
        } catch {
          continue;
        }
      }
    }

    if (!clicked) {
      output.warning('Could not find comment box');
      return false;
    }

    await waitForAction();

    // Type comment
    const textareaSelectors = [
      'textarea[placeholder*="comment"]',
      'div[contenteditable="true"]',
      '.CommentForm textarea',
      '[data-testid="comment-composer"] textarea',
    ];

    let typed = false;
    for (const selector of textareaSelectors) {
      try {
        await browser.type(selector, comment);
        typed = true;
        break;
      } catch {
        continue;
      }
    }

    if (!typed) {
      output.warning('Could not type in comment box');
      return false;
    }

    await waitForAction();

    // Click submit button
    const submitSelectors = [
      'button[type="submit"]',
      '[data-testid="comment-submit-button"]',
      'button:contains("Comment")',
      '.CommentForm button',
    ];

    for (const selector of submitSelectors) {
      try {
        await browser.click(selector);
        await waitForAction();
        return true;
      } catch {
        continue;
      }
    }

    output.warning('Could not find submit button');
    return false;

  } catch (error) {
    output.error(`Failed to post: ${error}`);
    return false;
  }
}

/**
 * Update tracking file with new comment
 */
async function updateTrackingFile(
  skill: Skill,
  subreddit: string,
  post: browser.RedditPost,
  comment: string
): Promise<void> {
  const trackingPath = getTodayTrackingPath(skill);
  const templatePath = `${skill.trackingPath}/template.md`;

  let content: string;

  if (existsSync(trackingPath)) {
    content = await readFile(trackingPath, 'utf-8');
  } else if (existsSync(templatePath)) {
    content = await readFile(templatePath, 'utf-8');
    // Replace date placeholder
    const today = new Date().toISOString().split('T')[0];
    content = content.replace('[YYYY-MM-DD]', today);
  } else {
    content = `# Reddit Activity Report - ${new Date().toISOString().split('T')[0]}\n\n## Activity Log\n\n`;
  }

  // Update subreddit count in table
  const tableRegex = new RegExp(
    `\\|\\s*r/${subreddit}\\s*\\|\\s*(\\d+)\\s*\\|\\s*(\\d+)\\s*\\|([^|]*)\\|`,
    'i'
  );
  
  const tableMatch = content.match(tableRegex);
  if (tableMatch) {
    const currentCount = parseInt(tableMatch[1], 10);
    const newCount = currentCount + 1;
    const time = new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    
    content = content.replace(
      tableRegex,
      `| r/${subreddit} | ${newCount} | ${tableMatch[2]} | ${time} |`
    );
  }

  // Add activity log entry
  const time = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
  
  const logEntry = `
### [${time}] r/${subreddit}
- **Post**: [${post.title}](${post.url})
- **Topic Summary**: ${post.title.substring(0, 100)}
- **Comment Content**:
\`\`\`
${comment}
\`\`\`

`;

  // Find where to insert (before "## Potential Customers" or at end)
  const insertPoint = content.indexOf('## Potential Customers');
  if (insertPoint > 0) {
    content = content.slice(0, insertPoint) + logEntry + content.slice(insertPoint);
  } else {
    content += logEntry;
  }

  await writeFile(trackingPath, content, 'utf-8');
}

/**
 * Append lead to leads file
 */
async function appendToLeadsFile(
  skill: Skill,
  post: browser.RedditPost,
  leadInfo: { relevance: string; reason: string }
): Promise<void> {
  const leadsPath = skill.leadsPath;
  
  let content = '';
  if (existsSync(leadsPath)) {
    content = await readFile(leadsPath, 'utf-8');
  }

  const today = new Date().toISOString().split('T')[0];
  const entry = `
### u/${post.author}
- **Subreddit**: r/${post.subreddit}
- **Post**: [${post.title}](${post.url})
- **Discovery Date**: ${today}
- **Post Summary**: ${post.title}
- **Selection Reason**: ${leadInfo.reason}
- **Relevance**: ${leadInfo.relevance}
- **Response Status**: Comment Posted
- **Notes**: Auto-discovered by Agent0

---
`;

  // Insert after "## Lead List" or at end
  const insertPoint = content.indexOf('(No leads discovered yet)');
  if (insertPoint > 0) {
    content = content.replace('(No leads discovered yet)', entry);
  } else {
    const listPoint = content.indexOf('## Lead List');
    if (listPoint > 0) {
      const afterList = content.indexOf('\n', listPoint + 15);
      content = content.slice(0, afterList) + '\n' + entry + content.slice(afterList);
    } else {
      content += entry;
    }
  }

  await writeFile(leadsPath, content, 'utf-8');
}
