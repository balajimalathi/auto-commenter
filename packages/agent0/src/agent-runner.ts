import { output } from './ui/output.js';
import { loadSkill, loadResource, type Skill } from './skill-loader.js';
import { readMemory } from './memory.js';
import { runAgenticLoop } from './llm.js';
import { connectBrowser, closeBrowser } from './browser.js';

export type AgentMode = 'batch' | 'commenter' | 'notifications' | 'trending' | 'post';

export interface ModeContext {
  subreddit?: string;
  count?: number;
  trackingSummary?: string;
  [key: string]: string | number | undefined;
}

/**
 * Build the system prompt for a given mode
 */
function buildSystemPrompt(
  skill: Skill,
  mode: AgentMode,
  skillContent: string,
  batchContent: string | null,
  memory: string,
  personalization: string | null,
  product: string | null,
  playwriterSnippets: string | null,
  modeContext?: ModeContext
): string {
  const baseToolsSection = `## Available Tools
You have access to these tools. Use them to accomplish the task:
- read_file: Read files (skill instructions, tracking, personalization, subreddit rules, memory)
- write_file, append_file: Update tracking files, leads, memory
- list_dir: Discover files
- playwriter_execute: Execute Playwriter JavaScript in the browser. ALWAYS use the exact snippets from the "Playwriter Snippets" section below. Do NOT use accessibilitySnapshot. Use user-defined selectors (e.g. await page.click('comment-composer-host')). Scope: page, state, context.
- request_approval: Request human approval before posting (required before any comment/post submission)`;

  const playwriterSnippetsSection = playwriterSnippets
    ? `## Playwriter Snippets (use these exact patterns)
${playwriterSnippets}`
    : '';

  const projectStructure = `## Project Structure
- Skills: .claude/skills/${skill.name}/
- Tracking: tracking/${skill.platform}/YYYY-MM-DD.md
- Leads: leads/${skill.platform}.md
- Memory: .claude/skills/${skill.name}/memory.md`;

  const skillSection = `## Skill Workflow (Reference)
${skillContent}`;

  const memorySection = `## Memory (Recent Activity)
${memory}`;

  const personalizationSection = personalization
    ? `## Personalization Guide
${personalization}`
    : `## Personalization
(Use read_file to load .claude/skills/${skill.name}/resources/personalization_reddit.md)`;

  const productSection = product
    ? `## Product Info
${product}`
    : '';

  // Mode-specific instructions
  let modeInstructions = '';
  
  switch (mode) {
    case 'batch':
      modeInstructions = `## Batch Mode Instructions
${batchContent || 'Fill today\'s quota according to the skill workflow.'}

Your task:
1. Read today's tracking file (tracking/${skill.platform}/YYYY-MM-DD.md) to see current progress
2. Identify subreddits that haven't reached their daily limit
3. For each subreddit with remaining quota:
   - Use playwriter_execute with Navigation snippet: await page.goto('https://www.reddit.com/r/{subreddit}/new/', ...)
   - Use playwriter_execute with Extract Reddit Posts snippet to get posts
   - Select a suitable post to comment on
   - Navigate to the post URL via playwriter_execute
   - Use playwriter_execute with Get Page Text snippet to read post content
   - Generate a helpful, natural comment following personalization guidelines
   - IMPORTANT: Call request_approval with the proposed comment before posting
   - If approved, use playwriter_execute: await page.click('comment-composer-host'), then type and submit
   - Update tracking file with the new comment
   - Update memory with the action
   - After completing 3 comments for a subreddit (or if no suitable posts), move to the next subreddit
4. Respect delays between comments (wait 2-5 minutes between comments)
5. CRITICAL: Continue through ALL subreddits until:
   - All subreddits have reached their quota (3 comments each), OR
   - There are no suitable posts left in any subreddit
6. Report progress after each subreddit completion

${modeContext?.trackingSummary ? `Current tracking summary:\n${modeContext.trackingSummary}` : ''}`;
      break;

    case 'commenter':
      modeInstructions = `## Commenter Mode Instructions
CRITICAL: Commenter writes COMMENTS on EXISTING posts. NEVER create a new post. Do NOT click "Create Post" or similar. You are replying to others' content, not publishing your own.

Your task: Write comments on existing posts based on the user's instruction.

Workflow for each comment (use exact snippets from Playwriter Snippets section):
1. Parse the instruction: which subreddit (r/X), how many comments
2. Use playwriter_execute with Navigation snippet: await page.goto('https://www.reddit.com/r/{subreddit}/new/', ...)
3. Use playwriter_execute with Scroll snippet if needed
4. Use playwriter_execute with Extract Reddit Posts snippet to get posts
5. Select ONE post to comment on (pick one with good engagement potential)
6. Use playwriter_execute to open the post (navigate to URL)
7. On the post page: use playwriter_execute with Get Page Text snippet to read content
8. Write a helpful, natural comment that replies to that specific post (following personalization guidelines)
9. Call request_approval with content_type="comment" and your proposed comment text
10. If approved: use playwriter_execute: await page.click('comment-composer-host'), then use Type into Input snippet, then submit
11. Update tracking and memory
12. If the user's instruction requests multiple comments, repeat steps 2–11 until you have successfully posted that exact number of comments (or there are no suitable posts left).`;
      break;

    case 'notifications':
      modeInstructions = `## Notifications Mode Instructions
Your task: Check Reddit notifications and respond to any replies.

Workflow (use exact snippets from Playwriter Snippets section):
1. Use playwriter_execute with Navigation snippet: await page.goto('https://www.reddit.com/message/inbox/', ...)
2. Use playwriter_execute with Get Page Text snippet to read notifications
3. Identify any replies to your comments that need responses
4. For each reply that warrants a response:
   - Read the context (original post, your comment, their reply)
   - Generate a thoughtful, helpful response
   - IMPORTANT: Call request_approval with the proposed reply before posting
   - If approved, use playwriter_execute with Click by Selector snippet, then Type into Input snippet
   - Update memory with the interaction
5. Mark notifications as read if possible via playwriter_execute
6. Report what notifications you handled`;
      break;

    case 'trending':
      modeInstructions = `## Trending Mode Instructions
Your task: Find trending posts for inspiration or reposting opportunities.

Workflow (use exact snippets from Playwriter Snippets section):
1. Use playwriter_execute with Navigation snippet: await page.goto('https://www.reddit.com/r/{subreddit}/hot/', ...) or /rising/
2. Use playwriter_execute with Extract Reddit Posts snippet to get post data
3. For each interesting post:
   - Note the title, engagement level, topic
   - Analyze why it's trending (topic relevance, timing, format)
4. Compile a summary of trending topics and post ideas
5. Optionally save the summary to a file (trending_{subreddit}_{date}.md)
6. Return the trending analysis to the user

${modeContext?.subreddit ? `Target subreddit: r/${modeContext.subreddit}` : 'Check multiple subreddits from the subreddits.md resource.'}`;
      break;

    case 'post':
      modeInstructions = `## Post Mode Instructions
Your task: Draft and publish a new post based on the user's instruction.

Workflow (use exact snippets from Playwriter Snippets section):
1. Parse the instruction to understand: which subreddit, what topic/content
2. Read subreddit rules for the target subreddit
3. Draft the post title and content following:
   - Subreddit rules and culture
   - Personalization guidelines
   - The user's intent
4. IMPORTANT: Call request_approval with the full draft (title + content) before posting
5. If approved:
   - Use playwriter_execute with Navigation snippet to go to the subreddit
   - Use playwriter_execute with Click by Selector and Type into Input snippets to fill and submit
6. Update memory with the post details
7. Report the post URL or any issues`;
      break;
  }

  return `You are Agent0, an autonomous agent executing Reddit engagement tasks.

${baseToolsSection}

${playwriterSnippetsSection}

${modeInstructions}

${skillSection}

${memorySection}

${personalizationSection}

${productSection}

${projectStructure}

## Critical Rules
1. ALWAYS call request_approval before posting any comment, reply, or post
2. Follow the skill workflow and personalization guidelines exactly
3. Update tracking after each action
4. Log actions to memory
5. Be autonomous - complete the full task without asking questions
6. If something fails, log the error and try an alternative approach
7. Report what you accomplished when done
8. In commenter mode: ONLY write comments on existing posts. Open the post first, call request_approval, then use playwriter_execute to submit the comment.`;
}

