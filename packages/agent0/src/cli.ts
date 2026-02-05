import { Command } from 'commander';
import * as p from '@clack/prompts';
import { output } from './ui/output.js';
import { showBanner } from './ui/banner.js';
import { discoverSkills } from './skill-loader.js';
import { runBatchMode } from './modes/batch.js';
import { runCommenterMode } from './modes/commenter.js';
import { runNotificationsMode } from './modes/notifications.js';
import { runTrendingMode } from './modes/trending.js';
import { runPostMode } from './modes/post.js';

export function createCLI(): Command {
  const program = new Command();

  program
    .name('agent0')
    .description('Autonomous CLI for skill-based browser automation')
    .version('1.0.0');

  // Batch mode command
  program
    .command('batch')
    .description('Run batch mode to fill daily quota')
    .option('-s, --skill <name>', 'Skill to use', 'reddit-commenter')
    .action(async (options) => {
      await runWithSkillSelection(options.skill, 'batch');
    });

  // Comment command
  program
    .command('comment [instruction]')
    .description('Post comments based on instruction')
    .option('-s, --skill <name>', 'Skill to use', 'reddit-commenter')
    .action(async (instruction, options) => {
      const finalInstruction = instruction || await promptForInstruction('comment');
      await runWithSkillSelection(options.skill, 'commenter', finalInstruction);
    });

  // Notifications command
  program
    .command('notifications')
    .alias('notif')
    .description('Check and interact with notifications')
    .option('-s, --skill <name>', 'Skill to use', 'reddit-commenter')
    .action(async (options) => {
      await runWithSkillSelection(options.skill, 'notifications');
    });

  // Trending command
  program
    .command('trending')
    .description('Find trending posts for inspiration')
    .option('-s, --skill <name>', 'Skill to use', 'reddit-commenter')
    .option('-r, --subreddit <name>', 'Specific subreddit to check')
    .action(async (options) => {
      await runWithSkillSelection(options.skill, 'trending', options.subreddit);
    });

  // Post command
  program
    .command('post [content]')
    .description('Write and post content')
    .option('-s, --skill <name>', 'Skill to use', 'reddit-commenter')
    .action(async (content, options) => {
      const finalContent = content || await promptForInstruction('post');
      await runWithSkillSelection(options.skill, 'post', finalContent);
    });

  // Interactive mode (default when no command)
  program
    .command('interactive', { isDefault: true })
    .description('Start interactive mode')
    .action(async () => {
      await runInteractiveMode();
    });

  return program;
}

async function promptForInstruction(type: string): Promise<string> {
  const placeholders: Record<string, string> = {
    comment: 'Post 3 comments on r/chatgptpro',
    post: 'Write a post about...',
  };
  const result = await p.text({
    message: `Enter ${type} instruction:`,
    placeholder: placeholders[type] ?? 'Enter instruction...',
    validate: (value) => {
      if (!value.trim()) return 'Instruction is required';
      return undefined;
    },
  });

  if (p.isCancel(result)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  return result as string;
}

async function runWithSkillSelection(
  skillName: string,
  mode: string,
  instruction?: string
): Promise<void> {
  showBanner();
  
  const skills = await discoverSkills();
  
  if (skills.length === 0) {
    output.error('No skills found in .claude/skills/');
    process.exit(1);
  }

  // If skill not found, prompt for selection
  if (!skills.includes(skillName)) {
    output.warning(`Skill "${skillName}" not found.`);
    
    const selected = await p.select({
      message: 'Select a skill:',
      options: skills.map(s => ({ value: s, label: s })),
    });

    if (p.isCancel(selected)) {
      p.cancel('Operation cancelled.');
      process.exit(0);
    }

    skillName = selected as string;
  }

  output.info(`Using skill: ${skillName}`);
  output.info(`Mode: ${mode}`);

  switch (mode) {
    case 'batch':
      await runBatchMode(skillName);
      break;
    case 'commenter':
      await runCommenterMode(skillName, instruction || '');
      break;
    case 'notifications':
      await runNotificationsMode(skillName);
      break;
    case 'trending':
      await runTrendingMode(skillName, instruction);
      break;
    case 'post':
      await runPostMode(skillName, instruction || '');
      break;
    default:
      output.error(`Unknown mode: ${mode}`);
  }
}

async function runInteractiveMode(): Promise<void> {
  showBanner();

  const skills = await discoverSkills();
  
  if (skills.length === 0) {
    output.error('No skills found in .claude/skills/');
    process.exit(1);
  }

  // Select skill
  const skill = await p.select({
    message: 'Select a skill:',
    options: skills.map(s => ({ value: s, label: s })),
  });

  if (p.isCancel(skill)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  // Select mode
  const mode = await p.select({
    message: 'Select a mode:',
    options: [
      { value: 'batch', label: 'Batch Mode', hint: 'Fill daily quota' },
      { value: 'commenter', label: 'Comment', hint: 'Post specific comments' },
      { value: 'notifications', label: 'Notifications', hint: 'Check and respond' },
      { value: 'trending', label: 'Trending', hint: 'Find trending posts' },
      { value: 'post', label: 'Post', hint: 'Write and publish content' },
    ],
  });

  if (p.isCancel(mode)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  let instruction: string | undefined;

  if (mode === 'commenter') {
    instruction = await promptForInstruction('comment');
  } else if (mode === 'post') {
    instruction = await promptForInstruction('post');
  }

  await runWithSkillSelection(skill as string, mode as string, instruction);
}
