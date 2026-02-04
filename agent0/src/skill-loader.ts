import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

export interface Skill {
  name: string;
  platform: string;
  skillPath: string;
  skillContent: string;
  batchContent: string | null;
  resources: Record<string, string>;
  trackingPath: string;
  leadsPath: string;
  memoryPath: string;
}

export interface SkillResources {
  personalization: string | null;
  subreddits: string | null;
  product: string | null;
  [key: string]: string | null;
}

const SKILLS_DIR = '.claude/skills';
const TRACKING_DIR = 'tracking';
const LEADS_DIR = 'leads';

/**
 * Get the project root directory
 * Searches upward from cwd to find the directory containing .claude/skills/
 */
export function getProjectRoot(): string {
  let current = process.cwd();
  
  // Search upward for .claude/skills directory
  while (current !== dirname(current)) {
    const skillsPath = join(current, SKILLS_DIR);
    if (existsSync(skillsPath)) {
      return current;
    }
    current = dirname(current);
  }
  
  // Fall back to cwd if not found
  return process.cwd();
}

/**
 * Discover all available skills
 */
export async function discoverSkills(): Promise<string[]> {
  const skillsPath = join(getProjectRoot(), SKILLS_DIR);
  
  if (!existsSync(skillsPath)) {
    return [];
  }

  const entries = await readdir(skillsPath, { withFileTypes: true });
  const skills: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillMdPath = join(skillsPath, entry.name, 'SKILL.md');
      if (existsSync(skillMdPath)) {
        skills.push(entry.name);
      }
    }
  }

  return skills;
}

/**
 * Extract platform from skill name (e.g., reddit-commenter -> reddit)
 */
export function extractPlatform(skillName: string): string {
  // Assumes format: {platform}-commenter or similar
  const parts = skillName.split('-');
  return parts[0];
}

/**
 * Load a skill by name
 */
export async function loadSkill(skillName: string): Promise<Skill> {
  const root = getProjectRoot();
  const skillPath = join(root, SKILLS_DIR, skillName);
  const platform = extractPlatform(skillName);

  // Check skill exists
  if (!existsSync(skillPath)) {
    throw new Error(`Skill not found: ${skillName}`);
  }

  // Load SKILL.md
  const skillMdPath = join(skillPath, 'SKILL.md');
  if (!existsSync(skillMdPath)) {
    throw new Error(`SKILL.md not found for skill: ${skillName}`);
  }
  const skillContent = await readFile(skillMdPath, 'utf-8');

  // Load BATCH.md (optional)
  const batchMdPath = join(skillPath, 'BATCH.md');
  const batchContent = existsSync(batchMdPath) 
    ? await readFile(batchMdPath, 'utf-8')
    : null;

  // Load resources
  const resourcesPath = join(skillPath, 'resources');
  const resources: Record<string, string> = {};
  
  if (existsSync(resourcesPath)) {
    const resourceFiles = await readdir(resourcesPath);
    for (const file of resourceFiles) {
      if (file.endsWith('.md')) {
        const resourceName = file.replace('.md', '');
        resources[resourceName] = await readFile(
          join(resourcesPath, file),
          'utf-8'
        );
      }
    }
  }

  // Determine paths
  const trackingPath = join(root, TRACKING_DIR, platform);
  const leadsPath = join(root, LEADS_DIR, `${platform}.md`);
  const memoryPath = join(skillPath, 'memory.md');

  return {
    name: skillName,
    platform,
    skillPath,
    skillContent,
    batchContent,
    resources,
    trackingPath,
    leadsPath,
    memoryPath,
  };
}

/**
 * Get specific resources (lazy loading)
 */
export async function loadResource(
  skill: Skill,
  resourceName: string
): Promise<string | null> {
  if (skill.resources[resourceName]) {
    return skill.resources[resourceName];
  }

  const resourcePath = join(skill.skillPath, 'resources', `${resourceName}.md`);
  if (existsSync(resourcePath)) {
    const content = await readFile(resourcePath, 'utf-8');
    skill.resources[resourceName] = content;
    return content;
  }

  return null;
}

/**
 * Get today's tracking file path
 */
export function getTodayTrackingPath(skill: Skill): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return join(skill.trackingPath, `${today}.md`);
}

/**
 * Load tracking file content
 */
export async function loadTracking(skill: Skill): Promise<string | null> {
  const trackingFile = getTodayTrackingPath(skill);
  
  if (existsSync(trackingFile)) {
    return await readFile(trackingFile, 'utf-8');
  }

  // Try to load template
  const templatePath = join(skill.trackingPath, 'template.md');
  if (existsSync(templatePath)) {
    return await readFile(templatePath, 'utf-8');
  }

  return null;
}

/**
 * Load leads file content
 */
export async function loadLeads(skill: Skill): Promise<string | null> {
  if (existsSync(skill.leadsPath)) {
    return await readFile(skill.leadsPath, 'utf-8');
  }
  return null;
}

/**
 * Parse subreddits from subreddits.md resource
 */
export interface SubredditInfo {
  name: string;
  dailyLimit: number;
}

export function parseSubreddits(subredditsContent: string): SubredditInfo[] {
  const subreddits: SubredditInfo[] = [];
  
  // Look for table rows like: | r/chatgptpro | ~15K | 3 |
  const tableRegex = /\|\s*r\/(\w+)\s*\|[^|]*\|\s*(\d+)\s*\|/g;
  let match;
  
  while ((match = tableRegex.exec(subredditsContent)) !== null) {
    subreddits.push({
      name: match[1],
      dailyLimit: parseInt(match[2], 10),
    });
  }

  return subreddits;
}

/**
 * Parse tracking file to get today's activity
 */
export interface TrackingActivity {
  subreddit: string;
  todayComments: number;
  dailyLimit: number;
  lastComment: string | null;
}

export function parseTracking(trackingContent: string): TrackingActivity[] {
  const activities: TrackingActivity[] = [];
  
  // Look for table rows like: | r/chatgptpro | 2 | 3 | 14:30 |
  const tableRegex = /\|\s*r\/(\w+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([^|]*)\s*\|/g;
  let match;
  
  while ((match = tableRegex.exec(trackingContent)) !== null) {
    activities.push({
      subreddit: match[1],
      todayComments: parseInt(match[2], 10),
      dailyLimit: parseInt(match[3], 10),
      lastComment: match[4].trim() === '-' ? null : match[4].trim(),
    });
  }

  return activities;
}
