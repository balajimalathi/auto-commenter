import { BrowserContext } from 'playwright-core';
import { type RelayServer } from './cdp-relay.js';
export declare function getExtensionServiceWorker(context: BrowserContext): Promise<import("playwright-core").Worker>;
export interface TestContext {
    browserContext: BrowserContext;
    userDataDir: string;
    relayServer: RelayServer;
}
export declare function setupTestContext({ port, tempDirPrefix, toggleExtension, }: {
    port: number;
    tempDirPrefix: string;
    /** Create initial page and toggle extension on it */
    toggleExtension?: boolean;
}): Promise<TestContext>;
export declare function cleanupTestContext(ctx: TestContext | null, cleanup?: (() => Promise<void>) | null): Promise<void>;
export type SseServerState = {
    connected: boolean;
    finished: boolean;
    writeCount: number;
    closed: boolean;
};
export type SseServer = {
    baseUrl: string;
    getState: () => SseServerState;
    close: () => Promise<void>;
};
export declare function createSseServer(): Promise<SseServer>;
export declare function withTimeout<T>({ promise, timeoutMs, errorMessage }: {
    promise: Promise<T>;
    timeoutMs: number;
    errorMessage: string;
}): Promise<T>;
/** Tagged template for inline JS code strings used in MCP execute calls */
export declare function js(strings: TemplateStringsArray, ...values: unknown[]): string;
export declare function tryJsonParse(str: string): any;
/**
 * Safely close a browser connected via connectOverCDP.
 *
 * Playwright's CRConnection uses async message handling (messageWrap) that can cause
 * a race condition where _onClose() runs before all pending _onMessage() handlers complete.
 * This results in "Assertion error" from crConnection.js when a CDP response arrives
 * after callbacks were cleared by dispose().
 *
 * This helper waits for the message queue to drain before closing, avoiding the race.
 *
 * @param browser - Browser instance from chromium.connectOverCDP()
 * @param drainDelayMs - Time to wait for pending messages to be processed (default: 50ms)
 */
export declare function safeCloseCDPBrowser(browser: Awaited<ReturnType<typeof import('playwright-core').chromium.connectOverCDP>>, drainDelayMs?: number): Promise<void>;
export type SimpleServer = {
    baseUrl: string;
    close: () => Promise<void>;
};
/** Minimal local HTTP server for tests that need cross-origin iframes or custom routes */
export declare function createSimpleServer({ routes }: {
    routes: Record<string, string>;
}): Promise<SimpleServer>;
//# sourceMappingURL=test-utils.d.ts.map