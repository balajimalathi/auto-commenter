import ora, { Ora } from 'ora';
import chalk from 'chalk';

export interface SpinnerInstance {
  start(text?: string): void;
  stop(): void;
  succeed(text?: string): void;
  fail(text?: string): void;
  warn(text?: string): void;
  info(text?: string): void;
  text: string;
}

/**
 * Create a spinner for long operations
 */
export function createSpinner(text: string): SpinnerInstance {
  const spinner = ora({
    text,
    spinner: 'dots',
  });

  return {
    start(newText?: string) {
      if (newText) spinner.text = newText;
      spinner.start();
    },
    stop() {
      spinner.stop();
    },
    succeed(newText?: string) {
      spinner.succeed(newText);
    },
    fail(newText?: string) {
      spinner.fail(newText);
    },
    warn(newText?: string) {
      spinner.warn(newText);
    },
    info(newText?: string) {
      spinner.info(newText);
    },
    get text() {
      return spinner.text;
    },
    set text(value: string) {
      spinner.text = value;
    },
  };
}

/**
 * Progress tracker for batch operations
 */
export class BatchProgress {
  private current = 0;
  private total: number;
  private label: string;
  private startTime: number;
  private spinner: Ora;

  constructor(total: number, label: string) {
    this.total = total;
    this.label = label;
    this.startTime = Date.now();
    this.spinner = ora({
      text: this.formatText(),
      spinner: 'dots',
    });
  }

  private formatText(): string {
    const percentage = Math.round((this.current / this.total) * 100);
    const elapsed = this.formatDuration(Date.now() - this.startTime);
    return `${chalk.cyan(this.label)} ${chalk.bold(`${this.current}/${this.total}`)} (${percentage}%) ${chalk.dim(`[${elapsed}]`)}`;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }

  start(): void {
    this.spinner.start();
  }

  increment(newLabel?: string): void {
    this.current++;
    if (newLabel) this.label = newLabel;
    this.spinner.text = this.formatText();
  }

  update(current: number, newLabel?: string): void {
    this.current = current;
    if (newLabel) this.label = newLabel;
    this.spinner.text = this.formatText();
  }

  complete(message?: string): void {
    const elapsed = this.formatDuration(Date.now() - this.startTime);
    this.spinner.succeed(message || `Completed ${this.total} items in ${elapsed}`);
  }

  fail(message?: string): void {
    this.spinner.fail(message || `Failed at ${this.current}/${this.total}`);
  }
}

/**
 * Countdown timer display
 */
export async function countdown(
  seconds: number,
  message: string
): Promise<void> {
  const spinner = ora({
    text: `${message} (${seconds}s remaining)`,
    spinner: 'dots',
  }).start();

  for (let i = seconds; i > 0; i--) {
    spinner.text = `${message} (${i}s remaining)`;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  spinner.stop();
}

/**
 * Simple delay with optional spinner
 */
export async function delay(
  ms: number,
  message?: string
): Promise<void> {
  if (message) {
    const seconds = Math.ceil(ms / 1000);
    await countdown(seconds, message);
  } else {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}
