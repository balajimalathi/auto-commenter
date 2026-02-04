import { output } from '../ui/output.js';
import { loadSkill, loadResource } from '../skill-loader.js';
import { readMemory } from '../memory.js';
import { runAgenticLoop } from '../llm.js';
import { connectBrowser, closeBrowser } from '../browser.js';

/**
 * Run agent mode - LLM with tool calling executes the instruction
 * using read_file, write_file, browser_*, etc.
 */
export async function runAgentMode(
  skillName: string,
  instruction: string
): Promise<void> {
  output.header('Agent0 Agent Mode (Tool Calling)');

  try {
    const skill = await loadSkill(skillName);
    output.success(`Loaded skill: ${skill.name}`);

    // Build system prompt with skill context
    const skillContent = skill.skillContent;
    const memory = await readMemory(skill);
    const personalization = await loadResource(skill, 'personalization_reddit');
    const subreddits = await loadResource(skill, 'subreddits');
    const product = await loadResource(skill, 'product');

    const systemPrompt = `You are Agent0, an autonomous agent that executes Reddit commenting and engagement tasks.

## Available Tools
You have access to these tools. Use them to accomplish the user's request:
- read_file: Read files (skill instructions, tracking, personalization, subreddit rules, memory)
- write_file, append_file: Update tracking, leads, memory
- list_dir: Discover files
- browser_navigate: Go to Reddit URLs (subreddits, posts, inbox)
- browser_snapshot: Get page structure
- browser_get_text: Get visible page text
- browser_extract_posts: Extract Reddit posts from current page
- browser_click, browser_type: Interact with page elements
- browser_scroll: Scroll to load more content
- browser_current_url: Get current URL

## Skill Workflow (Reference)
${skillContent}

## Memory (Recent Activity)
${memory}

## Personalization (if needed)
${personalization || '(not loaded - use read_file to load .claude/skills/' + skillName + '/resources/personalization_reddit.md)'}

## Subreddits Config (if needed)
${subreddits ? '(available - use read_file for .claude/skills/' + skillName + '/resources/subreddits.md)' : '(not loaded)'}

## Product Info (if needed)
${product ? '(available)' : '(not loaded)'}

## Project Structure
- Skills: .claude/skills/${skillName}/
- Tracking: tracking/${skill.platform}/YYYY-MM-DD.md
- Leads: leads/${skill.platform}.md
- Memory: .claude/skills/${skillName}/memory.md

## Instructions
1. Use tools to read necessary context before acting
2. Follow the skill workflow when commenting (analyze post, generate, review, post)
3. Update tracking and memory after actions
4. Be autonomous - accomplish the full task
5. If you need to post a comment, use browser tools to navigate, find the comment box, type, and submit
6. Report what you did when done`;

    output.info('Instruction: ' + instruction);
    output.divider();

    // Connect browser (required for browser_* tools)
    await connectBrowser();

    const result = await runAgenticLoop(systemPrompt, instruction, {
      skill,
      maxIterations: 20,
      showSpinner: true,
    });

    output.divider();
    output.info('Agent completed:');
    console.log(result);

  } catch (error) {
    output.error(`Agent mode failed: ${error}`);
  } finally {
    await closeBrowser();
  }
}
