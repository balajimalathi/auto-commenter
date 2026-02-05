import * as p from '@clack/prompts';
import { output } from './output.js';

export interface ConfirmOptions {
  message: string;
  timeoutMs?: number;
  defaultValue?: boolean;
}

export interface SelectOption<T> {
  value: T;
  label: string;
  hint?: string;
}

/**
 * Confirm with optional auto-approve timeout
 */
export async function confirmWithTimeout(
  options: ConfirmOptions
): Promise<boolean> {
  const { message, timeoutMs = 5000, defaultValue = true } = options;

  return new Promise((resolve) => {
    let resolved = false;
    let countdown = Math.ceil(timeoutMs / 1000);

    // Start countdown display
    const interval = setInterval(() => {
      countdown--;
      if (countdown > 0 && !resolved) {
        process.stdout.write(
          `\r${message} (auto-${defaultValue ? 'approve' : 'reject'} in ${countdown}s) [y/n] `
        );
      }
    }, 1000);

    // Auto-resolve after timeout
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        clearInterval(interval);
        console.log(`\n${defaultValue ? '✓ Auto-approved' : '✗ Auto-rejected'}`);
        resolve(defaultValue);
      }
    }, timeoutMs);

    // Initial prompt
    process.stdout.write(
      `${message} (auto-${defaultValue ? 'approve' : 'reject'} in ${countdown}s) [y/n] `
    );

    // Listen for immediate input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.once('data', (data) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          clearInterval(interval);
          process.stdin.setRawMode(false);
          
          const key = data.toString().toLowerCase();
          if (key === 'y' || key === '\r' || key === '\n') {
            console.log('\n✓ Approved');
            resolve(true);
          } else if (key === 'n') {
            console.log('\n✗ Rejected');
            resolve(false);
          } else if (key === '\x03') { // Ctrl+C
            console.log('\n');
            process.exit(0);
          } else {
            // Any other key, treat as confirm
            console.log('\n✓ Approved');
            resolve(true);
          }
        }
      });
    } else {
      // Non-TTY: just wait for timeout
    }
  });
}

/**
 * Simple confirm without timeout
 */
export async function confirm(message: string): Promise<boolean> {
  const result = await p.confirm({ message });
  
  if (p.isCancel(result)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }
  
  return result;
}

/**
 * Select from options
 */
export async function select<T>(
  message: string,
  options: SelectOption<T>[]
): Promise<T> {
  const result = await p.select({
    message,
    options,
  });

  if (p.isCancel(result)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  return result as T;
}

/**
 * Multi-select from options
 */
export async function multiSelect<T>(
  message: string,
  options: SelectOption<T>[]
): Promise<T[]> {
  const result = await p.multiselect({
    message,
    options,
    required: true,
  });

  if (p.isCancel(result)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  return result as T[];
}

/**
 * Text input
 */
export async function text(
  message: string,
  placeholder?: string
): Promise<string> {
  const result = await p.text({
    message,
    placeholder,
    validate: (value) => {
      if (!value.trim()) return 'Input is required';
      return undefined;
    },
  });

  if (p.isCancel(result)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  return result as string;
}

/**
 * Show error recovery options
 */
export async function errorRecovery(
  errorMessage: string
): Promise<'retry' | 'skip' | 'stop'> {
  output.error(errorMessage);
  
  return select('How would you like to proceed?', [
    { value: 'retry' as const, label: 'Retry', hint: 'Try the operation again' },
    { value: 'skip' as const, label: 'Skip', hint: 'Skip this item and continue' },
    { value: 'stop' as const, label: 'Stop', hint: 'Stop the operation' },
  ]);
}
