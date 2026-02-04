import { output } from '../ui/output.js';
import { createSpinner } from '../ui/progress.js';
import { select } from '../ui/prompts.js';
import { loadSkill, loadResource } from '../skill-loader.js';
import { readMemory, appendMemory } from '../memory.js';
import { approveReply } from '../human-in-loop.js';
import { waitForAction } from '../timing.js';
import { connectBrowser, closeBrowser, navigate, click, type, evaluate } from '../browser.js';
import { callLLM, Message } from '../llm.js';

interface Notification {
  type: 'reply' | 'mention' | 'message' | 'other';
  username: string;
  subreddit: string;
  content: string;
  postTitle: string;
  url: string;
}

/**
 * Run notifications mode - check and respond to notifications
 */
export async function runNotificationsMode(skillName: string): Promise<void> {
  output.header('Agent0 Notifications Mode');

  try {
    const skill = await loadSkill(skillName);
    output.success(`Loaded skill: ${skill.name}`);

    await connectBrowser();

    // Navigate to inbox
    const spinner = createSpinner('Loading notifications...');
    spinner.start();

    await navigate('https://www.reddit.com/message/inbox/');
    await waitForAction();

    spinner.succeed('Notifications loaded');

    // Extract notifications
    const notifications = await extractNotifications();

    if (notifications.length === 0) {
      output.info('No new notifications');
      return;
    }

    output.info(`Found ${notifications.length} notifications`);
    output.divider();

    // Display notifications
    for (let i = 0; i < notifications.length; i++) {
      const notif = notifications[i];
      output.info(`[${i + 1}] ${notif.type} from u/${notif.username} in r/${notif.subreddit}`);
      output.dim(`   "${notif.content.substring(0, 100)}..."`);
    }

    output.divider();

    // Ask what to do
    const action = await select('What would you like to do?', [
      { value: 'respond', label: 'Respond to notifications', hint: 'Generate replies' },
      { value: 'view', label: 'View details', hint: 'See full content' },
      { value: 'skip', label: 'Skip', hint: 'Do nothing' },
    ]);

    if (action === 'skip') {
      output.info('Skipping notifications');
      return;
    }

    if (action === 'view') {
      for (const notif of notifications) {
        output.divider();
        output.info(`Type: ${notif.type}`);
        output.info(`From: u/${notif.username}`);
        output.info(`Subreddit: r/${notif.subreddit}`);
        output.info(`Post: ${notif.postTitle}`);
        output.dim(notif.content);
      }
      return;
    }

    // Respond to notifications
    const personalization = await loadResource(skill, 'personalization_reddit');
    const memory = await readMemory(skill);

    for (const notif of notifications) {
      if (notif.type !== 'reply' && notif.type !== 'mention') {
        continue;
      }

      output.divider();
      output.info(`Responding to u/${notif.username}...`);

      // Generate reply
      const reply = await generateReply(notif, personalization || '', memory);

      // Human-in-loop approval
      const approved = await approveReply(reply, {
        originalComment: notif.content,
        username: notif.username,
      });

      if (!approved) {
        output.info('Reply skipped');
        await appendMemory(skill, 'Notification response', {
          user: `u/${notif.username}`,
          subreddit: `r/${notif.subreddit}`,
        }, 'skipped');
        continue;
      }

      // Post reply
      const posted = await postReply(notif.url, reply);

      if (posted) {
        output.success('Reply posted');
        await appendMemory(skill, 'Notification response', {
          user: `u/${notif.username}`,
          subreddit: `r/${notif.subreddit}`,
        }, 'success');
      } else {
        output.error('Failed to post reply');
        await appendMemory(skill, 'Notification response', {
          user: `u/${notif.username}`,
          error: 'Failed to post',
        }, 'failure');
      }
    }

    output.divider();
    output.success('Notifications processed');

  } catch (error) {
    output.error(`Notifications mode failed: ${error}`);
  } finally {
    await closeBrowser();
  }
}

/**
 * Extract notifications from inbox page
 */
async function extractNotifications(): Promise<Notification[]> {
  return await evaluate(() => {
    const notifications: Notification[] = [];
    
    // Try to find notification items
    const items = document.querySelectorAll('.message, [data-testid="inbox-item"], .thing');
    
    items.forEach((item) => {
      try {
        const authorEl = item.querySelector('.author, a[href*="/user/"]');
        const subredditEl = item.querySelector('.subreddit, a[href*="/r/"]');
        const contentEl = item.querySelector('.md, .body, p');
        const linkEl = item.querySelector('a[href*="/comments/"]');
        const titleEl = item.querySelector('.subject, .title');

        if (authorEl && contentEl) {
          notifications.push({
            type: item.classList.contains('was-comment') ? 'reply' : 'other',
            username: authorEl.textContent?.replace('u/', '').trim() || '',
            subreddit: subredditEl?.textContent?.replace('r/', '').trim() || '',
            content: contentEl.textContent?.trim() || '',
            postTitle: titleEl?.textContent?.trim() || '',
            url: (linkEl as HTMLAnchorElement)?.href || '',
          });
        }
      } catch {
        // Skip malformed items
      }
    });

    return notifications.slice(0, 10);
  });
}

/**
 * Generate a reply to a notification
 */
async function generateReply(
  notification: Notification,
  personalization: string,
  memory: string
): Promise<string> {
  const messages: Message[] = [
    {
      role: 'system',
      content: `You are responding to a Reddit notification. Write a natural reply that matches the user's style.

## Personalization Guide
${personalization}

## Recent Activity
${memory}

Write a reply that:
1. Directly addresses what they said
2. Is friendly and conversational
3. Matches the user's writing style
4. Is concise (1-3 sentences usually)

Output ONLY the reply text.`,
    },
    {
      role: 'user',
      content: `Notification from u/${notification.username} in r/${notification.subreddit}:

"${notification.content}"

Context: ${notification.postTitle}`,
    },
  ];

  const response = await callLLM(messages, 'comment');
  return response.content.trim();
}

/**
 * Post a reply to a notification
 */
async function postReply(url: string, reply: string): Promise<boolean> {
  try {
    await navigate(url);
    await waitForAction();

    // Find reply button and click
    const replySelectors = [
      'button[aria-label*="reply"]',
      '[data-testid="reply-button"]',
      '.reply-button',
      'a:contains("reply")',
    ];

    for (const selector of replySelectors) {
      try {
        await click(selector);
        break;
      } catch {
        continue;
      }
    }

    await waitForAction();

    // Type reply
    const textareaSelectors = [
      'textarea',
      'div[contenteditable="true"]',
      '[data-testid="comment-composer"] textarea',
    ];

    for (const selector of textareaSelectors) {
      try {
        await type(selector, reply);
        break;
      } catch {
        continue;
      }
    }

    await waitForAction();

    // Submit
    const submitSelectors = [
      'button[type="submit"]',
      '[data-testid="comment-submit-button"]',
    ];

    for (const selector of submitSelectors) {
      try {
        await click(selector);
        return true;
      } catch {
        continue;
      }
    }

    return false;
  } catch {
    return false;
  }
}
