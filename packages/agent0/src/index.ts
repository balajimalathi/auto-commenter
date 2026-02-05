#!/usr/bin/env node

import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { createCLI } from './cli.js';

// Load .env - override host env so project .env takes precedence
const cwd = process.cwd();
const envPaths = [resolve(cwd, '.env'), resolve(cwd, '..', '.env')];
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    config({ path: envPath, override: true });
    break;
  }
}

async function main() {
  const cli = createCLI();
  await cli.parseAsync(process.argv);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
