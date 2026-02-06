import { appendFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getProjectRoot } from './skill-loader.js';
import type { ChatMessage, Message, ToolMessage } from './llm.js';

export interface LogEntry {
  timestamp: string;
  type: 'openrouter_request' | 'openrouter_response' | 'tool_call' | 'tool_result';
  data: Record<string, unknown>;
}

class Logger {
  private logFile: string = '';
  private initialized = false;

  /**
   * Initialize logger and create logs directory if needed
   */
  init(): void {
    if (this.initialized) {
      return;
    }

    const root = getProjectRoot();
    const logsDir = join(root, 'logs');
    
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }

    this.logFile = join(logsDir, 'agent0.log');
    this.initialized = true;
  }

  /**
   * Write log entry to file (JSON Lines format)
   */
  private log(entry: LogEntry): void {
    if (!this.initialized) {
      return;
    }

    // Use fire-and-forget async write to avoid blocking
    const line = JSON.stringify(entry) + '\n';
    appendFile(this.logFile, line, 'utf-8').catch((error) => {
      // Silently fail - don't break execution if logging fails
      console.error('Logging failed:', error);
    });
  }

  /**
   * Summarize message for logging
   */
  private summarizeMessage(msg: ChatMessage): { role: string; length: number; preview: string } {
    const role = msg.role;
    let content = '';
    
    if (msg.role === 'tool') {
      content = (msg as ToolMessage).content || '';
    } else {
      content = (msg as Message).content || '';
    }

    const length = content.length;
    const maxPreview = role === 'system' ? 500 : 200;
    const preview = length > maxPreview 
      ? content.substring(0, maxPreview) + '...' 
      : content;

    return { role, length, preview };
  }

  /**
   * Summarize messages array
   */
  private summarizeMessages(messages: ChatMessage[]): Array<{ role: string; length: number; preview: string }> {
    return messages.map(msg => this.summarizeMessage(msg));
  }

  /**
   * Log OpenRouter API request
   */
  logOpenRouterRequest(options: {
    model: string;
    temperature: number;
    messages: ChatMessage[];
    tools?: unknown[];
  }): void {
    const { model, temperature, messages, tools } = options;

    this.log({
      timestamp: new Date().toISOString(),
      type: 'openrouter_request',
      data: {
        model,
        temperature,
        message_count: messages.length,
        tool_count: tools?.length || 0,
        messages: this.summarizeMessages(messages),
      },
    });
  }

  /**
   * Log OpenRouter API response
   */
  logOpenRouterResponse(result: {
    model: string;
    content: string | null;
    tool_calls?: Message['tool_calls'];
    finish_reason?: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }): void {
    const { model, content, tool_calls, finish_reason, usage } = result;

    this.log({
      timestamp: new Date().toISOString(),
      type: 'openrouter_response',
      data: {
        model,
        content_length: content?.length || 0,
        tool_calls_count: tool_calls?.length || 0,
        tool_calls: tool_calls?.map(tc => tc.function.name) || [],
        usage: usage ? {
          prompt_tokens: usage.promptTokens,
          completion_tokens: usage.completionTokens,
          total_tokens: usage.totalTokens,
        } : undefined,
        finish_reason,
      },
    });
  }

  /**
   * Log tool call before execution
   */
  logToolCall(name: string, args: Record<string, unknown>): void {
    // Sanitize args for logging
    const sanitizedArgs: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(args)) {
      if (name === 'playwriter_execute' && key === 'code') {
        // Truncate playwriter code to first 300 chars
        const code = String(value);
        sanitizedArgs[key] = code.length > 300 ? code.substring(0, 300) + '...' : code;
      } else if (name === 'read_file' && key === 'path') {
        sanitizedArgs[key] = value; // Keep path
      } else if (name === 'write_file' || name === 'append_file') {
        if (key === 'path') {
          sanitizedArgs[key] = value; // Keep path
        } else if (key === 'content') {
          // Truncate content
          const content = String(value);
          sanitizedArgs[key] = content.length > 200 ? content.substring(0, 200) + '...' : content;
        }
      } else {
        sanitizedArgs[key] = value;
      }
    }

    this.log({
      timestamp: new Date().toISOString(),
      type: 'tool_call',
      data: {
        tool: name,
        args: sanitizedArgs,
      },
    });
  }

  /**
   * Log tool result after execution
   */
  logToolResult(name: string, result: string, durationMs: number, error?: string): void {
    const resultLength = result.length;
    const maxPreview = 300;
    const preview = resultLength > maxPreview 
      ? result.substring(0, maxPreview) + '...' 
      : result;

    this.log({
      timestamp: new Date().toISOString(),
      type: 'tool_result',
      data: {
        tool: name,
        success: !error,
        result_length: resultLength,
        duration_ms: durationMs,
        preview: error ? undefined : preview,
        error: error || undefined,
      },
    });
  }

  /**
   * Log agentic loop iteration
   */
  logIteration(iteration: number, maxIterations: number, hasToolCalls: boolean): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: 'tool_call' as const, // Reuse type for iteration tracking
      data: {
        iteration: `${iteration}/${maxIterations}`,
        has_tool_calls: hasToolCalls,
      },
    });
  }

  /**
   * Log playwriter_execute errors to dedicated error log file
   */
  logPlaywriterError(options: {
    code: string;
    error: string;
    timeout?: number;
    durationMs: number;
    skill?: string;
    context?: string;
  }): void {
    if (!this.initialized) {
      return;
    }

    const root = getProjectRoot();
    const logsDir = join(root, 'logs');
    
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }

    // Create daily error log file: playwriter-errors-YYYY-MM-DD.log
    const today = new Date().toISOString().split('T')[0];
    const errorLogFile = join(logsDir, `playwriter-errors-${today}.log`);

    const entry = {
      timestamp: new Date().toISOString(),
      skill: options.skill || 'unknown',
      context: options.context || 'unknown',
      timeout: options.timeout || 30000,
      duration_ms: options.durationMs,
      code: options.code,
      error: options.error,
    };

    // Write as JSON Lines format (one JSON object per line)
    const line = JSON.stringify(entry) + '\n';
    appendFile(errorLogFile, line, 'utf-8').catch((error) => {
      // Silently fail - don't break execution if logging fails
      console.error('Playwriter error logging failed:', error);
    });
  }
}

