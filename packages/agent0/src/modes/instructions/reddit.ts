import type { Skill } from '../../skill-loader.js';
import type { ModeContext } from '../../agent-runner.js';
import type { PlatformInstructions } from './index.js';

export const redditInstructions: PlatformInstructions = {
  batch: (skill: Skill, batchContent: string | null, modeContext?: ModeContext) => {
    return `## Batch Mode Instructions
${batchContent || 'Fill today\'s quota according to the skill workflow.'}

Your task:
1. Read today's tracking file (tracking/${skill.platform}/YYYY-MM-DD.md) to see current progress
2. Identify subreddits that haven't reached their daily limit
3. For each subreddit with remaining quota:
   - Use playwriter_execute with Navigation snippet: await page.goto('https://www.reddit.com/r/{subreddit}/new/', ...)
   - Use playwriter_execute with Extract Reddit Posts snippet to get posts
   - Select a suitable post to comment on
   - Navigate to the post URL via playwriter_execute
   - Use playwriter_execute with Get Page Text snippet to read post content
   - Generate a helpful, natural comment following personalization guidelines
   - Use playwriter_execute: await page.click('comment-composer-host'), then type and submit the comment
   - Update tracking file with the new comment
   - Update memory with the action
   - After completing 3 comments for a subreddit (or if no suitable posts), move to the next subreddit immediately
4. Do NOT wait between subreddits; move to the next subreddit immediately after completing one. Complete all subreddits in one continuous run.
5. CRITICAL: Continue through ALL subreddits until:
   - All subreddits have reached their quota (3 comments each), OR
   - There are no suitable posts left in any subreddit
6. When reporting progress, list only completed subreddits and total (e.g. X/24 completed). Do not output "In progress" or "Waiting" sections.

${modeContext?.trackingSummary ? `Current tracking summary:\n${modeContext.trackingSummary}` : ''}`;
  },

  commenter: (skill: Skill) => {
    return `## Commenter Mode Instructions
CRITICAL: Commenter writes COMMENTS on EXISTING posts. NEVER create a new post. Do NOT click "Create Post" or similar. You are replying to others' content, not publishing your own.

Your task: Write comments on existing posts based on the user's instruction.

Workflow for each comment (use exact snippets from Playwriter Snippets section):
1. Parse the instruction: which subreddit (r/X), how many comments
2. Use playwriter_execute with Navigation snippet: await page.goto('https://www.reddit.com/r/{subreddit}/new/', ...)
3. Use playwriter_execute with Scroll snippet if needed
4. Use playwriter_execute with Extract Reddit Posts snippet to get posts
5. Select ONE post to comment on (pick one with good engagement potential)
6. Use playwriter_execute to open the post (navigate to URL)
7. On the post page: use playwriter_execute with Get Page Text snippet to read content
8. Write a helpful, natural comment that replies to that specific post (following personalization guidelines)
9. Use playwriter_execute: await page.click('comment-composer-host'), then use Type into Input snippet, then submit the comment
10. Update tracking and memory
11. If the user's instruction requests multiple comments, repeat steps 2–10 until you have successfully posted that exact number of comments (or there are no suitable posts left).`;
  },

  notifications: (skill: Skill) => {
    return `## Notifications Mode Instructions
Your task: Check Reddit notifications and respond to any replies.

Workflow (use exact snippets from Playwriter Snippets section):
1. Use playwriter_execute with Navigation snippet: await page.goto('https://www.reddit.com/message/inbox/', ...)
2. Use playwriter_execute with Get Page Text snippet to read notifications
3. Identify any replies to your comments that need responses
4. For each reply that warrants a response:
   - Read the context (original post, your comment, their reply)
   - Generate a thoughtful, helpful response
   - Use playwriter_execute with Click by Selector snippet, then Type into Input snippet to post the reply
   - Update memory with the interaction
5. Mark notifications as read if possible via playwriter_execute
6. Report what notifications you handled`;
  },

  trending: (skill: Skill, modeContext?: ModeContext) => {
    return `## Trending Mode Instructions
Your task: Find trending posts for inspiration or reposting opportunities.

Workflow (use exact snippets from Playwriter Snippets section):
1. Use playwriter_execute with Navigation snippet: await page.goto('https://www.reddit.com/r/{subreddit}/hot/', ...) or /rising/
2. Use playwriter_execute with Extract Reddit Posts snippet to get post data
3. For each interesting post:
   - Note the title, engagement level, topic
   - Analyze why it's trending (topic relevance, timing, format)
4. Compile a summary of trending topics and post ideas
5. Optionally save the summary to a file (trending_{subreddit}_{date}.md)
6. Return the trending analysis to the user

${modeContext?.target ? `Target subreddit: r/${modeContext.target}` : 'Check multiple subreddits from the targets.md resource.'}`;
  },

  post: (skill: Skill) => {
    return `## Post Mode Instructions
Your task: Draft and publish a new post based on the user's instruction.

Workflow (use exact snippets from Playwriter Snippets section):
1. Parse the instruction to understand: which subreddit, what topic/content
2. Read subreddit rules for the target subreddit
3. Draft the post title and content following:
   - Subreddit rules and culture
   - Personalization guidelines
   - The user's intent
4. Use playwriter_execute with Navigation snippet to go to the subreddit
5. Use playwriter_execute with Click by Selector and Type into Input snippets to fill and submit the post
6. Update memory with the post details
7. Report the post URL or any issues`;
  },
};
