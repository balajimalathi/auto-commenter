---
name: twitter-commenter
description: A skill for writing natural and valuable replies on X/Twitter. Includes the complete workflow from target exploration, reply writing, review, posting, to tracking.
license: MIT
---

# Twitter/X Commenter Skill

> X/Twitter Reply Automation - From Exploration to Posting and Tracking

---

## Required Tools: Agent0 + Playwriter

This skill runs inside **Agent0** and uses:

- Agent0 file tools (`read_file`, `write_file`, `append_file`, `list_dir`) for tracking, personalization, and leads
- `playwriter_execute` to run Playwright code in the browser using pre-defined snippets

### Browser Automation (Playwriter)

Browser interaction is handled through `playwriter_execute` and the **Playwriter Snippets** resource. The concrete selectors and code live in the snippets; this skill file describes the high-level workflow:

- **Navigation**: Use the Navigation snippet to go directly to `https://x.com/home`, then use timeline-tab snippets to click one of the home timeline tabs (`For you`, `Following`, `Build in Public`, `Fail in Public`, `Smol`)
- **Reading content**: Use text-extraction snippets to read tweet content and replies from the currently selected home timeline
- **Replying**: Use snippets to focus the reply composer, type the reviewed reply, and submit it
- **Reply-only behavior**: Only reply to existing tweets in the selected home timeline tab. Never compose standalone tweets or quote tweets from this skill.

### Important Notes When Using Playwriter
- **Minimize tokens**: When calling `playwriter_execute`, don't pass the entire conversation context — only concisely summarize the essential information
- **Direct navigation**: Prefer direct URL navigation using the Navigation snippet rather than clicking through multiple elements
- **Concise instructions**: Keep snippet usage focused: "navigate to [URL]", "click [element]", "type: [text]"
- **Character limit**: X/Twitter replies have a 280-character limit. Always check length before posting.

---

## Execution Workflow

### Step 1: Check Activity Status and Select Timeline Tab

```
1. Check today's date file in tracking/twitter/ folder
   → File name: YYYY-MM-DD.md (e.g., 2026-02-06.md)
   → If file doesn't exist, create new one referencing template.md

2. Check activity status table by target (home timeline tab):
   - How many replies posted for each tab today
   - Check tabs under their daily limit
   - Check last reply time (minimum 5-10 minute intervals)

3. Select next home timeline tab for replying (one of: `For you`, `Following`, `Build in Public`, `Fail in Public`, `Smol`):
   - Prioritize tabs with no activity today or under limit
   - Prioritize tabs with oldest last activity time
   - When multiple tabs have remaining quota, avoid selecting the same tab that was used for the last reply if another tab is available (to naturally mix activity across tabs)

4. Check tab/target specifics in resources/targets.md:
   - Target type (e.g. home timeline tab)
   - Community nature / typical content for that tab
   → Note: This is informational only - you will reply to ALL tweets regardless of topic
```

### Step 2: Access Home Timeline and Explore Tweets

```
1. Access the X/Twitter home timeline using Playwriter snippets
   → Navigate directly to "https://x.com/home"
   → Use timeline-tab snippets to click the selected tab from Step 1 (`For you`, `Following`, `Build in Public`, `Fail in Public`, or `Smol`)

2. ⚠️ CRITICAL: ALWAYS filter to "Recency" after clicking any tab:
   → Click the tab's SVG icon to open the filter menu
   → Select `Recency` from the menu
   → This ensures you always see the most recent tweets first
   → Apply this pattern to ALL tabs (not just `Following`)

3. Extract the top 10 tweets from the filtered timeline
   → Use Playwriter snippets to read the list of tweets and their links
   → Always limit extraction to the top 10 tweets (most recent)

4. Criteria for selecting tweets to reply to:
   • ⚠️ CRITICAL: Tweets you haven't replied to today
     - Check activity log in tracking/twitter/today's-date.md file
     - Extract list of tweet URLs from today's replies
     - Verify selected tweet URL is NOT in that list
     - Absolutely NO duplicate replies on same tweet
   • **Reply to EVERY tweet you see** - no filtering by topic, engagement, or relevance
   • Simply pick the first tweet from the timeline that you haven't replied to today
   • This skill never creates new tweets; always select an existing tweet from the timeline and plan to use its **Reply** button.

5. Secure URL of selected tweet
   → Check and record tweet link
   → Navigate directly to this URL in next Step
```

### Step 3: Deep Analysis of Tweet Content and Existing Replies