/**
 * Run a mode with tool calling
 * This is the central execution engine for all modes
 */
export async function runWithToolCalling(
  skillName: string,
  mode: AgentMode,
  userPrompt: string,
  modeContext?: ModeContext
): Promise<string> {
  output.header(`Agent0 ${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode`);

  try {
    // Load skill and resources
    const skill = await loadSkill(skillName);
    output.success(`Loaded skill: ${skill.name}`);

    const skillContent = skill.skillContent;
    const batchContent = skill.batchContent;
    const memory = await readMemory(skill);
    const personalization = await loadResource(skill, 'personalization_reddit');
    const product = await loadResource(skill, 'product');
    const playwriterSnippets = await loadResource(skill, 'playwriter_snippets');

    // Build mode-specific system prompt
    const systemPrompt = buildSystemPrompt(
      skill,
      mode,
      skillContent,
      batchContent,
      memory,
      personalization,
      product,
      playwriterSnippets,
      modeContext
    );

    output.info(`Instruction: ${userPrompt}`);
    output.divider();

    // Connect browser (required for playwriter_execute)
    await connectBrowser();

    // Mode-appropriate iteration limits:
    // commenter: multi-comment runs (~8-10 iterations per comment)
    // batch: full quota across all subreddits (~6-7 iterations per comment x 33 comments)
    // notifications: focused tasks
    // trending/post: moderate complexity
    const maxIterationsMap: Record<AgentMode, number> = {
      commenter: 30,
      notifications: 10,
      trending: 8,
      post: 10,
      batch: 250,
    };

    // Run the agentic loop
    const result = await runAgenticLoop(systemPrompt, userPrompt, {
      skill,
      maxIterations: maxIterationsMap[mode],
      showSpinner: true,
    });

    output.divider();
    output.success('Task completed');
    console.log(result);

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    output.error(`${mode} mode failed: ${errorMessage}`);
    throw error;
  } finally {
    await closeBrowser();
  }
}

/**
 * Convenience functions for each mode
 */
export async function runBatchWithToolCalling(
  skillName: string,
  trackingSummary?: string
): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  return runWithToolCalling(
    skillName,
    'batch',
    `Fill today's quota according to BATCH.md. Check tracking/reddit/${today}.md for current status.`,
    { trackingSummary }
  );
}

export async function runCommenterWithToolCalling(
  skillName: string,
  instruction: string
): Promise<string> {
  return runWithToolCalling(skillName, 'commenter', instruction);
}

export async function runNotificationsWithToolCalling(
  skillName: string
): Promise<string> {
  return runWithToolCalling(
    skillName,
    'notifications',
    'Check Reddit notifications and respond to any replies that need attention.'
  );
}

export async function runTrendingWithToolCalling(
  skillName: string,
  subreddit?: string
): Promise<string> {
  const prompt = subreddit
    ? `Find trending posts in r/${subreddit} and analyze what's popular.`
    : 'Find trending posts across configured subreddits and compile a summary.';
  
  return runWithToolCalling(skillName, 'trending', prompt, { subreddit });
}

export async function runPostWithToolCalling(
  skillName: string,
  content: string
): Promise<string> {
  return runWithToolCalling(skillName, 'post', `Write and post: ${content}`);
}
