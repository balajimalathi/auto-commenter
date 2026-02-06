import { output } from './ui/output.js';
import { showBanner } from './ui/banner.js';
import { discoverSkills } from './skill-loader.js';
import { runBatchMode } from './modes/batch.js';
import { runCommenterMode } from './modes/commenter.js';
import { runNotificationsMode } from './modes/notifications.js';
import { runTrendingMode } from './modes/trending.js';
import { runPostMode } from './modes/post.js';
import {
  selectSkill,
  selectMode,
  promptInstruction,
  promptTarget,
  promptNextAction,
  selectMainAction,
} from './ui/prompts-inquirer.js';

/**
 * Run a single mode execution
 */
async function runSingleMode(): Promise<void> {
  showBanner();

  const skills = await discoverSkills();
  if (skills.length === 0) {
    output.error('No skills found in .claude/skills/');
    process.exit(1);
  }

  const skill = await selectSkill(skills);
  const mode = await selectMode();

  let instruction: string | undefined;
  let target: string | undefined;

  if (mode === 'commenter' || mode === 'post') {
    instruction = await promptInstruction(mode === 'commenter' ? 'comment' : 'post');
  } else if (mode === 'trending') {
    target = await promptTarget();
  }

  output.info(`Using skill: ${skill}`);
  output.info(`Mode: ${mode}`);
  output.divider();

  await executeMode(skill, mode, instruction, target);
}

/**
 * Execute a mode with given parameters
 */
async function executeMode(
  skill: string,
  mode: string,
  instruction?: string,
  target?: string
): Promise<void> {
  try {
    switch (mode) {
      case 'batch':
        await runBatchMode(skill);
        break;
      case 'commenter':
        if (!instruction) {
          throw new Error('Instruction is required for commenter mode');
        }
        await runCommenterMode(skill, instruction);
        break;
      case 'notifications':
        await runNotificationsMode(skill);
        break;
      case 'trending':
        await runTrendingMode(skill, target);
        break;
      case 'post':
        if (!instruction) {
          throw new Error('Instruction is required for post mode');
        }
        await runPostMode(skill, instruction);
        break;
      default:
        output.error(`Unknown mode: ${mode}`);
        return;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    output.error(`Mode execution failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Run interactive loop mode
 */
async function runInteractiveLoop(): Promise<void> {
  showBanner();

  const skills = await discoverSkills();
  if (skills.length === 0) {
    output.error('No skills found in .claude/skills/');
    process.exit(1);
  }

  while (true) {
    output.divider();
    
    const skill = await selectSkill(skills);
    const mode = await selectMode();

    let instruction: string | undefined;
    let target: string | undefined;

    if (mode === 'commenter' || mode === 'post') {
      instruction = await promptInstruction(mode === 'commenter' ? 'comment' : 'post');
    } else if (mode === 'trending') {
      target = await promptTarget();
    }

    output.info(`Using skill: ${skill}`);
    output.info(`Mode: ${mode}`);
    output.divider();

    try {
      await executeMode(skill, mode, instruction, target);
      output.success('Mode completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      output.error(`Mode failed: ${errorMessage}`);
    }

    // Ask what to do next
    const nextAction = await promptNextAction({ hasScript: false });
    
    if (nextAction === 'exit') {
      output.info('Exiting interactive mode');
      break;
    }
    // manual means continue loop (run another mode)
  }
}

/**
 * Main CLI entry point
 */
export async function runCLI(): Promise<void> {
  while (true) {
    const action = await selectMainAction();

    switch (action) {
      case 'single':
        await runSingleMode();
        // After single mode, ask if they want to do something else
        const nextAfterSingle = await promptNextAction({ hasScript: false });
        if (nextAfterSingle === 'exit') {
          return;
        }
        // manual means continue loop (show main menu again)
        break;

      case 'script': {
        const { selectScriptFile } = await import('./ui/prompts-inquirer.js');
        const { executeScript, loadScript } = await import('./script-executor.js');
        
        try {
          const scriptPath = await selectScriptFile();
          const script = await loadScript(scriptPath);
          await executeScript(script);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          output.error(`Script execution failed: ${errorMessage}`);
        }
        
        // After script, ask if they want to do something else
        const nextAfterScript = await promptNextAction({ hasScript: false });
        if (nextAfterScript === 'exit') {
          return;
        }
        // manual means continue loop (show main menu again)
        break;
      }

      case 'interactive':
        await runInteractiveLoop();
        // After interactive loop ends, return to main menu
        break;

      case 'exit':
        output.info('Goodbye!');
        return;
    }
  }
}
