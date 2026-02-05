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
 */
export async function submitRedditComment(commentText: string): Promise<{ success: boolean; error?: string }> {
  const escaped = escapeForCode(commentText);
  const code = `
try {
  const shredditComposer = page.locator('shreddit-composer').first();
  let composerFound = false;
  try { await shredditComposer.waitFor({ state: 'visible', timeout: 5000 }); composerFound = true; } catch {}
  if (!composerFound) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000);
    try { await shredditComposer.waitFor({ state: 'visible', timeout: 3000 }); composerFound = true; } catch {}
  }
  if (!composerFound) return JSON.stringify({ success: false, error: 'Could not find shreddit-composer. Make sure you are logged into Reddit and on a post page.' });
  await shredditComposer.scrollIntoViewIfNeeded();
  await shredditComposer.click();
  await page.waitForTimeout(1500);
  let editor = page.locator('shreddit-composer div[contenteditable="true"]').first();
  let editorFound = false;
  try { await editor.waitFor({ state: 'visible', timeout: 5000 }); editorFound = true; } catch {}
  if (!editorFound) {
    editor = page.locator('div[contenteditable="true"][role="textbox"]').first();
    try { await editor.waitFor({ state: 'visible', timeout: 3000 }); editorFound = true; } catch {}
  }
  if (!editorFound) {
    editor = page.locator('div[contenteditable="true"]').first();
    try { await editor.waitFor({ state: 'visible', timeout: 3000 }); editorFound = true; } catch {}
  }
  if (!editorFound) return JSON.stringify({ success: false, error: 'Comment editor did not activate.' });
  await editor.click();
  await page.waitForTimeout(300);
  await page.keyboard.type(${escaped}, { delay: 20 });
  await page.waitForTimeout(500);
  let submitBtn = page.locator('shreddit-composer button[type="submit"][slot="submit-button"]').first();
  let btnFound = false;
  try { await submitBtn.waitFor({ state: 'visible', timeout: 3000 }); btnFound = true; } catch {}
  if (!btnFound) { submitBtn = page.locator('button[slot="submit-button"]').first(); try { await submitBtn.waitFor({ state: 'visible', timeout: 2000 }); btnFound = true; } catch {} }
  if (!btnFound) { submitBtn = page.locator('shreddit-composer button').filter({ hasText: /^Comment$/i }).first(); try { await submitBtn.waitFor({ state: 'visible', timeout: 2000 }); btnFound = true; } catch {} }
  if (!btnFound) { submitBtn = page.getByRole('button', { name: /^Comment$/i }).first(); try { await submitBtn.waitFor({ state: 'visible', timeout: 2000 }); btnFound = true; } catch {} }
  if (!btnFound) return JSON.stringify({ success: false, error: 'Could not find Comment submit button.' });
  await submitBtn.click();
  await page.waitForTimeout(2000);
  return JSON.stringify({ success: true });
} catch (e) {
  return JSON.stringify({ success: false, error: e.message || String(e) });
}
`;
  const result = await playwriter.callExecute(code, 45000);
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
