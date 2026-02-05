# Agent0

Autonomous CLI for skill-based browser automation.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start Chrome with debugging:**
   ```bash
   # Windows
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222

   # macOS
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

   # Linux
   google-chrome --remote-debugging-port=9222
   ```

3. **Configure environment:**
   Copy `.env.example` to `.env` in the project root and fill in your OpenRouter API key.

4. **Make sure you're logged into Reddit** in the Chrome browser.

## Usage

### Interactive Mode
```bash
npm run dev
```

### Batch Mode (fill daily quota)
```bash
npm run dev batch
```

### Post Comments
```bash
npm run dev comment "Post 3 comments on r/chatgptpro"
npm run dev comment "Write one comment on r/Subreddit"
```

### Check Notifications
```bash
npm run dev notifications
```

### Find Trending Posts
```bash
npm run dev trending
npm run dev trending -r chatgptpro
```

### Agent Mode (LLM Tool Calling)
```bash
npm run dev agent "Write one comment on r/chatgptpro"
npm run dev agent "Check today's tracking and fill remaining quota"
```

The agent uses LLM tool calling to read/write files and control the browser. No custom prompts needed - tool descriptions in the schema tell the LLM when to use each tool.

## CLI Options

```
agent0 [command] [options]

Commands:
  batch              Run batch mode to fill daily quota
  comment [text]     Post comments based on instruction
  notifications      Check and interact with notifications
  trending           Find trending posts for inspiration
  post [text]        Write and post content
  interactive        Start interactive mode (default)

Options:
  -s, --skill        Skill to use (default: reddit-commenter)
  -h, --help         Show help
  -V, --version      Show version
```

## Human-in-the-Loop

Before posting, Agent0 shows the proposed comment and waits 5 seconds for approval:
- Press `y` or Enter to approve immediately
- Press `n` to reject
- Wait 5 seconds to auto-approve

Configure wait time in `.env`: `HUMAN_IN_LOOP_WAIT_MS=5000`

## Models

Agent0 uses multiple models via OpenRouter for different tasks:
- **Summarize**: Fast, cheap model for post analysis (DeepSeek)
- **Comment**: Creative model for writing (Grok)
- **Review**: Careful model for quality check (Claude)

Configure in `.env`:
```env
OPENROUTER_MODEL_SUMMARIZE=deepseek/deepseek-chat
OPENROUTER_MODEL_COMMENT=x-ai/grok-2
OPENROUTER_MODEL_REVIEW=anthropic/claude-3.5-sonnet
```

## Tool Calling

Agent mode uses OpenRouter's tool calling API. The LLM receives these tools:

- **File**: `read_file`, `write_file`, `append_file`, `list_dir`
- **Browser**: `browser_navigate`, `browser_snapshot`, `browser_get_text`, `browser_extract_posts`, `browser_click`, `browser_type`, `browser_scroll`

Tool definitions (name, description, parameters) are passed to the LLM - no custom prompts needed for the LLM to understand when to read/write files. The system prompt includes skill workflow and context.

## Memory

Each skill has a `memory.md` file that tracks recent activity. The last 50 lines are included in prompts for context.

## Development

```bash
# Run in development mode (with tsx)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Type check
npm run typecheck
```
