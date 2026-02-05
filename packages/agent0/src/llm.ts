import { createSpinner } from './ui/progress.js';
import {
  getToolDefinitions,
  executeTool,
  CommentPostError,
  type ToolContext,
  type ToolDefinition,
} from './tools.js';
import { getProjectRoot, type Skill } from './skill-loader.js';

export type ModelTask = 'summarize' | 'comment' | 'review' | 'analyze' | 'general';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

export interface ToolMessage {
  role: 'tool';
  tool_call_id: string;
  content: string;
}

export interface LLMConfig {
  apiKey: string;
  models: Record<ModelTask, string>;
  temperatures: Record<ModelTask, number>;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Get LLM configuration from environment
 */
export function getLLMConfig(): LLMConfig {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set in environment');
  }

  return {
    apiKey,
    models: {
      summarize: process.env.OPENROUTER_MODEL_SUMMARIZE || 'deepseek/deepseek-chat',
      comment: process.env.OPENROUTER_MODEL_COMMENT || 'x-ai/grok-2',
      review: process.env.OPENROUTER_MODEL_REVIEW || 'anthropic/claude-3.5-sonnet',
      analyze: process.env.OPENROUTER_MODEL_SUMMARIZE || 'deepseek/deepseek-chat',
      general: process.env.OPENROUTER_MODEL_COMMENT || 'x-ai/grok-2',
    },
    temperatures: {
      summarize: parseFloat(process.env.OPENROUTER_TEMPERATURE_SUMMARIZE || '0.2'),
      comment: parseFloat(process.env.OPENROUTER_TEMPERATURE_COMMENT || '0.7'),
      review: parseFloat(process.env.OPENROUTER_TEMPERATURE_REVIEW || '0.3'),
      analyze: parseFloat(process.env.OPENROUTER_TEMPERATURE_SUMMARIZE || '0.2'),
      general: parseFloat(process.env.OPENROUTER_TEMPERATURE_COMMENT || '0.7'),
    },
  };
}

export type ChatMessage = Message | ToolMessage;

/**
 * Serialize ChatMessage[] to OpenRouter API format
 */
function serializeMessages(messages: ChatMessage[]): object[] {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: (m as ToolMessage).tool_call_id,
        content: (m as ToolMessage).content,
      };
    }
    const base = { role: m.role, content: (m as Message).content ?? '' };
    if ((m as Message).tool_calls) {
      return { ...base, tool_calls: (m as Message).tool_calls };
    }
    return base;
  });
}

interface CallOpenRouterOptions {
  model: string;
  temperature: number;
  tools?: ToolDefinition[];
  messages: ChatMessage[];
}

