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
 * Supports infinite wait when timeoutMs is 0
 */
export async function confirmWithTimeout(
  options: ConfirmOptions
): Promise<boolean> {
  const { message, timeoutMs = 0, defaultValue = false } = options;
  const infiniteWait = timeoutMs === 0;

  return new Promise((resolve) => {
    let resolved = false;
    let countdown = infiniteWait ? 0 : Math.ceil(timeoutMs / 1000);
    let interval: NodeJS.Timeout | null = null;
    let timeout: NodeJS.Timeout | null = null;

    // Cleanup function
    const cleanup = () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
        process.stdin.removeAllListeners('data');
      }
    };

    // Handle Ctrl+C (SIGINT)
    const handleSigInt = () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        console.log('\n\nOperation cancelled.');
        process.exit(0);
      }
    };
    process.on('SIGINT', handleSigInt);

    // Start countdown display (only if not infinite wait)
    if (!infiniteWait) {
      interval = setInterval(() => {
        countdown--;
        if (countdown > 0 && !resolved) {
          process.stdout.write(
            `\r${message} (auto-${defaultValue ? 'approve' : 'reject'} in ${countdown}s) [y/n/Ctrl+C] `
          );
        }
      }, 1000);
    }

    // Auto-resolve after timeout (only if not infinite wait)
    if (!infiniteWait) {
      timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          process.removeListener('SIGINT', handleSigInt);
          console.log(`\n${defaultValue ? '✓ Auto-approved' : '✗ Auto-rejected'}`);
          resolve(defaultValue);
        }
      }, timeoutMs);
    }

    // Initial prompt
    const promptText = infiniteWait
      ? `${message} [y/n/Ctrl+C] `
      : `${message} (auto-${defaultValue ? 'approve' : 'reject'} in ${countdown}s) [y/n/Ctrl+C] `;
    process.stdout.write(promptText);

    // Listen for input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      const dataHandler = (data: Buffer) => {
        if (resolved) return;

        const key = data.toString();
        
        // Handle Ctrl+C
        if (key === '\x03') {
          resolved = true;
          cleanup();
          process.removeListener('SIGINT', handleSigInt);
          console.log('\n\nOperation cancelled.');
          process.exit(0);
          return;
        }

        // Handle Enter key
        if (key === '\r' || key === '\n') {
          resolved = true;
          cleanup();
          process.removeListener('SIGINT', handleSigInt);
          console.log('\n✓ Approved');
          resolve(true);
          return;
        }

        // Handle y/Y
        if (key.toLowerCase() === 'y') {
          resolved = true;
          cleanup();
          process.removeListener('SIGINT', handleSigInt);
          console.log('\n✓ Approved');
          resolve(true);
          return;
        }

        // Handle n/N
        if (key.toLowerCase() === 'n') {
          resolved = true;
          cleanup();
          process.removeListener('SIGINT', handleSigInt);
          console.log('\n✗ Rejected');
          resolve(false);
          return;
        }

        // Ignore other keys (don't resolve, keep waiting)
      };

      process.stdin.on('data', dataHandler);
    } else {
      // Non-TTY: if infinite wait, this will hang forever (expected)
      // If timeout, wait for timeout
      if (!infiniteWait && timeout) {
        // Already set up above
      } else if (infiniteWait) {
        // Non-TTY with infinite wait - this is problematic, but we'll let it hang
        // User should configure a timeout for non-TTY environments
      }
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
