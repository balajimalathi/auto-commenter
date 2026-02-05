/**
 * Extract page content as markdown using Mozilla Readability.
 *
 * This utility injects the Readability library into the page and extracts
 * the main content, similar to Firefox Reader View.
 */
import type { Page } from 'playwright-core';
export interface PageMarkdownResult {
    /** Extracted content as plain text (HTML tags stripped) */
    content: string;
    /** Article title */
    title: string | null;
    /** Article author/byline */
    author: string | null;
    /** Article excerpt/description */
    excerpt: string | null;
    /** Site name */
    siteName: string | null;
    /** Content language */
    lang: string | null;
    /** Published time */
    publishedTime: string | null;
    /** Word count */
    wordCount: number;
}
export interface GetPageMarkdownOptions {
    page: Page;
    /** String or regex to filter content (returns matching lines with context) */
    search?: string | RegExp;
    /** Return diff since last call for this page */
    showDiffSinceLastCall?: boolean;
}
/**
 * Extract page content as markdown using Mozilla Readability.
 *
 * Injects Readability into the page if not already present, then extracts
 * the main content. Returns plain text content (no HTML).
 */
export declare function getPageMarkdown(options: GetPageMarkdownOptions): Promise<string>;
//# sourceMappingURL=page-markdown.d.ts.map