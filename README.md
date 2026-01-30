# Auto-Commenter

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> AI-powered marketing automation that writes natural, human-like comments on Reddit (and other platforms)

Auto-Commenter uses Claude AI to analyze your personal writing style and automatically engage with Reddit communities in an authentic, value-adding way. Unlike typical automation tools that produce obvious bot comments, this system learns from your actual writing to maintain your unique voice.

**🚀 Perfect for:**
- Indie hackers promoting their products
- Developer advocates building community presence
- Marketers seeking authentic engagement
- Anyone wanting to scale their community participation

**✨ Key Differentiators:**
- Learns YOUR writing style from real comments
- Deep post analysis (not keyword-based)
- 16-point quality checklist prevents AI-sounding comments
- Built-in lead identification
- Respects community guidelines
- Extensible to multiple platforms

---

## Project Overview

This project is a marketing automation system that automatically writes natural and valuable comments on Reddit communities. It uses Claude AI and Playwright MCP to write comments as naturally as a human and identifies potential customers.

### Why Auto-Commenter?

Traditional marketing automation tools produce robotic, spammy comments that get flagged immediately. Auto-Commenter is different:

- **Learns your style**: Analyzes your actual comments to replicate your writing patterns
- **Context-aware**: Reads posts thoroughly before responding, understands intent
- **Quality-focused**: Includes 16-point review checklist to ensure natural comments
- **Community-respectful**: Follows subreddit rules, avoids spam, provides real value
- **Extensible**: Easily adapt to other platforms (Twitter, LinkedIn, etc.)

### Key Features

- **Automated Comment Writing**: Automatically generates natural comments after analyzing Reddit posts
- **Personalized Style**: Learns from actual user's comment style to write without AI tell-tale signs
- **Batch Mode**: Batch execution that automatically fills daily quota
- **Potential Customer Tracking**: Automatically identifies and records potential customers related to your product
- **Activity Tracking**: Automatic tracking of daily activity by subreddit
- **Multi-Platform Ready**: Architecture supports adding Twitter, LinkedIn, and other platforms

### How It Works

1. **Analyzes posts** - Reads post content, existing comments, and community tone
2. **Understands context** - Identifies what OP is actually asking for
3. **Writes in your style** - Uses your personalization guide to draft comment
4. **Reviews quality** - Checks 16-point checklist for naturalness
5. **Posts comment** - Submits comment and tracks activity
6. **Identifies leads** - Flags potential customers based on product relevance

---

## Project Structure

```
auto-commenter/
├── .claude/
│   └── skills/
│       └── reddit-commenter/
│           ├── SKILL.md             # Single comment workflow (Step 1-8)
│           ├── BATCH.md             # Batch mode execution rules
│           └── resources/
│               ├── personalization_reddit.md  # Reddit personalization style guide
│               ├── subreddits.md    # Target subreddit guide
│               └── product.md       # Product information (for potential customer judgment)
│
├── tracking/
│   └── reddit/
│       ├── template.md              # Daily tracking template
│       └── YYYY-MM-DD.md            # Activity records by date
│
├── leads/
│   └── reddit.md                    # Potential customer list
│
└── README.md                        # This file
```

---

## Getting Started

👉 **New users**: See [SETUP.md](SETUP.md) for detailed setup instructions

👉 **Contributors**: See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines

### Quick Start

1. **Clone and install**
   ```bash
   git clone https://github.com/YOUR_USERNAME/auto-commenter.git
   cd auto-commenter
   npm install
   ```

2. **Create personalization file**
   - Collect 8-10 of your Reddit comments
   - Use Claude to analyze your style
   - Save as `personalization_reddit.md`
   - See [SETUP.md](SETUP.md) for detailed instructions

3. **Configure**
   - Edit `resources/subreddits.md` with your target subreddits
   - Edit `resources/product.md` with your product info

4. **Test**
   ```
   "Write one comment on r/YourSubreddit"
   ```

For complete setup instructions, see [SETUP.md](SETUP.md).

---

## Usage

### Single Comment Writing

```
"Write one comment on r/ClaudeAI"
```

**Execution Process:**
1. Check today's activity status
2. Access the subreddit (New or Rising)
3. Analyze post (OP intent, existing comment tone, etc.)
4. Write comment
5. Personalization review (16-item checklist)
6. Post comment
7. Judge potential customer (optional)
8. Update tracking

### Batch Mode (Fill Quota)

```
"Fill today's quota"
```

**Execution Process:**
1. Check tracking file
2. Complete quota (3) one subreddit at a time
3. Wait 5-15 minutes between subreddits
4. Move to next subreddit
5. Repeat until all 24 completed

**Expected Duration:** 3-5 hours (8 subreddits × 3)

---

## Target Subreddits

| Subreddit | Subscribers | Daily Limit | Special Attention |
|-----------|-------------|-------------|-------------------|
| r/WebDev | ~2.8M | 3 | No project promotion except Saturday |
| r/ClaudeAI | ~180K | 3 | - |
| r/Cursor | ~30K | 3 | - |
| r/LocalLLaMA | ~450K | 3 | **Absolutely NO commercial expressions** |
| r/ChatGPT | ~6.9M | 3 | Use general public language |
| r/SideProject | ~330K | 3 | Promotion possible |
| r/Obsidian | ~190K | 3 | - |
| r/Rag | ~15K | 3 | Technical depth needed |
| **Total** | | **24/day** | |

---

## Activity Rules

| Rule | Setting |
|------|---------|
| Daily limit per subreddit | 3 |
| Wait time between subreddit transitions | 5-15 minutes |
| Active hours | 9AM-11PM US time |
| Weekend activity | 70% of weekday |

