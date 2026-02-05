import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Blocky pixel-art octopus
const OCTOPUS = [
  '  █████  ',
  ' ██ █ ██ ',
  '  ██░██  ', 
];

// ▒ ▓ ░  (Different densities)
// ▄ ▀ ▖ ▗ ▘ ▙ ▚ ▛ ▜ ▝ ▞ ▟  (Lock elements)
// ▐ ▌ ▞ ▚ ▰ ▱ ▪ ▫ ▬ ▭ ▮ ▯  (Various blocks)
// ▇ █ ▌ ▐ ▀ ▄ ▉ ▊ ▋ ▌ ▍ ▎ ▏  (More blocks)

const OCTOPUS_WIDTH = 7;

function getVersion(): string {
  try {
    const agent0Root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const pkg = JSON.parse(
      readFileSync(join(agent0Root, 'package.json'), 'utf-8')
    );
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

function getCwd(): string {
  return process.cwd();
}

function renderBanner(version: string, cwd: string): string {
  const title = chalk.bold('Agent0') + chalk.dim(' v' + version);
  const subtitle = chalk.dim('Autonomous CLI · Browser automation');
  const pathLine = chalk.dim(cwd);

  const rightLines = [title, subtitle, pathLine];
  const maxRows = Math.max(OCTOPUS.length, rightLines.length);

  let output = '\n';
  for (let i = 0; i < maxRows; i++) {
    const left = OCTOPUS[i] || ' '.repeat(OCTOPUS_WIDTH);
    const right = rightLines[i] || '';
    const leftColored = chalk.hex('#f97316')(left);
    output += '  ' + leftColored + '  ' + right + '\n';
  }
  output += '\n';
  return output;
}

/**
 * Show banner with octopus, directory path, and version
 */
export function showBanner(): void {
  const version = getVersion();
  const cwd = getCwd();
  process.stdout.write(renderBanner(version, cwd));
}
