import { readdir, readFile, writeFile } from 'fs/promises';
import { mkdirSync } from 'fs';
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
  targets: string | null;
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
 * Creates the file from template if it doesn't exist
 */
export async function loadTracking(skill: Skill): Promise<string | null> {
  const trackingFile = getTodayTrackingPath(skill);
  
  if (existsSync(trackingFile)) {
    return await readFile(trackingFile, 'utf-8');
  }

  // Try to load template and create tracking file
  const templatePath = join(skill.trackingPath, 'template.md');
  if (existsSync(templatePath)) {
    let templateContent = await readFile(templatePath, 'utf-8');
    
    // Replace date placeholder with today's date
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    templateContent = templateContent.replace(/\[YYYY-MM-DD\]/g, today);
    
    // Ensure tracking directory exists
    const trackingDir = skill.trackingPath;
    if (!existsSync(trackingDir)) {
      mkdirSync(trackingDir, { recursive: true });
    }
    
    // Create the tracking file
    await writeFile(trackingFile, templateContent, 'utf-8');
    
    return templateContent;
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
 * Parse targets from targets.md resource
 */
export interface TargetInfo {
  name: string;
  dailyLimit: number;
}

export function parseTargets(targetsContent: string): TargetInfo[] {
  const targets: TargetInfo[] = [];
  
  // Look for table rows like: | r/chatgptpro | ~15K | 3 | or | For you | ~500K posts | 25 |
  // Supports both Reddit format (r/name) and Twitter format (tab name with spaces)
  // Captures everything between first | and second |, excluding optional r/ prefix
  const tableRegex = /\|\s*(?:r\/)?([^|]+?)\s*\|[^|]*\|\s*(\d+)\s*\|/g;
  let match;
  
  while ((match = tableRegex.exec(targetsContent)) !== null) {
    const name = match[1].trim();
    // Skip header rows
    if (name.toLowerCase() === 'target' || name.toLowerCase() === 'subreddit' || name.toLowerCase() === 'tab') {
      continue;
    }
    targets.push({
      name,
      dailyLimit: parseInt(match[2], 10),
    });
  }

  return targets;
}

/**
 * Parse tracking file to get today's activity
 */
export interface TrackingActivity {
  target: string;
  todayComments: number;
  dailyLimit: number;
  lastComment: string | null;
}

export function parseTracking(trackingContent: string): TrackingActivity[] {
  const activities: TrackingActivity[] = [];
  
  // Look for table rows in multiple formats:
  // - Reddit: | r/nocode | 3/3 | 3 | 14:30 |
  // - Twitter new: | For you | 0/25 | 25 | - |
  // - Twitter old: | For you | 0 | 25 | 25 |
  // Supports both Reddit format (r/name) and Twitter format (tab name with spaces)
  // Handles X/Y format in second column (extracts X as todayComments)
  const tableRegex = /\|\s*(?:r\/)?([^|]+?)\s*\|\s*(\d+)(?:\/(\d+))?\s*\|\s*(\d+)\s*\|\s*([^|]*)\s*\|/g;
  let match;
  
  while ((match = tableRegex.exec(trackingContent)) !== null) {
    const target = match[1].trim();
    // Skip header rows
    const lowerTarget = target.toLowerCase();
    if (lowerTarget === 'target' || lowerTarget === 'subreddit' || lowerTarget === 'tab' || 
        lowerTarget.includes('──') || lowerTarget === '') {
      continue;
    }
    
    // Handle different formats:
    // Format 1 (X/Y): | Target | 0/25 | 25 | - | → match[2]=0, match[3]=25, match[4]=25
    // Format 2 (single): | Target | 0 | 25 | 25 | → match[2]=0, match[3]=undefined, match[4]=25
    const todayComments = parseInt(match[2], 10);
    // If X/Y format, use match[4] as dailyLimit (third column). If single number format, also use match[4]
    const dailyLimit = parseInt(match[4], 10);
    const lastActivity = match[5].trim();
    
    activities.push({
      target,
      todayComments,
      dailyLimit,
      lastComment: lastActivity === '-' || lastActivity === '' ? null : lastActivity,
    });
  }

  return activities;
}
