import chalk from 'chalk';
import boxen from 'boxen';

export const output = {
  header(title: string): void {
    console.log(
      boxen(chalk.bold.cyan(title), {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
      })
    );
  },

  success(message: string): void {
    console.log(chalk.green('✓'), chalk.green(message));
  },

  error(message: string): void {
    console.log(chalk.red('✗'), chalk.red(message));
  },

  warning(message: string): void {
    console.log(chalk.yellow('⚠'), chalk.yellow(message));
  },

  info(message: string): void {
    console.log(chalk.cyan('ℹ'), chalk.cyan(message));
  },

  dim(message: string): void {
    console.log(chalk.dim(message));
  },

  timestamp(): string {
    return chalk.dim(`[${new Date().toLocaleTimeString()}]`);
  },

  log(message: string): void {
    console.log(`${this.timestamp()} ${message}`);
  },

  step(stepNumber: number, total: number, message: string): void {
    console.log(
      chalk.dim(`[${stepNumber}/${total}]`),
      message
    );
  },

  divider(): void {
    console.log(chalk.dim('─'.repeat(50)));
  },

  comment(text: string, title = 'Proposed Comment'): void {
    console.log(
      boxen(text, {
        title,
        titleAlignment: 'center',
        padding: 1,
        margin: { top: 1, bottom: 1, left: 0, right: 0 },
        borderStyle: 'round',
        borderColor: 'green',
      })
    );
  },

  post(title: string, content: string): void {
    console.log(
      boxen(`${chalk.bold(title)}\n\n${content}`, {
        title: 'Post Preview',
        titleAlignment: 'center',
        padding: 1,
        margin: { top: 1, bottom: 1, left: 0, right: 0 },
        borderStyle: 'round',
        borderColor: 'blue',
      })
    );
  },

  progress(current: number, total: number, label: string): void {
    const percentage = Math.round((current / total) * 100);
    const barLength = 30;
    const filled = Math.round((current / total) * barLength);
    const empty = barLength - filled;
    const bar = chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
    
    process.stdout.write(`\r${bar} ${percentage}% ${chalk.dim(label)}`);
    
    if (current === total) {
      console.log(); // New line when complete
    }
  },

  table(data: Record<string, string | number>[]): void {
    if (data.length === 0) return;
    
    const keys = Object.keys(data[0]);
    const widths = keys.map(k => 
      Math.max(k.length, ...data.map(row => String(row[k]).length))
    );

    // Header
    console.log(
      chalk.bold(
        keys.map((k, i) => k.padEnd(widths[i])).join(' | ')
      )
    );
    console.log(chalk.dim(widths.map(w => '─'.repeat(w)).join('─┼─')));

    // Rows
    data.forEach(row => {
      console.log(
        keys.map((k, i) => String(row[k]).padEnd(widths[i])).join(' | ')
      );
    });
  },

  json(data: unknown): void {
    console.log(chalk.dim(JSON.stringify(data, null, 2)));
  },
};
