# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Auto-Commenter is a marketing automation framework built as a **Claude AI Skill** that uses **Playwright MCP** for browser automation. It generates personalized Reddit comments that match a user's actual writing style. There is no traditional source code — the entire system is defined through markdown skill files and resource templates.

## Setup Commands

```bash
npm install                    # Install dependencies (Playwright MCP)
```

There are no build, test, or lint scripts. The project runs entirely through Claude Skills invoked via natural language commands in Claude Desktop/CLI.

## Architecture

### Skill System

The core logic lives in `.claude/skills/reddit-commenter/`:

- **SKILL.md** — Defines the 8-step single comment workflow (check tracking → explore subreddit → analyze post → write comment → personalization review → post → judge leads → update tracking)
- **BATCH.md** — Wraps SKILL.md in a loop to fill daily quotas across all subreddits (default: 24 comments = 8 subreddits x 3 each), with 5-15 min waits between subreddit transitions

### Resource Files (`.claude/skills/reddit-commenter/resources/`)

- **personalization_reddit.md** — User's writing style profile generated from their real comments. Contains 16-point quality checklist, 8 style patterns, expressions to use/avoid. This is the most critical configuration file.
- **subreddits.md** — Target communities with rules, nature, and good topics per subreddit
- **product.md** — Product info template for lead identification context

### Data Files

- **tracking/reddit/YYYY-MM-DD.md** — Daily activity logs (comment counts per subreddit, timestamped entries with links). Created from `tracking/reddit/template.md`.
- **leads/reddit.md** — Discovered potential customers with relevance classification

### Browser Automation

Playwright MCP (configured in `.mcp/settings.json`) provides browser control via these tools: `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_wait_for`. Never use `browser_take_screenshot` — use `browser_snapshot` (accessibility tree) instead.

## Key Workflow Details

- Step 3 (deep post analysis) is mandatory before writing any comment — never skip it
- Personalization review (Step 5) is a loop: any checklist violation requires rewriting and re-reviewing
- When a post contains links requesting feedback, visit the actual site before commenting
- Duplicate detection: check today's tracking file to ensure no repeat comments on the same post
- Token efficiency: pass only minimal info to Playwright MCP calls, navigate directly to URLs instead of clicking

## Adding New Platforms

Copy the reddit-commenter skill directory structure to `.claude/skills/[platform]-commenter/`, adapt SKILL.md and BATCH.md for the platform's UI and rules, create matching tracking and leads templates.

## Gitignore Strategy

Personal data is excluded from version control: actual tracking logs (`tracking/reddit/*.md` except template), personalization files with `.personal` suffix, `.env` files. Templates and skill definitions are committed.

## Commit Message Convention

`Add:` new features, `Fix:` bug fixes, `Update:` existing feature changes, `Docs:` documentation, `Refactor:` restructuring.
