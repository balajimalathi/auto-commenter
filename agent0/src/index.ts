#!/usr/bin/env node

import { config } from 'dotenv';
import { resolve } from 'path';
import { createCLI } from './cli.js';

// Load .env from project root
config({ path: resolve(process.cwd(), '.env') });

async function main() {
  const cli = createCLI();
  await cli.parseAsync(process.argv);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
