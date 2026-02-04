import { output } from '../ui/output.js';
import { createSpinner } from '../ui/progress.js';
import { select } from '../ui/prompts.js';
import { loadSkill, loadResource, parseSubreddits } from '../skill-loader.js';
import { waitForAction, waitForScroll } from '../timing.js';
import { connectBrowser, closeBrowser, navigate, scrollDown, evaluate } from '../browser.js';
import { callLLM, Message } from '../llm.js';

interface TrendingPost {
  title: string;
  url: string;
  subreddit: string;
  upvotes: string;
  commentCount: number;
  author: string;
  summary?: string;
}

/**
 * Run trending mode - find trending posts for inspiration
 */
export async function runTrendingMode(
  skillName: string,
  targetSubreddit?: string
): Promise<void> {
  output.header('Agent0 Trending Mode');

  try {
    const skill = await loadSkill(skillName);
    output.success(`Loaded skill: ${skill.name}`);

    await connectBrowser();

    // Determine which subreddits to check
    let subreddits: string[] = [];

    if (targetSubreddit) {
      subreddits = [targetSubreddit];
    } else {
      const subredditsContent = await loadResource(skill, 'subreddits');
      if (subredditsContent) {
        subreddits = parseSubreddits(subredditsContent).map(s => s.name);
      }
    }

    if (subreddits.length === 0) {
      // Default to popular
      subreddits = ['popular'];
    }

    output.info(`Checking subreddits: ${subreddits.map(s => `r/${s}`).join(', ')}`);

    const allTrending: TrendingPost[] = [];

    // Collect trending posts from each subreddit
    for (const subreddit of subreddits) {
      const spinner = createSpinner(`Scanning r/${subreddit}...`);
      spinner.start();

      try {
        const posts = await getTrendingPosts(subreddit);
        allTrending.push(...posts);
        spinner.succeed(`Found ${posts.length} trending posts in r/${subreddit}`);
      } catch (error) {
        spinner.fail(`Failed to scan r/${subreddit}`);
      }
    }

    if (allTrending.length === 0) {
      output.warning('No trending posts found');
      return;
    }

    // Sort by engagement (upvotes)
    allTrending.sort((a, b) => {
      const aNum = parseUpvotes(a.upvotes);
      const bNum = parseUpvotes(b.upvotes);
      return bNum - aNum;
    });

    // Take top 10
    const topPosts = allTrending.slice(0, 10);

    output.divider();
    output.info('Top Trending Posts:');
    output.divider();

    // Display posts
    topPosts.forEach((post, i) => {
      output.info(`[${i + 1}] r/${post.subreddit} - ${post.upvotes} upvotes`);
      output.dim(`    ${post.title.substring(0, 80)}...`);
      output.dim(`    ${post.url}`);
      console.log();
    });

    // Ask what to do
    const action = await select('What would you like to do?', [
      { value: 'analyze', label: 'Analyze for recreation', hint: 'Get ideas for similar content' },
      { value: 'summarize', label: 'Summarize posts', hint: 'Get quick summaries' },
      { value: 'export', label: 'Export list', hint: 'Save to file' },
      { value: 'done', label: 'Done', hint: 'Exit' },
    ]);

    if (action === 'done') {
      return;
    }

    if (action === 'analyze') {
      await analyzeForRecreation(topPosts);
    } else if (action === 'summarize') {
      await summarizePosts(topPosts);
    } else if (action === 'export') {
      await exportPosts(topPosts, skill.platform);
    }

  } catch (error) {
    output.error(`Trending mode failed: ${error}`);
  } finally {
    await closeBrowser();
  }
}

/**
 * Get trending posts from a subreddit
 */
async function getTrendingPosts(subreddit: string): Promise<TrendingPost[]> {
  await navigate(`https://www.reddit.com/r/${subreddit}/hot/`);
  await waitForAction();

  // Scroll to load more posts
  await scrollDown(500);
  await waitForScroll();

  return await evaluate(() => {
    const posts: TrendingPost[] = [];
    
    const postElements = document.querySelectorAll('article, [data-testid="post-container"], shreddit-post');
    
    postElements.forEach((post) => {
      try {
        const titleEl = post.querySelector('h3, [slot="title"], a[data-click-id="body"]');
        const linkEl = post.querySelector('a[href*="/comments/"]');
        const upvotesEl = post.querySelector('[id*="vote-count"], [aria-label*="upvotes"]');
        const authorEl = post.querySelector('a[href*="/user/"]');

        if (titleEl && linkEl) {
          posts.push({
            title: titleEl.textContent?.trim() || '',
            url: (linkEl as HTMLAnchorElement).href,
            subreddit: window.location.pathname.split('/')[2] || '',
            upvotes: upvotesEl?.textContent?.trim() || '0',
            commentCount: 0,
            author: authorEl?.textContent?.replace('u/', '').trim() || '',
          });
        }
      } catch {
        // Skip
      }
    });

    return posts.slice(0, 10);
  }) as TrendingPost[];
}

/**
 * Parse upvote string to number (handles 1.2k, 15k, etc.)
 */
function parseUpvotes(upvotes: string): number {
  const clean = upvotes.toLowerCase().replace(/[^0-9.k]/g, '');
  
  if (clean.includes('k')) {
    return parseFloat(clean.replace('k', '')) * 1000;
  }
  
  return parseInt(clean, 10) || 0;
}

/**
 * Analyze posts for recreation opportunities
 */
async function analyzeForRecreation(posts: TrendingPost[]): Promise<void> {
  output.divider();
  output.info('Analyzing posts for recreation opportunities...');

  const messages: Message[] = [
    {
      role: 'system',
      content: `Analyze these trending Reddit posts and suggest how to create similar content that could perform well.

For each post, provide:
1. Why it's performing well (what makes it engaging)
2. Key elements to replicate
3. A suggested variation or angle for creating similar content

Be specific and actionable.`,
    },
    {
      role: 'user',
      content: posts.map((p, i) => 
        `${i + 1}. r/${p.subreddit}: "${p.title}" (${p.upvotes} upvotes)`
      ).join('\n'),
    },
  ];

  const response = await callLLM(messages, 'analyze');
  
  output.divider();
  console.log(response.content);
}

/**
 * Summarize trending posts
 */
async function summarizePosts(posts: TrendingPost[]): Promise<void> {
  output.divider();
  output.info('Summarizing posts...');

  const messages: Message[] = [
    {
      role: 'system',
      content: 'Summarize each of these Reddit posts in one sentence, focusing on the main topic and why it might be trending.',
    },
    {
      role: 'user',
      content: posts.map((p, i) => 
        `${i + 1}. r/${p.subreddit}: "${p.title}"`
      ).join('\n'),
    },
  ];

  const response = await callLLM(messages, 'summarize');
  
  output.divider();
  console.log(response.content);
}

/**
 * Export posts to a file
 */
async function exportPosts(posts: TrendingPost[], platform: string): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const date = new Date().toISOString().split('T')[0];
  const filename = `trending_${platform}_${date}.md`;
  const filepath = path.join(process.cwd(), filename);

  let content = `# Trending Posts - ${date}\n\n`;

  posts.forEach((post, i) => {
    content += `## ${i + 1}. ${post.title}\n\n`;
    content += `- **Subreddit**: r/${post.subreddit}\n`;
    content += `- **Upvotes**: ${post.upvotes}\n`;
    content += `- **Author**: u/${post.author}\n`;
    content += `- **URL**: ${post.url}\n\n`;
  });

  await fs.writeFile(filepath, content, 'utf-8');
  
  output.success(`Exported to ${filename}`);
}
