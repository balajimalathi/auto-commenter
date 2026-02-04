import puppeteer, { Browser, Page } from 'puppeteer-core';
import { output } from './ui/output.js';
import { createSpinner } from './ui/progress.js';

let browserInstance: Browser | null = null;
let activePage: Page | null = null;

export interface BrowserConfig {
  debugPort: number;
  defaultTimeout: number;
}

export function getBrowserConfig(): BrowserConfig {
  return {
    debugPort: parseInt(process.env.CHROME_DEBUG_PORT || '9222', 10),
    defaultTimeout: 30000,
  };
}

/**
 * Connect to existing Chrome browser via CDP
 */
export async function connectBrowser(): Promise<Browser> {
  if (browserInstance) {
    return browserInstance;
  }

  const config = getBrowserConfig();
  const spinner = createSpinner('Connecting to Chrome...');
  spinner.start();

  try {
    browserInstance = await puppeteer.connect({
      browserURL: `http://localhost:${config.debugPort}`,
      defaultViewport: null,
    });

    spinner.succeed('Connected to Chrome');
    
    // Handle disconnection
    browserInstance.on('disconnected', () => {
      output.warning('Chrome disconnected');
      browserInstance = null;
      activePage = null;
    });

    return browserInstance;
  } catch (error) {
    spinner.fail('Failed to connect to Chrome');
    throw new Error(
      `Cannot connect to Chrome on port ${config.debugPort}. ` +
      `Make sure Chrome is running with: --remote-debugging-port=${config.debugPort}`
    );
  }
}

/**
 * Get or create a page for operations
 */
export async function getPage(): Promise<Page> {
  if (activePage && !activePage.isClosed()) {
    return activePage;
  }

  const browser = await connectBrowser();
  const pages = await browser.pages();
  
  // Try to use existing tab, or create new one
  if (pages.length > 0) {
    activePage = pages[0];
  } else {
    activePage = await browser.newPage();
  }

  return activePage;
}

/**
 * Create a new tab
 */
export async function createNewTab(): Promise<Page> {
  const browser = await connectBrowser();
  const page = await browser.newPage();
  activePage = page;
  return page;
}

/**
 * Navigate to URL
 */
export async function navigate(url: string): Promise<void> {
  const page = await getPage();
  const config = getBrowserConfig();
  
  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: config.defaultTimeout,
  });
}

/**
 * Get page content/snapshot
 */
export async function getPageContent(): Promise<string> {
  const page = await getPage();
  return await page.content();
}

/**
 * Get accessibility tree (similar to browser_snapshot)
 */
export async function getAccessibilityTree(): Promise<string> {
  const page = await getPage();
  const snapshot = await page.accessibility.snapshot();
  return JSON.stringify(snapshot, null, 2);
}

/**
 * Get text content of the page
 */
export async function getTextContent(): Promise<string> {
  const page = await getPage();
  return await page.evaluate(() => document.body.innerText);
}

/**
 * Click an element by selector
 */
export async function click(selector: string): Promise<void> {
  const page = await getPage();
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector);
}

/**
 * Type text into an element
 */
export async function type(selector: string, text: string): Promise<void> {
  const page = await getPage();
  await page.waitForSelector(selector, { visible: true });
  await page.type(selector, text);
}

/**
 * Fill an input (clear and type)
 */
export async function fill(selector: string, text: string): Promise<void> {
  const page = await getPage();
  await page.waitForSelector(selector, { visible: true });
  await page.$eval(selector, (el) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.value = '';
    }
  });
  await page.type(selector, text);
}

/**
 * Wait for selector
 */
export async function waitFor(selector: string, timeout?: number): Promise<void> {
  const page = await getPage();
  const config = getBrowserConfig();
  await page.waitForSelector(selector, {
    visible: true,
    timeout: timeout || config.defaultTimeout,
  });
}

/**
 * Wait for navigation
 */
export async function waitForNavigation(): Promise<void> {
  const page = await getPage();
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
}

/**
 * Scroll down
 */
export async function scrollDown(pixels = 500): Promise<void> {
  const page = await getPage();
  await page.evaluate((px) => window.scrollBy(0, px), pixels);
}

/**
 * Scroll to element
 */
export async function scrollToElement(selector: string): Promise<void> {
  const page = await getPage();
  await page.$eval(selector, (el) => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

/**
 * Get current URL
 */
export async function getCurrentUrl(): Promise<string> {
  const page = await getPage();
  return page.url();
}

/**
 * Go back
 */
export async function goBack(): Promise<void> {
  const page = await getPage();
  await page.goBack({ waitUntil: 'networkidle2' });
}

/**
 * Evaluate JavaScript in page context
 */
export async function evaluate<T>(fn: () => T): Promise<T> {
  const page = await getPage();
  return await page.evaluate(fn);
}

/**
 * Extract posts from Reddit page
 */
export interface RedditPost {
  title: string;
  url: string;
  author: string;
  subreddit: string;
  commentCount: number;
  upvotes: string;
}

export async function extractRedditPosts(): Promise<RedditPost[]> {
  const page = await getPage();
  
  return await page.evaluate(() => {
    const posts: RedditPost[] = [];
    
    // Try to find posts in the new Reddit UI
    const postElements = document.querySelectorAll('article, [data-testid="post-container"], shreddit-post');
    
    postElements.forEach((post) => {
      try {
        const titleEl = post.querySelector('h3, [slot="title"], a[data-click-id="body"]');
        const linkEl = post.querySelector('a[href*="/comments/"]');
        const authorEl = post.querySelector('a[href*="/user/"]');
        
        if (titleEl && linkEl) {
          posts.push({
            title: titleEl.textContent?.trim() || '',
            url: (linkEl as HTMLAnchorElement).href,
            author: authorEl?.textContent?.replace('u/', '').trim() || '',
            subreddit: window.location.pathname.split('/')[2] || '',
            commentCount: 0, // Hard to reliably extract
            upvotes: '0',
          });
        }
      } catch {
        // Skip malformed posts
      }
    });

    return posts.slice(0, 10); // Limit to first 10
  });
}

/**
 * Check if logged into Reddit
 */
export async function isLoggedIntoReddit(): Promise<boolean> {
  const page = await getPage();
  
  return await page.evaluate(() => {
    // Check for login indicators
    const userMenu = document.querySelector('[id*="user-drawer"]') ||
                     document.querySelector('button[aria-label*="account"]') ||
                     document.querySelector('a[href*="/user/"]');
    return !!userMenu;
  });
}

/**
 * Close browser connection
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.disconnect();
    browserInstance = null;
    activePage = null;
  }
}
