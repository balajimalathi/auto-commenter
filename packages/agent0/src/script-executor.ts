import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import type { Script, Step } from './types.js';
import { output } from './ui/output.js';
import { showBanner } from './ui/banner.js';
import { runBatchMode } from './modes/batch.js';
import { runCommenterMode } from './modes/commenter.js';
import { runNotificationsMode } from './modes/notifications.js';
import { runTrendingMode } from './modes/trending.js';
import { runPostMode } from './modes/post.js';
import { promptNextAction } from './ui/prompts-inquirer.js';

/**
 * Load script from JSON file
 */
export async function loadScript(path: string): Promise<Script> {
  const fullPath = resolve(process.cwd(), path);
  
  if (!existsSync(fullPath)) {
    throw new Error(`Script file not found: ${path}`);
  }

  try {
    const content = await readFile(fullPath, 'utf-8');
    const script = JSON.parse(content) as Script;
    
    // Validate script structure
    if (!Array.isArray(script)) {
      throw new Error('Script must be an array of steps');
    }
    
    for (const step of script) {
      if (!step.mode || !step.skill) {
        throw new Error('Each step must have "mode" and "skill" properties');
      }
    }
    
    return script;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in script file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Execute a single step
 */
async function executeStep(step: Step): Promise<void> {
  output.info(`Executing: ${step.mode} mode with skill ${step.skill}`);
  
  switch (step.mode) {
    case 'batch':
      await runBatchMode(step.skill);
      break;
    case 'commenter':
      if (!step.instruction) {
        throw new Error('Commenter mode requires "instruction" property');
      }
      await runCommenterMode(step.skill, step.instruction);
      break;
    case 'notifications':
      await runNotificationsMode(step.skill);
      break;
    case 'trending':
      await runTrendingMode(step.skill, step.target);
      break;
    case 'post':
      if (!step.instruction) {
        throw new Error('Post mode requires "instruction" property');
      }
      await runPostMode(step.skill, step.instruction);
      break;
    default:
      throw new Error(`Unknown mode: ${(step as Step).mode}`);
  }
}

/**
 * Execute script with interactive next-step prompts
 */
export async function executeScript(script: Script): Promise<void> {
  showBanner();
  output.info(`Loaded script with ${script.length} step(s)`);
  output.divider();

  for (let i = 0; i < script.length; i++) {
    const step = script[i];
    const stepNum = i + 1;
    
    output.info(`\n[Step ${stepNum}/${script.length}]`);
    output.divider();

    try {
      await executeStep(step);
      output.success(`Step ${stepNum} completed`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      output.error(`Step ${stepNum} failed: ${errorMessage}`);
      
      // Ask what to do on error
      const action = await promptNextAction({ 
        hasScript: true, 
        isError: true,
        remainingSteps: script.length - stepNum - 1
      });
      
      if (action === 'exit') {
        output.info('Script execution cancelled');
        return;
      }
      if (action === 'manual') {
        output.info('Switching to manual mode');
        return;
      }
      // continue: proceed to next step despite error
    }

    // After each step (except the last), prompt for next action
    if (i < script.length - 1) {
      const action = await promptNextAction({ 
        hasScript: true,
        remainingSteps: script.length - stepNum - 1
      });
      
      if (action === 'exit') {
        output.info('Script execution cancelled');
        return;
      }
      if (action === 'manual') {
        output.info('Switching to manual mode');
        return;
      }
      // continue: proceed to next step
    }
  }

  output.success('Script execution completed');
}