```
⚠️ CRITICAL: Must perform this step before writing reply

0. Navigate directly to tweet
   → Use Navigation snippet to open the tweet URL secured in Step 2
   → Navigate directly to URL, don't click on tweet (prevents click errors)
   → Use Playwriter snippets to read the tweet and replies

1. Read tweet content accurately:
   - Understand what the author is actually saying/asking
   - Don't react only to keywords — understand full context
   - Distinguish between opinions, questions, and statements

2. Understand author's intent:
   - Asking for help/advice? (problem solving)
   - Sharing an opinion? (discussion)
   - Sharing news/announcement? (information)
   - Venting/complaining? (empathy)
   - Promoting something? (engagement)

3. Analyze existing replies:
   - Check how others interpreted the tweet
   - Understand the conversation tone
   - Don't repeat what others already said

4. Decide reply direction:
   - Is this tweet worth replying to?
   - From what angle should I reply?
   - Can I naturally reply in my style?

5. ⚠️ CRITICAL: Determine if link verification needed:
   - Did the author provide a link?
   - Is feedback requested on a product/website?

   → If YES:
     • Visit actual site using the Navigation snippet
     • Check the content using Playwriter text/snapshot snippets
     • Write feedback based ONLY on what you actually saw

   → If NO:
     • Can reply from tweet content alone

⚠️ Proceed to Step 4 only after clearly verifying analysis results
```

### Step 4: Write Reply

```
1. Draft reply based on Step 3 analysis results:
   - Answer matching author's actual point/question
   - Practically helpful or genuinely engaging content
   - Match X/Twitter conversational tone
   - Focus on 1 clear point (280 char limit)

2. Character count check:
   - Must be ≤ 280 characters
   - If too long, trim to essential message
   - Shorter is usually better on X/Twitter
```

### Step 5: Personalization Review (Loop)

```
1. Check resources/personalization_twitter.md file
   → Check personalization checklist items based on actual reply style
   → Especially important: tone, brevity, natural language

2. Check style patterns:
   • Does it match your X/Twitter voice?
   • Is it concise enough for the platform?
   • Does it look like you wrote it?

3. Review process:
   • All items PASS → Proceed to Step 6
   • Any violation → Revise reply and re-review from Step 5 beginning
```

**Detailed personalization guide**: See `resources/personalization_twitter.md`

### Step 6: Post Reply

```
1. Click the reply button on the tweet
   → Use Playwriter snippets to click the reply button for the selected tweet (for example, using a button name like "282 Replies. Reply" or the generic reply button locator)

2. Focus the reply textbox
   → Use Playwriter snippets to click the `Post text` textbox so the cursor is active in the reply composer

3. Input reply content
   → Use Playwriter snippets to fill or type the reviewed reply text into the `Post text` textbox

4. Click post/reply button
   → Use Playwriter snippets (for example, `page.getByTestId('tweetButton').click()` or `tweetButtonInline`) to submit the reply

5. Verify reply posted
   → Confirm the reply appeared in the thread
```

### Step 7: Judge Potential Customer (Optional)

```
⚠️ CRITICAL: Judge accurately by referring to Step 3 analysis again

→ Refer to "Lead Selection Criteria" in leads/twitter.md
→ Classify as lead only users with actual problems/needs (not just opinions)

When lead discovered, update leads/twitter.md:
  - Username, tweet URL
  - Tweet summary, selection reason, relevance
```

### Step 8: Update Tracking

```
Update tracking/twitter/[today's-date].md file:

1. Activity status table by target:
   - Increment reply count for that target by +1
   - Update last reply time

2. Add to activity log:
   ### [HH:MM] Tab: [For you / Following / Build in Public / Fail in Public / Smol]
   - **Tweet**: [Author - First 50 chars](URL)
   - **Topic Summary**: One-line summary of tweet content
   - **Reply Content**:
   ```
   Full reply written
   ```

3. When potential customer discovered:
   - Update 'leads/twitter.md' when potential customer discovered
```

### Step 9: Return to Timeline (Batch Mode Only)

```
⚠️ CRITICAL for batch mode: After posting a reply on the /status/ page, navigate back to the home timeline to continue with the next tweet.

1. Navigate back to home timeline
   → Use Playwriter Navigation snippet: await page.goto('https://x.com/home')
   → Wait for page to load

2. The previously selected tab and "Recency" filter should still be active
   → If the tab/filter is lost, re-click the tab and re-apply the "Recency" filter
   → Otherwise, proceed directly to extract the next tweet

3. Continue with next tweet from the extracted list (from Step 2)
   → If all tweets from the current extraction have been processed, extract a new batch of top 10 tweets
   → Return to Step 3 to process the next tweet

Note: In single reply mode, this step is not needed - the workflow ends after Step 8.
```

---

## File Reference Rules (Token Savings)

| File | Reference Timing |
|------|------------------|
| `resources/targets.md` | Step 1 (target selection) |
| `resources/personalization_twitter.md` | Step 5 (review) |
| `resources/product.md` | Step 7 (potential customer judgment) |
| `leads/twitter.md` | Step 7 (lead criteria check) |

→ Reference only at relevant Step, don't read in advance

---

## Cautions

1. **Login Required**: Check X/Twitter account login status
2. **Rate Limiting**: Too fast activity risks account restrictions
3. **Character Limit**: All replies must be ≤ 280 characters
4. **Spam Prevention**: Absolutely NO copy-pasting same content
5. **Review Required**: Rewrite if any checklist item violated
6. **Step 3 Required**: NEVER write reply without analyzing tweet content
7. **Minimize Playwriter call tokens**: Keep snippet usage small and focused
8. **Tweet Navigation**: Use direct URL navigation instead of clicking tweets
