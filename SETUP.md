# Setup Guide

This guide will help you set up the Auto-Commenter project for Reddit automation.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Creating Your Personalization File](#creating-your-personalization-file)
5. [First Run](#first-run)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required

- **Claude Desktop** or **Claude CLI**
  - Download from: https://claude.ai/download
  - Make sure you're logged in

- **Node.js** (v16 or higher)
  - Download from: https://nodejs.org/
  - Verify installation: `node --version`

- **Reddit Account**
  - You'll need to be logged into Reddit in your browser
  - Account should be in good standing (not new or flagged)

### Recommended

- Basic understanding of Markdown
- Familiarity with Reddit communities
- Text editor (VS Code, Sublime, etc.)

---

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/auto-commenter.git
cd auto-commenter
```

### Step 2: Install Dependencies

```bash
pnpm install
```

This installs all workspace packages (agent0, extension, playwriter).

### Step 3: Browser Control (agent0 CLI)

When using the agent0 CLI for Reddit automation, browser control goes through **Playwriter** and the **Chrome extension**:

1. **Build playwriter** (required for MCP): `pnpm playwriter:build`
2. **Build the extension**: `pnpm extension:build`
3. **Install the extension** in Chrome (load unpacked from `packages/extension/dist`)
4. **Open Chrome** and click the Playwriter extension icon on a tab to enable it
5. **Optional**: Start the relay manually with `pnpm relay` (or let agent0 start it automatically)
6. **Run agent0**: `pnpm agent0 commenter "Post 1 comment on r/chatgptpro"`

The extension connects to the relay at `ws://127.0.0.1:19988/extension`. If the extension is not connected, agent0 will fail with a clear error. Ensure Chrome is open and the extension is enabled on at least one tab.

### Step 4: Verify MCP Setup (Claude/Cursor)

Check that `.mcp/settings.json` exists and contains:

```json
{
  "playwright": {
    "command": "npx",
    "args": [
      "@playwright/mcp@latest"
    ]
  }
}
```

---

## Configuration

### Step 1: Configure Target Subreddits

Edit `.claude/skills/reddit-commenter/resources/subreddits.md`:

1. Keep or remove the example subreddits
2. Add your target subreddits
3. For each subreddit, document:
   - Core community rules
   - Community nature
   - Good topics to answer

**Example:**

```markdown
### r/YourSubreddit

| Item | Content |
|------|---------|
| **Core Community Rules** | • No self-promotion<br>• Be helpful |
| **Community Nature** | • Supportive community<br>• Mix of beginners and experts |
| **Good Topics to Answer** | • Getting started questions<br>• Tool recommendations |
```

### Step 2: Configure Product Information

Edit `.claude/skills/reddit-commenter/resources/product.md`:

Replace the template with your actual product information:

1. Core value proposition
2. Target customer pain points
3. Competitor comparison
4. Reddit-friendly descriptions

**Keep it concise and authentic.**

---

## Creating Your Personalization File

This is the **most important step** - it makes your comments sound like you, not an AI.

### Step 1: Collect Your Comments

Go to Reddit and find 8-10 comments you've written that represent your style:

**Selection Criteria:**
- ✅ Various topics
- ✅ Various lengths (1 sentence to several paragraphs)
- ✅ Various tones (helpful, critical, analytical, humorous)
- ✅ Comments you're proud of
- ❌ Don't pick only your "best" formal comments
- ❌ Include natural, casual comments too

### Step 2: Analyze Your Style

Open Claude and provide this prompt:

```
I need you to analyze my Reddit commenting style and create a personalization guide.

Here are 10 comments I wrote on Reddit:

---
honestly i just keep a notion page with my most-used prompts tagged by category. tried relying on chat history for a while but that's basically gambling lol. the ones i use daily are pinned at the top, everything else gets a quick tag so i can search later. not perfect but way better than scrolling through 200 conversations trying to find that one system prompt i wrote last month.
---
each model required a different prompt style. what I do is, I will search for prompts in the GitHub/x, and collect them in notion. Then I will try it out and save the output, then try with different models, collect them as well. They cherry pick the prompts segments and make it a good prompt.

Again, response will change model to model so, better stick with specific models + prompts per usercase, anyway there will be no nightly builds for model lol, so the output will be constant.

Better define a structured output in your prompt to stay consistent
---
Haha, leave the man alone, he will cry in the shower and come back strong. At least that's all I do personally. They will bounce back, if you hurt them, it will be etched to the bone and they will never forget that.
---
Haha totally out of context, but thats what I thought when seeing that. Let's confuse others lol
---
But you think, they paid for this? I don't know
---
I think, it would be a good idea to make a plugin for that, so you can have it as a browser extension.
---
There's this tool called NotionAI that can help you with this. It's a bit expensive, but it's worth it.
---
I don't know either. Yesterday, I went to the architect, and asked for a floor plan only, to visualise, where things will come and how it looks and so on. We are not intended to receive all the plans as you described.

Even though it is a small buildup area, this is the first time we are attempting to build our home, so we thought having an expert to plan the floor would be a good idea and we got this.

I'm sorry, that i didn't pass the test, but at least I am attempting.😃
---
4 images below the header are not providing any value. Show the stats section there, if needed. Make hero section 50/50 and show rich hero image, combo of the list you have now and a user image
---
Let's connect and have a chat.
---
If we have something that can do code review on each commit or PR merges to point out owasp breaches, that would be helpful for solo developers and vibe coders.
---


Please analyze:
1. My core writing characteristics (tone, sentence structure, vocabulary)
2. Frequently used expressions
3. Expressions I avoid
4. 6-8 style patterns I use (with examples)
5. How I approach different types of posts (humor, questions, discussions)

Then create a personalization guide following this structure:
[paste the structure from personalization_reddit.md template]
```

### Step 3: Review and Refine

Claude will generate a personalization guide. Review it and:

1. Check if the patterns match your style
2. Add any missing characteristics
3. Remove anything that doesn't sound like you
4. Add examples from your actual comments

### Step 4: Save the File

Save the personalization guide as:
`.claude/skills/reddit-commenter/resources/personalization_reddit.md`

**⚠️ Important:** This file contains your personal style. Don't commit it to GitHub if it has identifying information.

---

## First Run

### Test Single Comment

1. Open Claude Desktop
2. Make sure you're logged into Reddit in your browser
3. In Claude, say:

   ```
   Write one comment on r/YourSubreddit using the reddit-commenter skill
   ```

4. Claude will:
   - Check your tracking file
   - Navigate to the subreddit
   - Find a suitable post
   - Analyze the post
   - Write a comment in your style
   - Review it against the checklist
   - Post it
   - Update tracking

### Verify Results

1. Check that comment was posted on Reddit
2. Review the tracking file: `tracking/reddit/[today's-date].md`
3. Verify the comment sounds like you

### If Something Goes Wrong

- Check that you're logged into Reddit
- Verify Playwright MCP is installed: `npx @playwright/mcp@latest --version`
- Make sure personalization file exists
- Check Claude's error messages

---

## Batch Mode Setup

Once single comments work:

### Step 1: Review Quotas

Check `.claude/skills/reddit-commenter/resources/subreddits.md` daily limits:

```markdown
| Subreddit | Daily Limit |
|-----------|-------------|
| r/SubredditA | 3 |
| r/SubredditB | 3 |
```

**Recommendation:** Start with 2-3 subreddits, 3 comments each

### Step 2: Run Batch Mode

```
Fill today's quota using the reddit-commenter skill
```

### Step 3: Monitor Progress

Claude will:
- Report progress after each subreddit
- Wait 5-15 minutes between subreddits
- Skip subreddits with no suitable posts
- Provide a completion report

**Expected duration:** 1-2 hours per subreddit (with wait times)

---

## Troubleshooting

### "Can't find personalization file"

**Solution:**
- Make sure file exists at: `.claude/skills/reddit-commenter/resources/personalization_reddit.md`
- Check file name spelling (including `.md` extension)

### "Page loading failed"

**Possible causes:**
1. Internet connection issue
2. Reddit is down
3. MCP server not running

**Solutions:**
- Check internet connection
- Visit Reddit manually to verify it's up
- Restart Claude Desktop
- Reinstall MCP: `npm install`

### "Comment posting failed"

**Possible causes:**
1. Not logged into Reddit
2. Account rate limited
3. Comment violates subreddit rules

**Solutions:**
- Log into Reddit in your browser
- Wait 30 minutes if rate limited
- Review subreddit rules in `subreddits.md`

### "Comments don't sound like me"

**Solution:**
- Review your personalization file
- Add more examples of your actual comments
- Be more specific in the "Expressions to Use/Avoid" sections
- Test with single comments and refine

### "Rate limit detected"

**This is normal.** Reddit has rate limits to prevent spam.

**Solutions:**
- Wait 30 minutes
- Reduce daily quota
- Increase wait time between subreddits (in BATCH.md)

---

## Best Practices

### Start Small

- Begin with 1-2 subreddits
- Post 2-3 comments per day
- Gradually increase as you get comfortable

### Monitor Quality

- Regularly review your comments on Reddit
- Check if they sound natural
- Refine personalization file based on feedback
- Don't sacrifice quality for quantity

### Respect Communities

- Read subreddit rules carefully
- Don't spam
- Provide genuine value
- Be authentic

### Maintain Activity

- Consistent activity is better than bursts
- Space out comments throughout the day
- Don't max out quotas every day
- Mix in manual comments too

---

## Next Steps

After setup is complete:

1. ✅ Test single comment workflow
2. ✅ Review and refine personalization
3. ✅ Configure target subreddits
4. ✅ Set up product information
5. ✅ Test batch mode
6. ✅ Monitor and adjust

**Remember:** This is a tool to enhance your Reddit engagement, not replace genuine interaction. Always prioritize authenticity and value.

---

## Support

- Check [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines
- Open an issue for bugs or questions
- Review existing issues for common problems

Happy commenting!
