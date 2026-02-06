import { output } from './ui/output.js';
import { loadSkill, loadResource, type Skill } from './skill-loader.js';
import { readMemory } from './memory.js';
import { runAgenticLoop } from './llm.js';
import { connectBrowser, closeBrowser } from './browser.js';
import { loadPlatformInstructions } from './modes/instructions/index.js';

export type AgentMode = 'batch' | 'commenter' | 'notifications' | 'trending' | 'post';

export interface ModeContext {
  target?: string;
  count?: number;
  trackingSummary?: string;
  [key: string]: string | number | undefined;
}

/**
 * Build the system prompt for a given mode
 */
async function buildSystemPrompt(
  skill: Skill,
  mode: AgentMode,
  skillContent: string,
  batchContent: string | null,
  memory: string,
  personalization: string | null,
  product: string | null,
  playwriterSnippets: string | null,
  modeContext?: ModeContext
): Promise<string> {
  const baseToolsSection = `## Available Tools
You have access to these tools. Use them to accomplish the task:
- read_file: Read files (skill instructions, tracking, personalization, target rules, memory)
- write_file, append_file: Update tracking files, leads, memory
- list_dir: Discover files
- playwriter_execute: Execute Playwriter JavaScript in the browser. ALWAYS use the exact snippets from the "Playwriter Snippets" section below. Do NOT use accessibilitySnapshot. Use user-defined selectors (e.g. await page.click('comment-composer-host')). Scope: page, state, context.`;

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
(Use read_file to load .claude/skills/${skill.name}/resources/personalization_${skill.platform}.md)`;

  const productSection = product
    ? `## Product Info
${product}`
    : '';

  // Load platform-specific instructions dynamically
  const platformInstructions = await loadPlatformInstructions(skill.platform);
  
  // Get mode-specific instructions
  let modeInstructions = '';
  switch (mode) {
    case 'batch':
      modeInstructions = platformInstructions.batch(skill, batchContent, modeContext);
      break;
    case 'commenter':
      modeInstructions = platformInstructions.commenter(skill);
      break;
    case 'notifications':
      modeInstructions = platformInstructions.notifications(skill);
      break;
    case 'trending':
      modeInstructions = platformInstructions.trending(skill, modeContext);
      break;
    case 'post':
      modeInstructions = platformInstructions.post(skill);
      break;
  }

  return `You are Agent0, an autonomous agent executing ${skill.platform} engagement tasks.

${baseToolsSection}

${playwriterSnippetsSection}

${modeInstructions}

${skillSection}

${memorySection}

${personalizationSection}

${productSection}

${projectStructure}

## Critical Rules
1. Follow the skill workflow and personalization guidelines exactly
2. Update tracking after each action
3. Log actions to memory
4. Be autonomous - complete the full task without asking questions
5. If something fails, log the error and try an alternative approach
6. Report what you accomplished when done
7. In commenter mode: ONLY write comments on existing posts. Open the post first, then use playwriter_execute to submit the comment.`;
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
    const personalization = await loadResource(skill, `personalization_${skill.platform}`);
    const product = await loadResource(skill, 'product');
    const playwriterSnippets = await loadResource(skill, 'playwriter_snippets');

    // Build mode-specific system prompt
    const systemPrompt = await buildSystemPrompt(
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
    // batch: full quota across all targets (~6-7 iterations per comment x total comments)
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
  const skill = await loadSkill(skillName);
  return runWithToolCalling(
    skillName,
    'batch',
    `Fill today's quota according to BATCH.md. Check tracking/${skill.platform}/${today}.md for current status.`,
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
  const skill = await loadSkill(skillName);
  const platformLabel = skill.platform === 'reddit' ? 'Reddit' : skill.platform === 'twitter' ? 'X/Twitter' : skill.platform;
  return runWithToolCalling(
    skillName,
    'notifications',
    `Check ${platformLabel} notifications and respond to any replies that need attention.`
  );
}

export async function runTrendingWithToolCalling(
  skillName: string,
  target?: string
): Promise<string> {
  const skill = await loadSkill(skillName);
  const platformLabel = skill.platform === 'reddit' ? 'posts' : skill.platform === 'twitter' ? 'tweets' : 'content';
  const prompt = target
    ? `Find trending ${platformLabel} in ${skill.platform === 'reddit' ? `r/${target}` : target} and analyze what's popular.`
    : `Find trending content across configured targets and compile a summary.`;
  
  return runWithToolCalling(skillName, 'trending', prompt, { target });
}

export async function runPostWithToolCalling(
  skillName: string,
  content: string
): Promise<string> {
  return runWithToolCalling(skillName, 'post', `Write and post: ${content}`);
}