---

## Personalization Checklist (16 Items)

Items automatically reviewed when writing comments:

1. Directness - straight to the point
2. Remove greetings
3. Sentence length - short or naturally long
4. Personal experience - only what you'd realistically experience
5. Critical attitude
6. Constructive suggestions
7. Analytical approach
8. Remove cliché closings
9. No em-dash usage
10. Bullet points - only for complex explanations
11. Technical accuracy
12. Context appropriateness
13. Don't overuse "me too"
14. AI detection prevention
15. **Question intent understanding (CRITICAL)**
16. **Site verification (CRITICAL)**

---

## Cautions

### Maintain Naturalness
- Even in batch mode, each comment is written carefully and individually
- Don't skip review
- Boldly skip if no suitable posts

### Rate Limiting
- Too fast activity risks account restrictions
- Maintain sufficient wait time between subreddits

### Follow Community Rules
- Must check each subreddit's rules
- Avoid actions that could be mistaken as spam
- Absolutely NO copy-pasting same content

---

## Troubleshooting

### "Page Loading Failed"
- Wait 30s then retry (max 3 times)
- Restart Playwright MCP

### "Comment Posting Failed"
- Check login session
- Move to next post

### "Rate Limit Detected"
- Wait 30 min then resume
- Need to adjust activity intervals

---

## File Roles

| File | Role | Modification Frequency |
|------|------|------------------------|
| `SKILL.md` | Define single comment workflow | Low |
| `BATCH.md` | Define batch mode rules | Low |
| `personalization_reddit.md` | Personalization style guide | **Medium** (reflect feedback) |
| `subreddits.md` | Subreddit guide | Low |
| `product.md` | Product information | Medium |
| `tracking/reddit/YYYY-MM-DD.md` | Daily activity records | **High** (automatic) |
| `leads/reddit.md` | Potential customer list | **High** (automatic) |

---

## Adding Other Platforms

This project can be extended to platforms other than Reddit.

### New Platform Addition Process

1. **Create Personalization File**
   - Create `personalization_[platform].md` file
   - Analyze 8-10 of your comments on that platform
   - Reflect platform characteristics (e.g., Twitter has 280 character limit)

2. **Create Skill**
   - Create `.claude/skills/[platform]-commenter/` folder
   - Write `SKILL.md`, `BATCH.md`
   - Add necessary guides to `resources/` folder

3. **Add Tracking Structure**
   - Create `tracking/[platform]/` folder
   - Write `template.md`

4. **Add Leads File**
   - Create `leads/[platform].md` file

---

## Responsible Use

### Ethics & Guidelines

This tool is designed to **enhance** genuine community engagement, not replace it. Please use responsibly:

#### ✅ Good Practices

- **Provide real value**: Only comment when you have something useful to contribute
- **Be authentic**: Use your real writing style, don't pretend to be someone you're not
- **Follow community rules**: Respect each subreddit's specific guidelines
- **Mix in manual engagement**: Don't automate 100% of your Reddit activity
- **Quality over quantity**: Better to post fewer high-quality comments
- **Disclose when appropriate**: If asked directly, be honest about automation assistance

#### ❌ What NOT to Do

- **Don't spam**: Avoid posting just to hit quotas
- **Don't deceive**: Don't claim personal experiences you haven't had
- **Don't abuse**: Don't violate Reddit's terms of service
- **Don't brigade**: Don't coordinate mass commenting on specific posts
- **Don't ignore feedback**: If community members say your comments seem off, listen
- **Don't over-automate**: Maintain genuine, manual participation too

### Reddit's Automation Policy

From [Reddit's Content Policy](https://www.redditinc.com/policies/content-policy):

> "Respect the platform and your fellow redditors"

While Reddit doesn't prohibit all automation, they do prohibit:
- Vote manipulation
- Spam
- Deceptive practices
- Content that impersonates individuals or entities

**Our stance:** This tool helps scale authentic engagement, not create fake engagement. Use it to be more present in communities you genuinely care about, not to manipulate or deceive.

### Account Safety

To protect your Reddit account:

1. **Start slow**: Begin with 2-3 comments per day
2. **Gradually increase**: Slowly raise activity over weeks
3. **Vary timing**: Don't post at exact intervals
4. **Mix platforms**: Don't only use automation
5. **Monitor**: Watch for rate limits or warnings
6. **Be ready to stop**: If flagged, pause immediately

### Legal Disclaimer

This software is provided "as is" without warranty. Users are responsible for:
- Compliance with Reddit's Terms of Service
- Compliance with applicable laws
- All content posted using this tool
- Any consequences of automated posting

**By using this tool, you agree to use it responsibly and ethically.**

---

## License

MIT License - see [LICENSE](LICENSE) file for details

---

## Acknowledgments

- Built with [Claude AI](https://claude.ai) by Anthropic
- Uses [Playwright MCP](https://github.com/executeautomation/playwright-mcp) for browser automation
- Inspired by the need for authentic community engagement at scale

---

## Questions or Issues?

- 📖 **Setup help**: See [SETUP.md](SETUP.md)
- 🐛 **Found a bug**: [Open an issue](../../issues/new?template=bug_report.md)
- 💡 **Feature idea**: [Request a feature](../../issues/new?template=feature_request.md)
- 🤝 **Want to contribute**: See [CONTRIBUTING.md](CONTRIBUTING.md)

---

**⚠️ Use responsibly. Respect communities. Provide value.**

---

> See detailed guides in each file for more information.
