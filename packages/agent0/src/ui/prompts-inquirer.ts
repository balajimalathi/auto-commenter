import { select, input, confirm } from '@inquirer/prompts';
import { readdir } from 'fs/promises';
import { dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';
import { discoverSkills } from '../skill-loader.js';
import { output } from './output.js';

/**
 * Select a skill from available skills
 */
export async function selectSkill(skills?: string[]): Promise<string> {
  const availableSkills = skills || await discoverSkills();
  
  if (availableSkills.length === 0) {
    throw new Error('No skills found in .claude/skills/');
  }

  return await select({
    message: 'Select a skill:',
    choices: availableSkills.map(skill => ({
      name: skill,
      value: skill,
    })),
  });
}

/**
 * Select a mode
 */
export async function selectMode(): Promise<string> {
  return await select({
    message: 'Select a mode:',
    choices: [
      { name: 'Batch Mode', value: 'batch', description: 'Fill daily quota' },
      { name: 'Comment', value: 'commenter', description: 'Post specific comments' },
      { name: 'Notifications', value: 'notifications', description: 'Check and respond' },
      { name: 'Trending', value: 'trending', description: 'Find trending posts' },
      { name: 'Post', value: 'post', description: 'Write and publish content' },
    ],
  });
}

/**
 * Prompt for instruction input
 */
export async function promptInstruction(type: string): Promise<string> {
  const placeholders: Record<string, string> = {
    comment: 'Post 3 comments on r/saas',
    post: 'Write a post about...',
  };

  return await input({
    message: `Enter ${type} instruction:`,
    default: placeholders[type] || '',
    validate: (value) => {
      if (!value.trim()) return 'Instruction is required';
      return true;
    },
  });
}

/**
 * Prompt for target (for trending mode)
 */
export async function promptTarget(): Promise<string | undefined> {
  const hasTarget = await confirm({
    message: 'Do you want to specify a target?',
    default: false,
  });

  if (!hasTarget) {
    return undefined;
  }

  return await input({
    message: 'Enter target (subreddit like r/saas or timeline tab like "For you"):',
    validate: (value) => {
      if (!value.trim()) return 'Target is required';
      return true;
    },
  });
}

// Project root (where script/ folder lives) - from packages/agent0/src/ui/ up 4 levels
const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SCRIPT_DIR = join(PROJECT_ROOT, 'script');

/**
 * Discover available script files in the script/ folder at project root
 * Returns full absolute paths for loadScript compatibility
 */
async function discoverScripts(): Promise<string[]> {
  try {
    const entries = await readdir(SCRIPT_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => join(SCRIPT_DIR, e.name))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Select a script file from dropdown (lists JSON files in script/ folder at project root)
 */
export async function selectScriptFile(): Promise<string> {
  const scripts = await discoverScripts();
  if (scripts.length === 0) {
    throw new Error('No .json scripts found in script/ folder at project root');
  }
  return await select({
    message: 'Select a script to run:',
    choices: scripts.map((fullPath) => ({
      name: `script/${basename(fullPath)}`,
      value: fullPath,
    })),
  });
}

/**
 * Prompt for next action after mode execution
 */
export async function promptNextAction(options: {
  hasScript: boolean;
  isError?: boolean;
  remainingSteps?: number;
}): Promise<'continue' | 'manual' | 'exit'> {
  const { hasScript, isError = false, remainingSteps = 0 } = options;

  if (isError) {
    const choices = [
      { name: 'Continue script', value: 'continue' as const, description: 'Proceed to next step despite error' },
      { name: 'Switch to manual', value: 'manual' as const, description: 'Exit script and run manually' },
      { name: 'Exit', value: 'exit' as const, description: 'Stop execution' },
    ];

    return await select({
      message: 'Step failed. What would you like to do?',
      choices,
    });
  }

  if (hasScript && remainingSteps > 0) {
    const choices = [
      { 
        name: `Continue script (${remainingSteps} step${remainingSteps > 1 ? 's' : ''} remaining)`, 
        value: 'continue' as const 
      },
      { name: 'Switch to manual', value: 'manual' as const, description: 'Exit script and run manually' },
      { name: 'Exit', value: 'exit' as const, description: 'Stop execution' },
    ];

    return await select({
      message: 'What would you like to do next?',
      choices,
    });
  }

  // No script or last step - just ask if they want to run another mode manually
  const runAgain = await confirm({
    message: 'Run another mode?',
    default: true,
  });

  return runAgain ? 'manual' : 'exit';
}

/**
 * Main menu selection
 */
export async function selectMainAction(): Promise<'single' | 'script' | 'interactive' | 'exit'> {
  return await select({
    message: 'What would you like to do?',
    choices: [
      { name: 'Run single mode', value: 'single' as const, description: 'Execute one mode and exit' },
      { name: 'Run from script', value: 'script' as const, description: 'Execute steps from JSON script' },
      { name: 'Interactive loop', value: 'interactive' as const, description: 'Run modes in a loop' },
      { name: 'Exit', value: 'exit' as const },
    ],
  });
}
