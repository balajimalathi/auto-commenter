/**
 * Thin adapter that delegates to playwriter MCP.
 * Playwriter controls the browser via the extension relay (port 19988).
 */

import { createSpinner } from './ui/progress.js';
import * as playwriter from './playwriter-client.js';

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
 * Execute Playwriter/Playwright JavaScript in the browser.
 * Scope: page, state, context, accessibilitySnapshot, getCDPSession, etc.
 */
export async function executeScript(
  code: string,
  timeout = 30000
): Promise<{ text: string; isError?: boolean }> {
  return playwriter.callExecute(code, timeout);
}

/**
 * Reconnect browser/context (call playwriter reset).
 */
export async function callReset(): Promise<void> {
  await playwriter.callReset();
}
