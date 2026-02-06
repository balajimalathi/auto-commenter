/**
 * Step definition for script execution
 */
export interface Step {
  mode: 'batch' | 'commenter' | 'notifications' | 'trending' | 'post';
  skill: string;
  instruction?: string;  // For commenter/post modes
  target?: string;       // For trending mode
}

/**
 * Script is an array of steps
 */
export type Script = Step[];
