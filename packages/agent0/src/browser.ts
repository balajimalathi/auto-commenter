/**
 * Browser adapter that delegates all operations to playwriter MCP.
 * Playwriter controls the browser via the extension relay (port 19988).
 */

import { createSpinner } from './ui/progress.js';
import * as playwriter from './playwriter-client.js';

const DEFAULT_TIMEOUT = 30000;

/**
 * Escape a string for safe embedding in generated JavaScript.
 * Use JSON.stringify for string literals; for CSS selectors use this or JSON.stringify.
 */
function escapeForCode(s: string): string {
  return JSON.stringify(s);
}

/**
 * Extract the return value from playwriter execute result text.
 * Format: "[return value] <content>\n"
 */
function extractReturnValue(text: string): string | null {
  const marker = '[return value] ';
  const idx = text.indexOf(marker);
  if (idx === -1) return null;
  return text.slice(idx + marker.length).replace(/\n$/, '').trim();
}

/**
 * Connect to browser via playwriter MCP (relay + extension).
 */
export async function connectBrowser(): Promise<void> {
  if (playwriter.isConnected()) {
    return;
  }

  const spinner = createSpinner('Connecting to browser (Playwriter + extension)...');
  spinner.start();

  try {
    await playwriter.connect();
    spinner.succeed('Connected to browser');
  } catch (error) {
    spinner.fail('Failed to connect to browser');
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${msg}\n\n` +
        'Ensure: 1) Chrome is open with the Playwriter extension installed. ' +
        '2) Extension is connected (click the extension icon on a tab). ' +
        '3) Run `pnpm relay` if the relay server is not running.'
    );
  }
}

/**
 * Close browser connection (disconnect from playwriter MCP).
 */
export async function closeBrowser(): Promise<void> {
  await playwriter.disconnect();
}

/**
 * Navigate to URL
 */
export async function navigate(url: string): Promise<void> {
  const code = `await page.goto(${escapeForCode(url)}, { waitUntil: 'domcontentloaded', timeout: ${DEFAULT_TIMEOUT} }); await page.waitForTimeout(2000);`;
  const result = await playwriter.callExecute(code, DEFAULT_TIMEOUT + 5000);
  if (result.isError) {
    throw new Error(result.text);
  }
}

/**
 * Get page content/snapshot (raw HTML)
 */
export async function getPageContent(): Promise<string> {
  const code = `return await page.content();`;
  const result = await playwriter.callExecute(code);
  if (result.isError) {
    throw new Error(result.text);
  }
  const ret = extractReturnValue(result.text);
  return ret ?? result.text;
}

/**
 * Get accessibility tree (similar to browser_snapshot)
 */
export async function getAccessibilityTree(): Promise<string> {
  const code = `return await page.locator('body').ariaSnapshot();`;
  const result = await playwriter.callExecute(code);
  if (result.isError) {
    throw new Error(result.text);
  }
  const ret = extractReturnValue(result.text);
  return ret ?? result.text;
}

/**
 * Get text content of the page
 */
export async function getTextContent(): Promise<string> {
  const code = `return await page.evaluate(() => document.body.innerText);`;
  const result = await playwriter.callExecute(code);
  if (result.isError) {
    throw new Error(result.text);
  }
  const ret = extractReturnValue(result.text);
  return ret ?? result.text;
}

/**
 * Click an element by selector
 */
export async function click(selector: string): Promise<void> {
  const code = `await page.locator(${escapeForCode(selector)}).click();`;
  const result = await playwriter.callExecute(code);
  if (result.isError) {
    throw new Error(result.text);
  }
}

/**
 * Type text into an element
 */
export async function type(selector: string, text: string): Promise<void> {
  const code = `await page.locator(${escapeForCode(selector)}).click(); await page.keyboard.type(${escapeForCode(text)}, { delay: 20 });`;
  const result = await playwriter.callExecute(code);
  if (result.isError) {
    throw new Error(result.text);
  }
}

/**
 * Fill an input (clear and type)
 */
export async function fill(selector: string, text: string): Promise<void> {
  const code = `await page.locator(${escapeForCode(selector)}).fill(${escapeForCode(text)});`;
  const result = await playwriter.callExecute(code);
  if (result.isError) {
    throw new Error(result.text);
  }
}

/**
 * Wait for selector
 */
export async function waitFor(selector: string, timeout?: number): Promise<void> {
  const t = timeout ?? DEFAULT_TIMEOUT;
  const code = `await page.locator(${escapeForCode(selector)}).waitFor({ state: 'visible', timeout: ${t} });`;
  const result = await playwriter.callExecute(code, t + 5000);
  if (result.isError) {
    throw new Error(result.text);
  }
}

/**
 * Wait for navigation
 */
export async function waitForNavigation(): Promise<void> {
  const code = `await page.waitForLoadState('domcontentloaded');`;
  const result = await playwriter.callExecute(code);
  if (result.isError) {
    throw new Error(result.text);
  }
}

/**
 * Scroll down
 */
export async function scrollDown(pixels = 500): Promise<void> {
  const code = `await page.evaluate((px) => window.scrollBy(0, px), ${pixels});`;
  const result = await playwriter.callExecute(code);
  if (result.isError) {
    throw new Error(result.text);
  }
}

/**
 * Scroll to element
 */
export async function scrollToElement(selector: string): Promise<void> {
  const code = `await page.locator(${escapeForCode(selector)}).scrollIntoViewIfNeeded();`;
  const result = await playwriter.callExecute(code);
  if (result.isError) {
    throw new Error(result.text);
  }
}

/**
 * Get current URL
 */
export async function getCurrentUrl(): Promise<string> {
  const code = `return page.url();`;
  const result = await playwriter.callExecute(code);
  if (result.isError) {
    throw new Error(result.text);
  }
  const ret = extractReturnValue(result.text);
  return ret ?? '';
}

/**
 * Go back
 */
export async function goBack(): Promise<void> {
  const code = `await page.goBack({ waitUntil: 'domcontentloaded' });`;
  const result = await playwriter.callExecute(code);
  if (result.isError) {
    throw new Error(result.text);
  }
}

/**
 * Evaluate JavaScript in page context.
 * @param code - JS expression to run (e.g. "document.body.innerText")
 */
export async function evaluate<T = unknown>(code: string): Promise<T> {
  const execCode = `return await page.evaluate((s) => eval(s), ${escapeForCode(code)});`;
  const result = await playwriter.callExecute(execCode);
  if (result.isError) {
    throw new Error(result.text);
  }
  const ret = extractReturnValue(result.text);
  if (ret === null) {
    throw new Error('Could not extract return value from evaluate');
  }
  try {
    return JSON.parse(ret) as T;
  } catch {
    return ret as unknown as T;
  }
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

const EXTRACT_POSTS_CODE = `
const posts = await page.evaluate(() => {
  const result = [];
  const postElements = document.querySelectorAll('article, [data-testid="post-container"], shreddit-post');
  postElements.forEach((post) => {
    try {
      const titleEl = post.querySelector('h3, [slot="title"], a[data-click-id="body"]');
      const linkEl = post.querySelector('a[href*="/comments/"]');
      const authorEl = post.querySelector('a[href*="/user/"]');
      if (titleEl && linkEl) {
        result.push({
          title: titleEl.textContent?.trim() || '',
          url: linkEl.href,
          author: authorEl?.textContent?.replace('u/', '').trim() || '',
          subreddit: window.location.pathname.split('/')[2] || '',
          commentCount: 0,
          upvotes: '0'
        });
      }
    } catch (e) {}
  });
  return result.slice(0, 10);
});
return JSON.stringify(posts);
`;

export async function extractRedditPosts(): Promise<RedditPost[]> {
  const result = await playwriter.callExecute(EXTRACT_POSTS_CODE);
  if (result.isError) {
    throw new Error(result.text);
  }
  const ret = extractReturnValue(result.text);
  if (!ret) {
    return [];
  }
  try {
    return JSON.parse(ret) as RedditPost[];
  } catch {
    return [];
  }
}

/**
 * Submit a Reddit comment via playwriter execute.
 * Simple 3-step flow:
 *  1. Click "Join the conversation" to activate the composer
 *  2. Type the comment in the editor that appears
 *  3. Click the "Comment" submit button
 */
export async function submitRedditComment(commentText: string): Promise<{ success: boolean; error?: string }> {
  const escaped = escapeForCode(commentText);
  const code = `
try {
  // Playwright locators don't reliably find elements inside Reddit's custom element tree
  // through the Playwriter relay. Use page.evaluate() with direct DOM APIs instead,
  // including recursive shadow DOM traversal.

  // Helper: find element by selector, searching through shadow roots if needed.
  // Defined once on window so all evaluate calls can use it.
  await page.evaluate(() => {
    window.__find = (selector, root) => {
      root = root || document;
      let el = root.querySelector(selector);
      if (el) return el;
      const children = root.querySelectorAll('*');
      for (let i = 0; i < children.length; i++) {
        if (children[i].shadowRoot) {
          el = window.__find(selector, children[i].shadowRoot);
          if (el) return el;
        }
      }
      return null;
    };
  });

  // Step 1: Click "Join the conversation" trigger to open the composer.
  let triggerClicked = await page.evaluate(() => {
    const trigger = window.__find('[data-testid="trigger-button"]')
      || window.__find('faceplate-textarea-input[placeholder="Join the conversation"]');
    if (!trigger) return false;
    trigger.scrollIntoView({ block: 'center' });
    trigger.click();
    return true;
  });

  if (!triggerClicked) {
    // Scroll to bottom and retry — composer might be below the fold
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    triggerClicked = await page.evaluate(() => {
      const trigger = window.__find('[data-testid="trigger-button"]')
        || window.__find('faceplate-textarea-input[placeholder="Join the conversation"]');
      if (!trigger) return false;
      trigger.scrollIntoView({ block: 'center' });
      trigger.click();
      return true;
    });
  }

  if (!triggerClicked) {
    const diag = await page.evaluate(() => ({
      url: location.href,
      hasShredditComposer: !!window.__find('shreddit-composer'),
      hasAsyncLoader: !!window.__find('shreddit-async-loader'),
      hasFaceplateTextarea: !!window.__find('faceplate-textarea-input'),
      testIds: [...document.querySelectorAll('[data-testid]')].map(e => e.getAttribute('data-testid')).slice(0, 15),
    }));
    return JSON.stringify({ success: false, error: 'Trigger not found. Diag: ' + JSON.stringify(diag) });
  }

  await page.waitForTimeout(1500);

  // Step 2: Find the editor, focus it, and type the comment.
  const editorReady = await page.evaluate(() => {
    const editor = window.__find('div[contenteditable="true"]');
    if (!editor) return false;
    editor.scrollIntoView({ block: 'center' });
    editor.focus();
    editor.click();
    return true;
  });

  if (!editorReady) {
    return JSON.stringify({ success: false, error: 'Editor not found after clicking trigger.' });
  }

  await page.waitForTimeout(300);
  await page.keyboard.type(${escaped}, { delay: 20 });
  await page.waitForTimeout(500);

  // Step 3: Click the "Comment" submit button.
  const submitted = await page.evaluate(() => {
    const btn = window.__find('button[slot="submit-button"]')
      || window.__find('button[type="submit"]');
    if (!btn) return false;
    btn.click();
    return true;
  });

  if (!submitted) {
    return JSON.stringify({ success: false, error: 'Submit button not found.' });
  }

  await page.waitForTimeout(2000);
  return JSON.stringify({ success: true });
} catch (e) {
  return JSON.stringify({ success: false, error: e.message || String(e) });
}
`;
  const result = await playwriter.callExecute(code, 30000);
  if (result.isError) {
    return { success: false, error: result.text };
  }
  const ret = extractReturnValue(result.text);
  if (!ret) {
    return { success: false, error: 'No return value from comment submission' };
  }
  try {
    const parsed = JSON.parse(ret) as { success: boolean; error?: string };
    return parsed;
  } catch {
    return { success: false, error: result.text };
  }
}

/**
 * Check if logged into Reddit
 */
export async function isLoggedIntoReddit(): Promise<boolean> {
  const code = `return await page.evaluate(() => {
    const userMenu = document.querySelector('[id*="user-drawer"]') ||
      document.querySelector('button[aria-label*="account"]') ||
      document.querySelector('a[href*="/user/"]');
    return !!userMenu;
  });`;
  const result = await playwriter.callExecute(code);
  if (result.isError) {
    return false;
  }
  const ret = extractReturnValue(result.text);
  return ret === 'true';
}