// Singleton instance
const logger = new Logger();

/**
 * Initialize logger (call once at startup)
 */
export function initLogger(): void {
  logger.init();
}

/**
 * Log OpenRouter request
 */
export function logOpenRouterRequest(options: {
  model: string;
  temperature: number;
  messages: ChatMessage[];
  tools?: unknown[];
}): void {
  logger.logOpenRouterRequest(options);
}

/**
 * Log OpenRouter response
 */
export function logOpenRouterResponse(result: {
  model: string;
  content: string | null;
  tool_calls?: Message['tool_calls'];
  finish_reason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}): void {
  logger.logOpenRouterResponse(result);
}

/**
 * Log tool call
 */
export function logToolCall(name: string, args: Record<string, unknown>): void {
  logger.logToolCall(name, args);
}

/**
 * Log tool result
 */
export function logToolResult(name: string, result: string, durationMs: number, error?: string): void {
  logger.logToolResult(name, result, durationMs, error);
}

/**
 * Log iteration (for agentic loop tracking)
 */
export function logIteration(iteration: number, maxIterations: number, hasToolCalls: boolean): void {
  logger.logIteration(iteration, maxIterations, hasToolCalls);
}

/**
 * Log playwriter_execute error to dedicated error log
 */
export function logPlaywriterError(options: {
  code: string;
  error: string;
  timeout?: number;
  durationMs: number;
  skill?: string;
  context?: string;
}): void {
  logger.logPlaywriterError(options);
}
