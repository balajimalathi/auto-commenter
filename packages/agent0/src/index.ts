#!/usr/bin/env node

import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { runCLI } from './cli.js';
import { executeScript, loadScript } from './script-executor.js';
import { output } from './ui/output.js';
import { initLogger } from './logger.js';

// Load .env - override host env so project .env takes precedence
const cwd = process.cwd();
const envPaths = [resolve(cwd, '.env'), resolve(cwd, '..', '..', '.env')];
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    config({ path: envPath, override: true });
    break;
  }
}

async function main() {
  // Initialize logger first
  initLogger();

  // Check for script file argument or default script.json
  const args = process.argv.slice(2);
  const scriptIndex = args.indexOf('--script');
  let scriptPath: string | null = null;

  if (scriptIndex !== -1 && args[scriptIndex + 1]) {
    scriptPath = args[scriptIndex + 1];
  } else if (existsSync(resolve(cwd, 'script.json'))) {
    scriptPath = 'script.json';
  }

  // If script found, execute it
  if (scriptPath) {
    try {
      const script = await loadScript(scriptPath);
      await executeScript(script);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      output.error(`Script execution failed: ${errorMessage}`);
      process.exit(1);
    }
  } else {
    // Otherwise, start interactive CLI
    await runCLI();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