interface CallOpenRouterResult {
  content: string | null;
  tool_calls?: Message['tool_calls'];
  finish_reason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Single OpenRouter API call - used by both callLLM and callLLMRaw
 */
async function callOpenRouter(options: CallOpenRouterOptions): Promise<CallOpenRouterResult> {
  const { model, temperature, messages, tools } = options;
  const config = getLLMConfig();

  const body: Record<string, unknown> = {
    model,
    messages: serializeMessages(messages),
    temperature,
    max_tokens: 4096,
  };
  if (tools) {
    body.tools = tools;
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      'X-Title': 'Agent0',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const msg = data.choices[0]?.message;

  return {
    content: msg?.content ?? null,
    tool_calls: msg?.tool_calls,
    finish_reason: data.choices[0]?.finish_reason,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  };
}

/**
 * Call LLM via OpenRouter
 */
export async function callLLM(
  messages: Message[],
  task: ModelTask = 'general',
  showSpinner = true
): Promise<LLMResponse> {
  const config = getLLMConfig();
  const model = config.models[task];
  const temperature = config.temperatures[task];

  const spinner = showSpinner ? createSpinner(`Thinking (${task})...`) : null;
  spinner?.start();

  try {
    const result = await callOpenRouter({ model, temperature, messages });
    spinner?.succeed(`Done (${task})`);
    return {
      content: result.content ?? '',
      model,
      usage: result.usage,
    };
  } catch (error) {
    spinner?.fail(`Failed (${task})`);
    throw error;
  }
}

/**
 * Generate a comment for a Reddit post
 */
export async function generateComment(
  postContent: string,
  personalization: string,
  subredditRules: string,
  memory: string
): Promise<string> {
  const messages: Message[] = [
    {
      role: 'system',
      content: `You are writing a Reddit comment. Follow the personalization guide exactly to match the user's writing style.

## Personalization Guide
${personalization}

## Subreddit Context
${subredditRules}

## Recent Activity (for context)
${memory}

Write a comment that:
1. Sounds natural and matches the user's style
2. Provides real value to the discussion
3. Follows subreddit rules
4. Is NOT promotional unless highly relevant
5. Is concise but helpful

Output ONLY the comment text, nothing else.`,
    },
    {
      role: 'user',
      content: `Write a comment for this post:\n\n${postContent}`,
    },
  ];

  const response = await callLLM(messages, 'comment');
  return response.content.trim();
}

/**
 * Analyze a post to determine if it's worth commenting on
 */
export async function analyzePost(
  postContent: string,
  subredditContext: string
): Promise<{
  worthCommenting: boolean;
  reason: string;
  suggestedAngle: string;
}> {
  const messages: Message[] = [
    {
      role: 'system',
      content: `Analyze this Reddit post and determine if it's worth commenting on.

## Subreddit Context
${subredditContext}

Respond in JSON format:
{
  "worthCommenting": true/false,
  "reason": "brief explanation",
  "suggestedAngle": "how to approach the comment if worth commenting"
}`,
    },
    {
      role: 'user',
      content: postContent,
    },
  ];

  const response = await callLLM(messages, 'analyze');
  
  try {
    // Try to parse JSON from response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fall back to defaults
  }

  return {
    worthCommenting: true,
    reason: 'Could not analyze',
    suggestedAngle: 'Provide helpful insight',
  };
}

/**
 * Review a comment against personalization checklist
 */
export async function reviewComment(
  comment: string,
  personalization: string,
  postContext: string
): Promise<{
  approved: boolean;
  issues: string[];
  revisedComment?: string;
}> {
  const messages: Message[] = [
    {
      role: 'system',
      content: `Review this Reddit comment against the personalization guide.

## Personalization Guide
${personalization}

## Post Context
${postContext}

Check:
1. Does it match the user's writing style?
2. Is it natural and not robotic?
3. Does it provide value?
4. Is it appropriate for the context?

Respond in JSON format:
{
  "approved": true/false,
  "issues": ["list", "of", "issues"],
  "revisedComment": "only if not approved, provide revised version"
}`,
    },
    {
      role: 'user',
      content: `Comment to review:\n\n${comment}`,
    },
  ];

  const response = await callLLM(messages, 'review');
  
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fall back
  }

  return {
    approved: true,
    issues: [],
  };
}

/**
 * Summarize post content
 */
export async function summarizePost(postContent: string): Promise<string> {
  const messages: Message[] = [
    {
      role: 'system',
      content: 'Summarize this Reddit post in 1-2 sentences. Focus on what the poster is asking or discussing.',
    },
    {
      role: 'user',
      content: postContent,
    },
  ];

  const response = await callLLM(messages, 'summarize');
  return response.content.trim();
}

/**
 * Check if a user might be a lead based on their post
 */
export async function checkForLead(
  postContent: string,
  productInfo: string
): Promise<{
  isLead: boolean;
  relevance: 'high' | 'medium' | 'low';
  reason: string;
}> {
  const messages: Message[] = [
    {
      role: 'system',
      content: `Determine if this Reddit user might be a potential lead for the product.

## Product Info
${productInfo}

Respond in JSON format:
{
  "isLead": true/false,
  "relevance": "high" | "medium" | "low",
  "reason": "brief explanation"
}`,
    },
    {
      role: 'user',
      content: postContent,
    },
  ];

  const response = await callLLM(messages, 'analyze');
  
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fall back
  }

  return {
    isLead: false,
    relevance: 'low',
    reason: 'Could not analyze',
  };
}

// --- Tool Calling (Agentic Loop) ---

/**
 * Format a short detail string for a tool call to show in the spinner.
 */
function formatToolDetail(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'browser_navigate':
      return args.url ? ` -> ${args.url}` : '';
    case 'read_file':
    case 'write_file':
    case 'append_file':
    case 'list_dir':
      return args.path ? ` (${args.path})` : '';
    case 'browser_click':
    case 'browser_type':
      return args.selector ? ` (${args.selector})` : '';
    case 'browser_submit_reddit_comment':
      return ' (posting comment)';
    case 'request_approval':
      return args.content_type ? ` (${args.content_type})` : '';
    default:
      return '';
  }
}

export interface AgenticLoopOptions {
  skill?: Skill;
  maxIterations?: number;
  model?: string;
  temperature?: number;
  showSpinner?: boolean;
}

/**
 * Trim old tool results in the message chain to prevent context bloat.
 * Keeps the system + user messages and the last `keepRecent` iterations intact.
 * Older tool results are replaced with a short summary.
 */
