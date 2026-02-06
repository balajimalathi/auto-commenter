import type { Skill } from '../../skill-loader.js';
import type { ModeContext } from '../../agent-runner.js';

/**
 * Platform-specific instructions interface
 * Each platform must implement all mode instruction functions
 */
export interface PlatformInstructions {
  batch: (skill: Skill, batchContent: string | null, modeContext?: ModeContext) => string;
  commenter: (skill: Skill) => string;
  notifications: (skill: Skill) => string;
  trending: (skill: Skill, modeContext?: ModeContext) => string;
  post: (skill: Skill) => string;
}

/**
 * Load platform-specific instructions dynamically
 */
export async function loadPlatformInstructions(platform: string): Promise<PlatformInstructions> {
  try {
    const module = await import(`./${platform}.js`);
    const instructions = module[`${platform}Instructions`];
    
    if (!instructions) {
      throw new Error(`Platform instructions export not found: ${platform}Instructions`);
    }
    
    return instructions as PlatformInstructions;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Platform instructions not found for: ${platform}. ${errorMessage}`);
  }
}
