import type { Skill } from '../../skill-loader.js';
import type { ModeContext } from '../../agent-runner.js';
import type { PlatformInstructions } from './index.js';

export const twitterInstructions: PlatformInstructions = {
  batch: (skill: Skill, batchContent: string | null, modeContext?: ModeContext) => {
    return `## Batch Mode Instructions
${batchContent || 'Fill today\'s quota according to the skill workflow.'}

Your task:
1. Read today's tracking file (tracking/${skill.platform}/YYYY-MM-DD.md) to see current progress
2. Identify targets (timeline tabs) that haven't reached their daily limit
3. For each target with remaining quota:
   - Use playwriter_execute with Navigation snippet: await page.goto('https://x.com/home', ...)
   - Use playwriter_execute with timeline-tab snippets to click the selected tab (For you, Following, Build in Public, Fail in Public, or Smol)
   - ⚠️ CRITICAL: ALWAYS filter to "Recency" after clicking the tab: click the tab's SVG icon, then select "Recency" from the menu
   - Use playwriter_execute with Extract Tweets snippet to get the top 10 tweets from the filtered timeline
   - Select a suitable tweet to reply to (check tracking to avoid duplicates)
   - Navigate to the tweet URL via playwriter_execute
   - Use playwriter_execute with Get Page Text snippet to read tweet content
   - Generate a helpful, natural reply following personalization guidelines (max 280 characters)
   - Use playwriter_execute to focus reply composer, type and submit the reply
   - Update tracking file with the new reply
   - Update memory with the action
   - ⚠️ CRITICAL: After posting reply on /status/ page, navigate back to home timeline (await page.goto('https://x.com/home')) to continue with next tweet
   - The tab and "Recency" filter should still be active - if not, re-click tab and re-apply filter
   - Continue with next tweet from the extracted list, or extract new batch if all processed
   - After completing quota for a target (or if no suitable tweets), move to the next target immediately
4. Do NOT wait between targets; move to the next target immediately after completing one. Complete all targets in one continuous run.
5. CRITICAL: Continue through ALL targets until:
   - All targets have reached their quota, OR
   - There are no suitable tweets left in any target
6. When reporting progress, list only completed targets and total (e.g. X/125 completed). Do not output "In progress" or "Waiting" sections.

${modeContext?.trackingSummary ? `Current tracking summary:\n${modeContext.trackingSummary}` : ''}`;
  },

  commenter: (skill: Skill) => {
    return `## Commenter Mode Instructions
CRITICAL: Commenter writes REPLIES on EXISTING tweets. NEVER create a new tweet. Do NOT click "Post" or compose standalone tweets. You are replying to others' content, not publishing your own.

Your task: Write replies on existing tweets based on the user's instruction.

Workflow for each reply (use exact snippets from Playwriter Snippets section):
1. Parse the instruction: which target (timeline tab), how many replies
2. Use playwriter_execute with Navigation snippet: await page.goto('https://x.com/home', ...)
3. Use playwriter_execute with timeline-tab snippets to click the selected tab
4. ⚠️ CRITICAL: ALWAYS filter to "Recency" after clicking the tab: click the tab's SVG icon, then select "Recency" from the menu
5. Use playwriter_execute with Extract Tweets snippet to get the top 10 tweets from the filtered timeline
6. Select ONE tweet to reply to (pick one with good engagement potential, check tracking to avoid duplicates)
7. Use playwriter_execute to open the tweet (navigate to URL)
8. On the tweet page: use playwriter_execute with Get Page Text snippet to read content
9. Write a helpful, natural reply that responds to that specific tweet (following personalization guidelines, max 280 characters)
10. Use playwriter_execute to focus reply composer, type the reply, then submit
11. Update tracking and memory
12. If the user's instruction requests multiple replies, repeat steps 2–11 until you have successfully posted that exact number of replies (or there are no suitable tweets left).`;
  },

  notifications: (skill: Skill) => {
    return `## Notifications Mode Instructions
Your task: Check X/Twitter notifications and respond to any replies.

Workflow (use exact snippets from Playwriter Snippets section):
1. Use playwriter_execute with Navigation snippet: await page.goto('https://x.com/notifications', ...)
2. Use playwriter_execute with Get Page Text snippet to read notifications
3. Identify any replies to your tweets that need responses
4. For each reply that warrants a response:
   - Read the context (original tweet, your tweet, their reply)
   - Generate a thoughtful, helpful response (max 280 characters)
   - Use playwriter_execute to focus reply composer, type the reply, then submit
   - Update memory with the interaction
5. Mark notifications as read if possible via playwriter_execute
6. Report what notifications you handled`;
  },

  trending: (skill: Skill, modeContext?: ModeContext) => {
    return `## Trending Mode Instructions
Your task: Find trending tweets for inspiration or engagement opportunities.

Workflow (use exact snippets from Playwriter Snippets section):
1. Use playwriter_execute with Navigation snippet: await page.goto('https://x.com/explore', ...) or check trending topics
2. Use playwriter_execute with Extract Tweets snippet to get trending tweet data
3. For each interesting tweet:
   - Note the content, engagement level, topic
   - Analyze why it's trending (topic relevance, timing, format)
4. Compile a summary of trending topics and engagement opportunities
5. Optionally save the summary to a file (trending_{target}_{date}.md)
6. Return the trending analysis to the user

${modeContext?.target ? `Target: ${modeContext.target}` : 'Check multiple targets from the targets.md resource.'}`;
  },

  post: (skill: Skill) => {
    return `## Post Mode Instructions
Your task: Draft and publish a new tweet based on the user's instruction.

Workflow (use exact snippets from Playwriter Snippets section):
1. Parse the instruction to understand: what topic/content
2. Draft the tweet content following:
   - X/Twitter character limit (280 characters)
   - Personalization guidelines
   - The user's intent
3. Use playwriter_execute with Navigation snippet to go to x.com/home
4. Use playwriter_execute with Click by Selector and Type into Input snippets to compose and submit the tweet
5. Update memory with the tweet details
6. Report the tweet URL or any issues`;
  },
};