function trimMessageContext(messages: ChatMessage[], keepRecent: number = 2): void {
  // Find the boundary: we keep system, user, and the last N assistant+tool groups
  // Count assistant messages from the end to find the cutoff
  let assistantCount = 0;
  let cutoffIdx = messages.length;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      assistantCount++;
      if (assistantCount >= keepRecent) {
        cutoffIdx = i;
        break;
      }
    }
  }

  // Truncate tool messages before the cutoff (but keep system/user/assistant structure)
  for (let i = 0; i < cutoffIdx; i++) {
    const msg = messages[i];
    if (msg.role === 'tool' && (msg as ToolMessage).content.length > 200) {
      (msg as ToolMessage).content = (msg as ToolMessage).content.substring(0, 150) + '\n...[trimmed for context]';
    }
  }
}

/**
 * Call LLM with tools and handle tool_calls in response
 */
async function callLLMRaw(
  messages: ChatMessage[],
  tools: ReturnType<typeof getToolDefinitions>,
  options: { model: string; temperature: number }
): Promise<{
  content: string | null;
  tool_calls?: Message['tool_calls'];
  finish_reason?: string;
}> {
  return callOpenRouter({
    model: options.model,
    temperature: options.temperature,
    messages,
    tools,
  });
}

/**
 * Run agentic loop: LLM + tools until done or max iterations
 */
export async function runAgenticLoop(
  systemPrompt: string,
  userPrompt: string,
  options: AgenticLoopOptions = {}
): Promise<string> {
  const {
    skill,
    maxIterations = 15,
    showSpinner = true,
  } = options;

  const config = getLLMConfig();
  const model = options.model ?? config.models.general;
  const temperature = options.temperature ?? config.temperatures.general;

  const tools = getToolDefinitions();
  const toolContext: ToolContext = {
    skill,
    projectRoot: getProjectRoot(),
  };

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const spinner = showSpinner ? createSpinner('Agent thinking...') : null;
  let lastContent = '';

  for (let i = 0; i < maxIterations; i++) {
    spinner?.start(`Step ${i + 1}/${maxIterations}`);

    let result: Awaited<ReturnType<typeof callLLMRaw>>;
    try {
      result = await callLLMRaw(messages, tools, { model, temperature });
    } catch (error) {
      // Retry once on transient failures (network errors, timeouts)
      const errMsg = error instanceof Error ? error.message : String(error);
      spinner?.warn(`LLM call failed: ${errMsg} — retrying...`);
      try {
        result = await callLLMRaw(messages, tools, { model, temperature });
      } catch (retryError) {
        const retryMsg = retryError instanceof Error ? retryError.message : String(retryError);
        spinner?.fail(`LLM call failed after retry: ${retryMsg}`);
        throw new Error(`LLM API failed: ${retryMsg}`);
      }
    }

    if (result.content) {
      lastContent = result.content;
    }

    if (!result.tool_calls || result.tool_calls.length === 0) {
      spinner?.succeed('Done');
      return lastContent || '(No response)';
    }

    const toolNames = result.tool_calls.map(tc => tc.function.name).join(', ');
    spinner?.start(`Executing ${result.tool_calls.length} tool(s): ${toolNames}`);

    const assistantMsg: Message = {
      role: 'assistant',
      content: result.content,
      tool_calls: result.tool_calls,
    };
    messages.push(assistantMsg);

    let anyToolFailed = false;

    for (let tIdx = 0; tIdx < result.tool_calls.length; tIdx++) {
      const tc = result.tool_calls[tIdx];
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || '{}');
      } catch {
        args = {};
      }

      const detail = formatToolDetail(tc.function.name, args);
      spinner?.start(
        `[${tIdx + 1}/${result.tool_calls.length}] ${tc.function.name}${detail}`
      );

      let toolResult: string;
      try {
        toolResult = await executeTool(tc.function.name, args, toolContext);
      } catch (error) {
        if (error instanceof CommentPostError) {
          spinner?.fail(`Comment posting failed: ${error.message}`);
          throw error;
        }
        throw error;
      }

      // Check for non-fatal errors in tool result
      try {
        const parsed = JSON.parse(toolResult);
        if (parsed.error) {
          spinner?.fail(`Tool "${tc.function.name}" error: ${parsed.error}`);
          anyToolFailed = true;
        }
      } catch {
        // Not JSON — normal content, no error to check
      }

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: toolResult,
      });
    }

    if (anyToolFailed) {
      spinner?.warn(`Tools executed (with errors): ${toolNames}`);
    } else {
      spinner?.succeed(`Tools executed: ${toolNames}`);
    }

    // Trim old tool results to prevent context bloat on subsequent LLM calls
    trimMessageContext(messages);
  }

  spinner?.warn('Max iterations reached');
  return lastContent || '(Max iterations reached)';
}
