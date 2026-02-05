#!/usr/bin/env node

// src/index.ts
import { config } from "dotenv";
import { resolve } from "path";
import { existsSync as existsSync4 } from "fs";

// src/cli.ts
import { Command } from "commander";
import * as p2 from "@clack/prompts";

// src/ui/output.ts
import chalk from "chalk";
import boxen from "boxen";
var output = {
  header(title) {
    console.log(
      boxen(chalk.bold.cyan(title), {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "cyan"
      })
    );
  },
  success(message) {
    console.log(chalk.green("\u2713"), chalk.green(message));
  },
  error(message) {
    console.log(chalk.red("\u2717"), chalk.red(message));
  },
  warning(message) {
    console.log(chalk.yellow("\u26A0"), chalk.yellow(message));
  },
  info(message) {
    console.log(chalk.cyan("\u2139"), chalk.cyan(message));
  },
  dim(message) {
    console.log(chalk.dim(message));
  },
  timestamp() {
    return chalk.dim(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}]`);
  },
  log(message) {
    console.log(`${this.timestamp()} ${message}`);
  },
  step(stepNumber, total, message) {
    console.log(
      chalk.dim(`[${stepNumber}/${total}]`),
      message
    );
  },
  divider() {
    console.log(chalk.dim("\u2500".repeat(50)));
  },
  comment(text3, title = "Proposed Comment") {
    console.log(
      boxen(text3, {
        title,
        titleAlignment: "center",
        padding: 1,
        margin: { top: 1, bottom: 1, left: 0, right: 0 },
        borderStyle: "round",
        borderColor: "green"
      })
    );
  },
  post(title, content) {
    console.log(
      boxen(`${chalk.bold(title)}

${content}`, {
        title: "Post Preview",
        titleAlignment: "center",
        padding: 1,
        margin: { top: 1, bottom: 1, left: 0, right: 0 },
        borderStyle: "round",
        borderColor: "blue"
      })
    );
  },
  progress(current, total, label) {
    const percentage = Math.round(current / total * 100);
    const barLength = 30;
    const filled = Math.round(current / total * barLength);
    const empty = barLength - filled;
    const bar = chalk.green("\u2588".repeat(filled)) + chalk.dim("\u2591".repeat(empty));
    process.stdout.write(`\r${bar} ${percentage}% ${chalk.dim(label)}`);
    if (current === total) {
      console.log();
    }
  },
  table(data) {
    if (data.length === 0) return;
    const keys = Object.keys(data[0]);
    const widths = keys.map(
      (k) => Math.max(k.length, ...data.map((row) => String(row[k]).length))
    );
    console.log(
      chalk.bold(
        keys.map((k, i) => k.padEnd(widths[i])).join(" | ")
      )
    );
    console.log(chalk.dim(widths.map((w) => "\u2500".repeat(w)).join("\u2500\u253C\u2500")));
    data.forEach((row) => {
      console.log(
        keys.map((k, i) => String(row[k]).padEnd(widths[i])).join(" | ")
      );
    });
  },
  json(data) {
    console.log(chalk.dim(JSON.stringify(data, null, 2)));
  }
};

// src/ui/banner.ts
import chalk2 from "chalk";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
var OCTOPUS = [
  "  \u2588\u2588\u2588\u2588\u2588  ",
  " \u2588\u2588 \u2588 \u2588\u2588 ",
  "  \u2588\u2588\u2591\u2588\u2588  "
];
var OCTOPUS_WIDTH = 7;
function getVersion() {
  try {
    const agent0Root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
    const pkg = JSON.parse(
      readFileSync(join(agent0Root, "package.json"), "utf-8")
    );
    return pkg.version || "1.0.0";
  } catch {
    return "1.0.0";
  }
}
function getCwd() {
  return process.cwd();
}
function renderBanner(version, cwd2) {
  const title = chalk2.bold("Agent0") + chalk2.dim(" v" + version);
  const subtitle = chalk2.dim("Autonomous CLI \xB7 Browser automation");
  const pathLine = chalk2.dim(cwd2);
  const rightLines = [title, subtitle, pathLine];
  const maxRows = Math.max(OCTOPUS.length, rightLines.length);
  let output2 = "\n";
  for (let i = 0; i < maxRows; i++) {
    const left = OCTOPUS[i] || " ".repeat(OCTOPUS_WIDTH);
    const right = rightLines[i] || "";
    const leftColored = chalk2.hex("#f97316")(left);
    output2 += "  " + leftColored + "  " + right + "\n";
  }
  output2 += "\n";
  return output2;
}
function showBanner() {
  const version = getVersion();
  const cwd2 = getCwd();
  process.stdout.write(renderBanner(version, cwd2));
}

// src/skill-loader.ts
import { readdir, readFile } from "fs/promises";
import { join as join2, dirname as dirname2 } from "path";
import { existsSync } from "fs";
var SKILLS_DIR = ".claude/skills";
var TRACKING_DIR = "tracking";
var LEADS_DIR = "leads";
function getProjectRoot() {
  let current = process.cwd();
  while (current !== dirname2(current)) {
    const skillsPath = join2(current, SKILLS_DIR);
    if (existsSync(skillsPath)) {
      return current;
    }
    current = dirname2(current);
  }
  return process.cwd();
}
async function discoverSkills() {
  const skillsPath = join2(getProjectRoot(), SKILLS_DIR);
  if (!existsSync(skillsPath)) {
    return [];
  }
  const entries = await readdir(skillsPath, { withFileTypes: true });
  const skills = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillMdPath = join2(skillsPath, entry.name, "SKILL.md");
      if (existsSync(skillMdPath)) {
        skills.push(entry.name);
      }
    }
  }
  return skills;
}
function extractPlatform(skillName) {
  const parts = skillName.split("-");
  return parts[0];
}
async function loadSkill(skillName) {
  const root = getProjectRoot();
  const skillPath = join2(root, SKILLS_DIR, skillName);
  const platform = extractPlatform(skillName);
  if (!existsSync(skillPath)) {
    throw new Error(`Skill not found: ${skillName}`);
  }
  const skillMdPath = join2(skillPath, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    throw new Error(`SKILL.md not found for skill: ${skillName}`);
  }
  const skillContent = await readFile(skillMdPath, "utf-8");
  const batchMdPath = join2(skillPath, "BATCH.md");
  const batchContent = existsSync(batchMdPath) ? await readFile(batchMdPath, "utf-8") : null;
  const resourcesPath = join2(skillPath, "resources");
  const resources = {};
  if (existsSync(resourcesPath)) {
    const resourceFiles = await readdir(resourcesPath);
    for (const file of resourceFiles) {
      if (file.endsWith(".md")) {
        const resourceName = file.replace(".md", "");
        resources[resourceName] = await readFile(
          join2(resourcesPath, file),
          "utf-8"
        );
      }
    }
  }
  const trackingPath = join2(root, TRACKING_DIR, platform);
  const leadsPath = join2(root, LEADS_DIR, `${platform}.md`);
  const memoryPath = join2(skillPath, "memory.md");
  return {
    name: skillName,
    platform,
    skillPath,
    skillContent,
    batchContent,
    resources,
    trackingPath,
    leadsPath,
    memoryPath
  };
}
async function loadResource(skill, resourceName) {
  if (skill.resources[resourceName]) {
    return skill.resources[resourceName];
  }
  const resourcePath = join2(skill.skillPath, "resources", `${resourceName}.md`);
  if (existsSync(resourcePath)) {
    const content = await readFile(resourcePath, "utf-8");
    skill.resources[resourceName] = content;
    return content;
  }
  return null;
}
function getTodayTrackingPath(skill) {
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  return join2(skill.trackingPath, `${today}.md`);
}
async function loadTracking(skill) {
  const trackingFile = getTodayTrackingPath(skill);
  if (existsSync(trackingFile)) {
    return await readFile(trackingFile, "utf-8");
  }
  const templatePath = join2(skill.trackingPath, "template.md");
  if (existsSync(templatePath)) {
    return await readFile(templatePath, "utf-8");
  }
  return null;
}
function parseSubreddits(subredditsContent) {
  const subreddits = [];
  const tableRegex = /\|\s*r\/(\w+)\s*\|[^|]*\|\s*(\d+)\s*\|/g;
  let match;
  while ((match = tableRegex.exec(subredditsContent)) !== null) {
    subreddits.push({
      name: match[1],
      dailyLimit: parseInt(match[2], 10)
    });
  }
  return subreddits;
}
function parseTracking(trackingContent) {
  const activities = [];
  const tableRegex = /\|\s*r\/(\w+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([^|]*)\s*\|/g;
  let match;
  while ((match = tableRegex.exec(trackingContent)) !== null) {
    activities.push({
      subreddit: match[1],
      todayComments: parseInt(match[2], 10),
      dailyLimit: parseInt(match[3], 10),
      lastComment: match[4].trim() === "-" ? null : match[4].trim()
    });
  }
  return activities;
}

// src/memory.ts
import { readFile as readFile2, appendFile, writeFile } from "fs/promises";
import { existsSync as existsSync2 } from "fs";
var DEFAULT_MEMORY_LINES = 50;
async function readMemory(skill, lines = DEFAULT_MEMORY_LINES) {
  const { memoryPath } = skill;
  if (!existsSync2(memoryPath)) {
    return "(No previous activity recorded)";
  }
  try {
    const content = await readFile2(memoryPath, "utf-8");
    const allLines = content.trim().split("\n").filter(Boolean);
    const lastLines = allLines.slice(-lines);
    if (lastLines.length === 0) {
      return "(No previous activity recorded)";
    }
    return lastLines.join("\n");
  } catch {
    return "(No previous activity recorded)";
  }
}

// src/ui/progress.ts
import ora from "ora";
import chalk3 from "chalk";
function createSpinner(text3) {
  const spinner = ora({
    text: text3,
    spinner: "dots"
  });
  return {
    start(newText) {
      if (newText) spinner.text = newText;
      spinner.start();
    },
    stop() {
      spinner.stop();
    },
    succeed(newText) {
      spinner.succeed(newText);
    },
    fail(newText) {
      spinner.fail(newText);
    },
    warn(newText) {
      spinner.warn(newText);
    },
    info(newText) {
      spinner.info(newText);
    },
    get text() {
      return spinner.text;
    },
    set text(value) {
      spinner.text = value;
    }
  };
}

// src/tools.ts
import { readFile as readFile3, writeFile as writeFile2, appendFile as appendFile2, readdir as readdir2 } from "fs/promises";
import { join as join3 } from "path";
import { existsSync as existsSync3 } from "fs";

// src/playwriter-client.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
var client = null;
var transport = null;
async function connect() {
  if (client) {
    return;
  }
  transport = new StdioClientTransport({
    command: "playwriter",
    args: ["mcp"],
    stderr: "pipe",
    env: { ...process.env }
  });
  client = new Client({
    name: "agent0",
    version: "1.0.0"
  });
  await client.connect(transport);
  await client.ping();
}
async function disconnect() {
  if (client) {
    try {
      await client.close();
    } catch {
    }
    client = null;
  }
  transport = null;
}
function isConnected() {
  return client !== null;
}
async function callExecute(code, timeout = 3e4) {
  if (!client) {
    throw new Error("Playwriter MCP not connected. Call connect() first.");
  }
  const result = await client.callTool(
    { name: "execute", arguments: { code, timeout } },
    void 0,
    { timeout: timeout + 15e3 }
  );
  const content = result.content;
  if (result.isError) {
    const text4 = extractText(content);
    return { text: text4, isError: true };
  }
  const text3 = extractText(content);
  return { text: text3, isError: false };
}
function extractText(content) {
  const list = content ?? [];
  const textPart = list.find((c) => c.type === "text" && c.text != null);
  return textPart && typeof textPart.text === "string" ? textPart.text : "";
}

// src/browser.ts
var DEFAULT_TIMEOUT = 3e4;
function escapeForCode(s) {
  return JSON.stringify(s);
}
function extractReturnValue(text3) {
  const marker = "[return value] ";
  const idx = text3.indexOf(marker);
  if (idx === -1) return null;
  return text3.slice(idx + marker.length).replace(/\n$/, "").trim();
}
async function connectBrowser() {
  if (isConnected()) {
    return;
  }
  const spinner = createSpinner("Connecting to browser (Playwriter + extension)...");
  spinner.start();
  try {
    await connect();
    spinner.succeed("Connected to browser");
  } catch (error) {
    spinner.fail("Failed to connect to browser");
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${msg}

Ensure: 1) Chrome is open with the Playwriter extension installed. 2) Extension is connected (click the extension icon on a tab). 3) Run \`pnpm relay\` if the relay server is not running.`
    );
  }
}
async function closeBrowser() {
  await disconnect();
}
async function navigate(url) {
  const code = `await page.goto(${escapeForCode(url)}, { waitUntil: 'domcontentloaded', timeout: ${DEFAULT_TIMEOUT} }); await page.waitForTimeout(2000);`;
  const result = await callExecute(code, DEFAULT_TIMEOUT + 5e3);
  if (result.isError) {
    throw new Error(result.text);
  }
}
async function getAccessibilityTree() {
  const code = `return await page.locator('body').ariaSnapshot();`;
  const result = await callExecute(code);
  if (result.isError) {
    throw new Error(result.text);
  }
  const ret = extractReturnValue(result.text);
  return ret ?? result.text;
}
async function getTextContent() {
  const code = `return await page.evaluate(() => document.body.innerText);`;
  const result = await callExecute(code);
  if (result.isError) {
    throw new Error(result.text);
  }
  const ret = extractReturnValue(result.text);
  return ret ?? result.text;
}
async function click(selector) {
  const code = `await page.locator(${escapeForCode(selector)}).click();`;
  const result = await callExecute(code);
  if (result.isError) {
    throw new Error(result.text);
  }
}
async function type(selector, text3) {
  const code = `await page.locator(${escapeForCode(selector)}).click(); await page.keyboard.type(${escapeForCode(text3)}, { delay: 20 });`;
  const result = await callExecute(code);
  if (result.isError) {
    throw new Error(result.text);
  }
}
async function scrollDown(pixels = 500) {
  const code = `await page.evaluate((px) => window.scrollBy(0, px), ${pixels});`;
  const result = await callExecute(code);
  if (result.isError) {
    throw new Error(result.text);
  }
}
async function getCurrentUrl() {
  const code = `return page.url();`;
  const result = await callExecute(code);
  if (result.isError) {
    throw new Error(result.text);
  }
  const ret = extractReturnValue(result.text);
  return ret ?? "";
}
var EXTRACT_POSTS_CODE = `
const posts = await page.evaluate(() => {
  const result = [];
  const postElements = document.querySelectorAll('article, [data-testid="post-container"], shreddit-post');
  postElements.forEach((post) => {
    try {
      const titleEl = post.querySelector('h3, [slot="title"], a[data-click-id="body"]');
      const linkEl = post.querySelector('a[href*="/comments/"]');
      const authorEl = post.querySelector('a[href*="/user/"]');
      if (titleEl && linkEl) {
        result.push({
          title: titleEl.textContent?.trim() || '',
          url: linkEl.href,
          author: authorEl?.textContent?.replace('u/', '').trim() || '',
          subreddit: window.location.pathname.split('/')[2] || '',
          commentCount: 0,
          upvotes: '0'
        });
      }
    } catch (e) {}
  });
  return result.slice(0, 10);
});
return JSON.stringify(posts);
`;
async function extractRedditPosts() {
  const result = await callExecute(EXTRACT_POSTS_CODE);
  if (result.isError) {
    throw new Error(result.text);
  }
  const ret = extractReturnValue(result.text);
  if (!ret) {
    return [];
  }
  try {
    return JSON.parse(ret);
  } catch {
    return [];
  }
}
async function submitRedditComment(commentText) {
  const escaped = escapeForCode(commentText);
  const code = `
try {
  // Playwright locators don't reliably find elements inside Reddit's custom element tree
  // through the Playwriter relay. Use page.evaluate() with direct DOM APIs instead,
  // including recursive shadow DOM traversal.

  // Helper: find element by selector, searching through shadow roots if needed.
  // Defined once on window so all evaluate calls can use it.
  await page.evaluate(() => {
    window.__find = (selector, root) => {
      root = root || document;
      let el = root.querySelector(selector);
      if (el) return el;
      const children = root.querySelectorAll('*');
      for (let i = 0; i < children.length; i++) {
        if (children[i].shadowRoot) {
          el = window.__find(selector, children[i].shadowRoot);
          if (el) return el;
        }
      }
      return null;
    };
  });

  // Step 1: Click "Join the conversation" trigger to open the composer.
  let triggerClicked = await page.evaluate(() => {
    const trigger = window.__find('[data-testid="trigger-button"]')
      || window.__find('faceplate-textarea-input[placeholder="Join the conversation"]');
    if (!trigger) return false;
    trigger.scrollIntoView({ block: 'center' });
    trigger.click();
    return true;
  });

  if (!triggerClicked) {
    // Scroll to bottom and retry \u2014 composer might be below the fold
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    triggerClicked = await page.evaluate(() => {
      const trigger = window.__find('[data-testid="trigger-button"]')
        || window.__find('faceplate-textarea-input[placeholder="Join the conversation"]');
      if (!trigger) return false;
      trigger.scrollIntoView({ block: 'center' });
      trigger.click();
      return true;
    });
  }

  if (!triggerClicked) {
    const diag = await page.evaluate(() => ({
      url: location.href,
      hasShredditComposer: !!window.__find('shreddit-composer'),
      hasAsyncLoader: !!window.__find('shreddit-async-loader'),
      hasFaceplateTextarea: !!window.__find('faceplate-textarea-input'),
      testIds: [...document.querySelectorAll('[data-testid]')].map(e => e.getAttribute('data-testid')).slice(0, 15),
    }));
    return JSON.stringify({ success: false, error: 'Trigger not found. Diag: ' + JSON.stringify(diag) });
  }

  await page.waitForTimeout(1500);

  // Step 2: Find the editor, focus it, and type the comment.
  const editorReady = await page.evaluate(() => {
    const editor = window.__find('div[contenteditable="true"]');
    if (!editor) return false;
    editor.scrollIntoView({ block: 'center' });
    editor.focus();
    editor.click();
    return true;
  });

  if (!editorReady) {
    return JSON.stringify({ success: false, error: 'Editor not found after clicking trigger.' });
  }

  await page.waitForTimeout(300);
  await page.keyboard.type(${escaped}, { delay: 20 });
  await page.waitForTimeout(500);

  // Step 3: Click the "Comment" submit button.
  const submitted = await page.evaluate(() => {
    const btn = window.__find('button[slot="submit-button"]')
      || window.__find('button[type="submit"]');
    if (!btn) return false;
    btn.click();
    return true;
  });

  if (!submitted) {
    return JSON.stringify({ success: false, error: 'Submit button not found.' });
  }

  await page.waitForTimeout(2000);
  return JSON.stringify({ success: true });
} catch (e) {
  return JSON.stringify({ success: false, error: e.message || String(e) });
}
`;
  const result = await callExecute(code, 3e4);
  if (result.isError) {
    return { success: false, error: result.text };
  }
  const ret = extractReturnValue(result.text);
  if (!ret) {
    return { success: false, error: "No return value from comment submission" };
  }
  try {
    const parsed = JSON.parse(ret);
    return parsed;
  } catch {
    return { success: false, error: result.text };
  }
}

// src/ui/prompts.ts
import * as p from "@clack/prompts";
async function confirmWithTimeout(options) {
  const { message, timeoutMs = 5e3, defaultValue = true } = options;
  return new Promise((resolve2) => {
    let resolved = false;
    let countdown = Math.ceil(timeoutMs / 1e3);
    const interval = setInterval(() => {
      countdown--;
      if (countdown > 0 && !resolved) {
        process.stdout.write(
          `\r${message} (auto-${defaultValue ? "approve" : "reject"} in ${countdown}s) [y/n] `
        );
      }
    }, 1e3);
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        clearInterval(interval);
        console.log(`
${defaultValue ? "\u2713 Auto-approved" : "\u2717 Auto-rejected"}`);
        resolve2(defaultValue);
      }
    }, timeoutMs);
    process.stdout.write(
      `${message} (auto-${defaultValue ? "approve" : "reject"} in ${countdown}s) [y/n] `
    );
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.once("data", (data) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          clearInterval(interval);
          process.stdin.setRawMode(false);
          const key = data.toString().toLowerCase();
          if (key === "y" || key === "\r" || key === "\n") {
            console.log("\n\u2713 Approved");
            resolve2(true);
          } else if (key === "n") {
            console.log("\n\u2717 Rejected");
            resolve2(false);
          } else if (key === "") {
            console.log("\n");
            process.exit(0);
          } else {
            console.log("\n\u2713 Approved");
            resolve2(true);
          }
        }
      });
    } else {
    }
  });
}

// src/tools.ts
var CommentPostError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "CommentPostError";
  }
};
function getToolDefinitions() {
  return [
    {
      type: "function",
      function: {
        name: "read_file",
        description: "Read contents of a file. Use for skill instructions, tracking data, personalization, subreddit rules, product info, or memory. Paths are relative to project root. Resources are inside .claude/skills/<skill>/resources/.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path relative to project root. Examples: .claude/skills/reddit-commenter/SKILL.md, .claude/skills/reddit-commenter/resources/subreddits.md, .claude/skills/reddit-commenter/resources/personalization_reddit.md, tracking/reddit/2026-02-05.md, .claude/skills/reddit-commenter/memory.md"
            }
          },
          required: ["path"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "write_file",
        description: "Write or overwrite a file. Use to update tracking files, leads, or create new files. Paths are relative to project root.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path relative to project root"
            },
            content: {
              type: "string",
              description: "Content to write to the file"
            }
          },
          required: ["path", "content"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "append_file",
        description: "Append content to a file. Use for memory.md, tracking logs, or leads. Paths are relative to project root.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path relative to project root"
            },
            content: {
              type: "string",
              description: "Content to append"
            }
          },
          required: ["path", "content"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "list_dir",
        description: "List files and directories. Use to discover available skills or files in a directory.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path relative to project root (e.g. .claude/skills, tracking/reddit)"
            }
          },
          required: ["path"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "browser_navigate",
        description: "Navigate the browser to a URL. Use for Reddit pages (subreddits, posts, inbox).",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "Full URL to navigate to (e.g. https://www.reddit.com/r/chatgptpro/new/)"
            }
          },
          required: ["url"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "browser_snapshot",
        description: "Get the page structure (accessibility tree). Use to understand page layout before clicking or typing.",
        parameters: {
          type: "object",
          properties: {}
        }
      }
    },
    {
      type: "function",
      function: {
        name: "browser_get_text",
        description: "Get the visible text content of the current page. Use to read post content, comments, or page content.",
        parameters: {
          type: "object",
          properties: {}
        }
      }
    },
    {
      type: "function",
      function: {
        name: "browser_extract_posts",
        description: "Extract Reddit posts from the current page. Returns title, url, author, subreddit for each post.",
        parameters: {
          type: "object",
          properties: {}
        }
      }
    },
    {
      type: "function",
      function: {
        name: "browser_click",
        description: "Click an element. Provide a brief description or selector. Use after browser_snapshot to identify elements.",
        parameters: {
          type: "object",
          properties: {
            selector: {
              type: "string",
              description: 'CSS selector or element description (e.g. button[type="submit"], textarea, .comment-box)'
            }
          },
          required: ["selector"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "browser_type",
        description: "Type text into an input element. Use for comment box, search, etc.",
        parameters: {
          type: "object",
          properties: {
            selector: {
              type: "string",
              description: 'CSS selector for the input (e.g. textarea, div[contenteditable="true"])'
            },
            text: {
              type: "string",
              description: "Text to type"
            }
          },
          required: ["selector", "text"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "browser_scroll",
        description: "Scroll the page down to load more content.",
        parameters: {
          type: "object",
          properties: {
            pixels: {
              type: "string",
              description: "Pixels to scroll (default 500)"
            }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "browser_current_url",
        description: "Get the current page URL.",
        parameters: {
          type: "object",
          properties: {}
        }
      }
    },
    {
      type: "function",
      function: {
        name: "browser_submit_reddit_comment",
        description: "Submit a comment on Reddit. Use AFTER request_approval is approved. Must be on a post page.",
        parameters: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The approved comment text to submit"
            }
          },
          required: ["content"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "request_approval",
        description: "Request human approval before posting a comment, reply, or post. REQUIRED before any content submission. Shows the content to the user and waits for approval (auto-approves after timeout).",
        parameters: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The content to be posted (comment text, reply text, or post body)"
            },
            content_type: {
              type: "string",
              description: 'Type of content: "comment", "reply", or "post"'
            },
            context: {
              type: "string",
              description: 'Context for the content (e.g., "r/chatgptpro - Post: How to use GPT-4" or "Reply to u/user123")'
            },
            title: {
              type: "string",
              description: 'Post title (only required for content_type="post")'
            }
          },
          required: ["content", "content_type", "context"]
        }
      }
    }
  ];
}
async function executeTool(name, args, ctx) {
  const root = ctx.projectRoot;
  try {
    switch (name) {
      case "read_file": {
        const path = args.path;
        const fullPath = join3(root, path);
        if (!fullPath.startsWith(root)) {
          return JSON.stringify({ error: "Path outside project root" });
        }
        if (!existsSync3(fullPath)) {
          return JSON.stringify({ error: `File not found: ${path}` });
        }
        const content = await readFile3(fullPath, "utf-8");
        return content;
      }
      case "write_file": {
        const path = args.path;
        const content = args.content;
        const fullPath = join3(root, path);
        if (!fullPath.startsWith(root)) {
          return JSON.stringify({ error: "Path outside project root" });
        }
        await writeFile2(fullPath, content, "utf-8");
        return JSON.stringify({ success: true, path });
      }
      case "append_file": {
        const path = args.path;
        const content = args.content;
        const fullPath = join3(root, path);
        if (!fullPath.startsWith(root)) {
          return JSON.stringify({ error: "Path outside project root" });
        }
        await appendFile2(fullPath, content, "utf-8");
        return JSON.stringify({ success: true, path });
      }
      case "list_dir": {
        const path = args.path;
        const fullPath = join3(root, path);
        if (!fullPath.startsWith(root)) {
          return JSON.stringify({ error: "Path outside project root" });
        }
        if (!existsSync3(fullPath)) {
          return JSON.stringify({ error: `Directory not found: ${path}` });
        }
        const entries = await readdir2(fullPath, { withFileTypes: true });
        const result = entries.map((e) => ({
          name: e.name,
          type: e.isDirectory() ? "directory" : "file"
        }));
        return JSON.stringify(result, null, 2);
      }
      case "browser_navigate": {
        const url = args.url;
        await navigate(url);
        return JSON.stringify({ success: true, url });
      }
      case "browser_snapshot": {
        const snapshot = await getAccessibilityTree();
        return snapshot.length > 4e3 ? snapshot.substring(0, 4e3) + "\n...[truncated]" : snapshot;
      }
      case "browser_get_text": {
        const text3 = await getTextContent();
        return text3.length > 8e3 ? text3.substring(0, 8e3) + "\n...[truncated]" : text3;
      }
      case "browser_extract_posts": {
        const posts = await extractRedditPosts();
        return JSON.stringify(posts, null, 2);
      }
      case "browser_click": {
        const selector = args.selector;
        await click(selector);
        return JSON.stringify({ success: true });
      }
      case "browser_type": {
        const selector = args.selector;
        const text3 = args.text;
        await type(selector, text3);
        return JSON.stringify({ success: true });
      }
      case "browser_scroll": {
        const pixels = parseInt(String(args.pixels || 500), 10);
        await scrollDown(pixels);
        return JSON.stringify({ success: true });
      }
      case "browser_current_url": {
        const url = await getCurrentUrl();
        return JSON.stringify({ url });
      }
      case "browser_submit_reddit_comment": {
        const content = args.content;
        const result = await submitRedditComment(content);
        if (!result.success) {
          throw new CommentPostError(result.error ?? "Failed to post comment");
        }
        return JSON.stringify(result);
      }
      case "request_approval": {
        const content = args.content;
        const contentType = args.content_type;
        const context = args.context;
        const title = args.title;
        const waitMs = parseInt(process.env.HUMAN_IN_LOOP_WAIT_MS || "5000", 10);
        output.divider();
        output.info(`Approval Request: ${contentType.toUpperCase()}`);
        output.dim(context);
        if (title) {
          output.info(`Title: ${title}`);
        }
        if (contentType === "post" && title) {
          output.post(title, content);
        } else {
          output.comment(content, contentType === "reply" ? "Proposed Reply" : "Proposed Comment");
        }
        const defaultApprove = contentType !== "post";
        const approved = await confirmWithTimeout({
          message: `Approve this ${contentType}?`,
          timeoutMs: waitMs,
          defaultValue: defaultApprove
        });
        if (approved) {
          output.success(`${contentType} approved`);
        } else {
          output.warning(`${contentType} rejected`);
        }
        return JSON.stringify({
          approved,
          message: approved ? "Content approved for posting" : "Content rejected by user"
        });
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    output.error(`Tool "${name}" failed: ${message}`);
    if (error instanceof CommentPostError) {
      throw error;
    }
    return JSON.stringify({ error: message });
  }
}

// src/llm.ts
function getLLMConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set in environment");
  }
  return {
    apiKey,
    models: {
      summarize: process.env.OPENROUTER_MODEL_SUMMARIZE || "deepseek/deepseek-chat",
      comment: process.env.OPENROUTER_MODEL_COMMENT || "x-ai/grok-2",
      review: process.env.OPENROUTER_MODEL_REVIEW || "anthropic/claude-3.5-sonnet",
      analyze: process.env.OPENROUTER_MODEL_SUMMARIZE || "deepseek/deepseek-chat",
      general: process.env.OPENROUTER_MODEL_COMMENT || "x-ai/grok-2"
    },
    temperatures: {
      summarize: parseFloat(process.env.OPENROUTER_TEMPERATURE_SUMMARIZE || "0.2"),
      comment: parseFloat(process.env.OPENROUTER_TEMPERATURE_COMMENT || "0.7"),
      review: parseFloat(process.env.OPENROUTER_TEMPERATURE_REVIEW || "0.3"),
      analyze: parseFloat(process.env.OPENROUTER_TEMPERATURE_SUMMARIZE || "0.2"),
      general: parseFloat(process.env.OPENROUTER_TEMPERATURE_COMMENT || "0.7")
    }
  };
}
function serializeMessages(messages) {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool",
        tool_call_id: m.tool_call_id,
        content: m.content
      };
    }
    const base = { role: m.role, content: m.content ?? "" };
    if (m.tool_calls) {
      return { ...base, tool_calls: m.tool_calls };
    }
    return base;
  });
}
async function callOpenRouter(options) {
  const { model, temperature, messages, tools } = options;
  const config2 = getLLMConfig();
  const body = {
    model,
    messages: serializeMessages(messages),
    temperature,
    max_tokens: 4096
  };
  if (tools) {
    body.tools = tools;
  }
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config2.apiKey}`,
      "X-Title": "Agent0"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }
  const data = await response.json();
  const msg = data.choices[0]?.message;
  return {
    content: msg?.content ?? null,
    tool_calls: msg?.tool_calls,
    finish_reason: data.choices[0]?.finish_reason,
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens
    } : void 0
  };
}
function formatToolDetail(name, args) {
  switch (name) {
    case "browser_navigate":
      return args.url ? ` -> ${args.url}` : "";
    case "read_file":
    case "write_file":
    case "append_file":
    case "list_dir":
      return args.path ? ` (${args.path})` : "";
    case "browser_click":
    case "browser_type":
      return args.selector ? ` (${args.selector})` : "";
    case "browser_submit_reddit_comment":
      return " (posting comment)";
    case "request_approval":
      return args.content_type ? ` (${args.content_type})` : "";
    default:
      return "";
  }
}
function trimMessageContext(messages, keepRecent = 2) {
  let assistantCount = 0;
  let cutoffIdx = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      assistantCount++;
      if (assistantCount >= keepRecent) {
        cutoffIdx = i;
        break;
      }
    }
  }
  for (let i = 0; i < cutoffIdx; i++) {
    const msg = messages[i];
    if (msg.role === "tool" && msg.content.length > 200) {
      msg.content = msg.content.substring(0, 150) + "\n...[trimmed for context]";
    }
  }
}
async function callLLMRaw(messages, tools, options) {
  return callOpenRouter({
    model: options.model,
    temperature: options.temperature,
    messages,
    tools
  });
}
async function runAgenticLoop(systemPrompt, userPrompt, options = {}) {
  const {
    skill,
    maxIterations = 15,
    showSpinner = true
  } = options;
  const config2 = getLLMConfig();
  const model = options.model ?? config2.models.general;
  const temperature = options.temperature ?? config2.temperatures.general;
  const tools = getToolDefinitions();
  const toolContext = {
    skill,
    projectRoot: getProjectRoot()
  };
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];
  const spinner = showSpinner ? createSpinner("Agent thinking...") : null;
  let lastContent = "";
  for (let i = 0; i < maxIterations; i++) {
    spinner?.start(`Step ${i + 1}/${maxIterations}`);
    let result;
    try {
      result = await callLLMRaw(messages, tools, { model, temperature });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      spinner?.warn(`LLM call failed: ${errMsg} \u2014 retrying...`);
      try {
        result = await callLLMRaw(messages, tools, { model, temperature });
      } catch (retryError) {
        const retryMsg = retryError instanceof Error ? retryError.message : String(retryError);
        spinner?.fail(`LLM call failed after retry: ${retryMsg}`);
        throw new Error(`LLM API failed: ${retryMsg}`);
      }
    }
    if (result.content) {
      lastContent = result.content;
    }
    if (!result.tool_calls || result.tool_calls.length === 0) {
      spinner?.succeed("Done");
      return lastContent || "(No response)";
    }
    const toolNames = result.tool_calls.map((tc) => tc.function.name).join(", ");
    spinner?.start(`Executing ${result.tool_calls.length} tool(s): ${toolNames}`);
    const assistantMsg = {
      role: "assistant",
      content: result.content,
      tool_calls: result.tool_calls
    };
    messages.push(assistantMsg);
    let anyToolFailed = false;
    for (let tIdx = 0; tIdx < result.tool_calls.length; tIdx++) {
      const tc = result.tool_calls[tIdx];
      let args = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {
        args = {};
      }
      const detail = formatToolDetail(tc.function.name, args);
      spinner?.start(
        `[${tIdx + 1}/${result.tool_calls.length}] ${tc.function.name}${detail}`
      );
      let toolResult;
      try {
        toolResult = await executeTool(tc.function.name, args, toolContext);
      } catch (error) {
        if (error instanceof CommentPostError) {
          spinner?.fail(`Comment posting failed: ${error.message}`);
          throw error;
        }
        throw error;
      }
      try {
        const parsed = JSON.parse(toolResult);
        if (parsed.error) {
          spinner?.fail(`Tool "${tc.function.name}" error: ${parsed.error}`);
          anyToolFailed = true;
        }
      } catch {
      }
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: toolResult
      });
    }
    if (anyToolFailed) {
      spinner?.warn(`Tools executed (with errors): ${toolNames}`);
    } else {
      spinner?.succeed(`Tools executed: ${toolNames}`);
    }
    trimMessageContext(messages);
  }
  spinner?.warn("Max iterations reached");
  return lastContent || "(Max iterations reached)";
}

// src/agent-runner.ts
function buildSystemPrompt(skill, mode, skillContent, batchContent, memory, personalization, product, modeContext) {
  const baseToolsSection = `## Available Tools
You have access to these tools. Use them to accomplish the task:
- read_file: Read files (skill instructions, tracking, personalization, subreddit rules, memory)
- write_file, append_file: Update tracking files, leads, memory
- list_dir: Discover files
- browser_navigate: Go to Reddit URLs (subreddits, posts, inbox)
- browser_snapshot: Get page structure
- browser_get_text: Get visible page text
- browser_extract_posts: Extract Reddit posts from current page
- browser_click, browser_type: Interact with page elements
- browser_submit_reddit_comment: Submit approved comment on Reddit
- browser_scroll: Scroll to load more content
- browser_current_url: Get current URL
- request_approval: Request human approval before posting (required before any comment/post submission)`;
  const projectStructure = `## Project Structure
- Skills: .claude/skills/${skill.name}/
- Tracking: tracking/${skill.platform}/YYYY-MM-DD.md
- Leads: leads/${skill.platform}.md
- Memory: .claude/skills/${skill.name}/memory.md`;
  const skillSection = `## Skill Workflow (Reference)
${skillContent}`;
  const memorySection = `## Memory (Recent Activity)
${memory}`;
  const personalizationSection = personalization ? `## Personalization Guide
${personalization}` : `## Personalization
(Use read_file to load .claude/skills/${skill.name}/resources/personalization_reddit.md)`;
  const productSection = product ? `## Product Info
${product}` : "";
  let modeInstructions = "";
  switch (mode) {
    case "batch":
      modeInstructions = `## Batch Mode Instructions
${batchContent || "Fill today's quota according to the skill workflow."}

Your task:
1. Read today's tracking file (tracking/${skill.platform}/YYYY-MM-DD.md) to see current progress
2. Identify subreddits that haven't reached their daily limit
3. For each subreddit with remaining quota:
   - Navigate to the subreddit (https://www.reddit.com/r/{subreddit}/new/)
   - Extract posts using browser_extract_posts
   - Select a suitable post to comment on
   - Navigate to the post
   - Analyze the post content
   - Generate a helpful, natural comment following personalization guidelines
   - IMPORTANT: Call request_approval with the proposed comment before posting
   - If approved, use browser_submit_reddit_comment(content) to submit (Reddit-specific, handles Shadow DOM)
   - Update tracking file with the new comment
   - Update memory with the action
4. Respect delays between comments (wait 2-5 minutes between comments)
5. Continue until quota is filled or all subreddits are complete

${modeContext?.trackingSummary ? `Current tracking summary:
${modeContext.trackingSummary}` : ""}`;
      break;
    case "commenter":
      modeInstructions = `## Commenter Mode Instructions
CRITICAL: Commenter writes COMMENTS on EXISTING posts. NEVER create a new post. Do NOT click "Create Post" or similar. You are replying to others' content, not publishing your own.

Your task: Write comments on existing posts based on the user's instruction.

Workflow for each comment:
1. Parse the instruction: which subreddit (r/X), how many comments
2. Navigate to the subreddit feed (e.g. https://www.reddit.com/r/{subreddit}/new/)
3. Scroll the page (browser_scroll) to load posts if needed
4. Extract posts using browser_extract_posts to see available posts
5. Select ONE post to comment on (pick one with good engagement potential)
6. CLICK on the post or navigate to its URL to OPEN the post page (you must view the full post)
7. On the post page: use browser_get_text to read and summarize the post content
8. Write a helpful, natural comment that replies to that specific post (following personalization guidelines)
9. Call request_approval with content_type="comment" and your proposed comment text
10. If approved: use browser_submit_reddit_comment(content="your approved comment").
11. Update tracking and memory
12. If more comments needed: go back to subreddit, scroll, pick another post, repeat`;
      break;
    case "notifications":
      modeInstructions = `## Notifications Mode Instructions
Your task: Check Reddit notifications and respond to any replies.

Workflow:
1. Navigate to Reddit inbox (https://www.reddit.com/message/inbox/)
2. Get the page content to see notifications
3. Identify any replies to your comments that need responses
4. For each reply that warrants a response:
   - Read the context (original post, your comment, their reply)
   - Generate a thoughtful, helpful response
   - IMPORTANT: Call request_approval with the proposed reply before posting
   - If approved, navigate to the reply and respond
   - Update memory with the interaction
5. Mark notifications as read if possible
6. Report what notifications you handled`;
      break;
    case "trending":
      modeInstructions = `## Trending Mode Instructions
Your task: Find trending posts for inspiration or reposting opportunities.

Workflow:
1. Navigate to the specified subreddit's hot or rising page
   - Hot: https://www.reddit.com/r/{subreddit}/hot/
   - Rising: https://www.reddit.com/r/{subreddit}/rising/
2. Extract posts using browser_extract_posts
3. For each interesting post:
   - Note the title, engagement level, topic
   - Analyze why it's trending (topic relevance, timing, format)
4. Compile a summary of trending topics and post ideas
5. Optionally save the summary to a file (trending_{subreddit}_{date}.md)
6. Return the trending analysis to the user

${modeContext?.subreddit ? `Target subreddit: r/${modeContext.subreddit}` : "Check multiple subreddits from the subreddits.md resource."}`;
      break;
    case "post":
      modeInstructions = `## Post Mode Instructions
Your task: Draft and publish a new post based on the user's instruction.

Workflow:
1. Parse the instruction to understand: which subreddit, what topic/content
2. Read subreddit rules for the target subreddit
3. Draft the post title and content following:
   - Subreddit rules and culture
   - Personalization guidelines
   - The user's intent
4. IMPORTANT: Call request_approval with the full draft (title + content) before posting
5. If approved:
   - Navigate to the subreddit
   - Click the "Create Post" button
   - Fill in the title and content
   - Submit the post
6. Update memory with the post details
7. Report the post URL or any issues`;
      break;
  }
  return `You are Agent0, an autonomous agent executing Reddit engagement tasks.

${baseToolsSection}

${modeInstructions}

${skillSection}

${memorySection}

${personalizationSection}

${productSection}

${projectStructure}

## Critical Rules
1. ALWAYS call request_approval before posting any comment, reply, or post
2. Follow the skill workflow and personalization guidelines exactly
3. Update tracking after each action
4. Log actions to memory
5. Be autonomous - complete the full task without asking questions
6. If something fails, log the error and try an alternative approach
7. Report what you accomplished when done
8. In commenter mode: ONLY write comments on existing posts. Open the post first, call request_approval, then use browser_submit_reddit_comment(content) to submit - do NOT use browser_type for Reddit.`;
}
async function runWithToolCalling(skillName, mode, userPrompt, modeContext) {
  output.header(`Agent0 ${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode`);
  try {
    const skill = await loadSkill(skillName);
    output.success(`Loaded skill: ${skill.name}`);
    const skillContent = skill.skillContent;
    const batchContent = skill.batchContent;
    const memory = await readMemory(skill);
    const personalization = await loadResource(skill, "personalization_reddit");
    const product = await loadResource(skill, "product");
    const systemPrompt = buildSystemPrompt(
      skill,
      mode,
      skillContent,
      batchContent,
      memory,
      personalization,
      product,
      modeContext
    );
    output.info(`Instruction: ${userPrompt}`);
    output.divider();
    await connectBrowser();
    const maxIterationsMap = {
      commenter: 10,
      notifications: 10,
      trending: 8,
      post: 10,
      batch: 20
    };
    const result = await runAgenticLoop(systemPrompt, userPrompt, {
      skill,
      maxIterations: maxIterationsMap[mode],
      showSpinner: true
    });
    output.divider();
    output.success("Task completed");
    console.log(result);
    return result;
  } catch (error) {
    if (error instanceof CommentPostError) {
      output.divider();
      output.error(`COMMENT POSTING FAILED: ${error.message}`);
      output.error("Agent stopped. The comment was NOT posted successfully.");
      output.info("Check the browser to verify the state, then retry.");
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      output.error(`${mode} mode failed: ${errorMessage}`);
    }
    throw error;
  } finally {
    await closeBrowser();
  }
}
async function runBatchWithToolCalling(skillName, trackingSummary) {
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  return runWithToolCalling(
    skillName,
    "batch",
    `Fill today's quota according to BATCH.md. Check tracking/reddit/${today}.md for current status.`,
    { trackingSummary }
  );
}
async function runCommenterWithToolCalling(skillName, instruction) {
  return runWithToolCalling(skillName, "commenter", instruction);
}
async function runNotificationsWithToolCalling(skillName) {
  return runWithToolCalling(
    skillName,
    "notifications",
    "Check Reddit notifications and respond to any replies that need attention."
  );
}
async function runTrendingWithToolCalling(skillName, subreddit) {
  const prompt = subreddit ? `Find trending posts in r/${subreddit} and analyze what's popular.` : "Find trending posts across configured subreddits and compile a summary.";
  return runWithToolCalling(skillName, "trending", prompt, { subreddit });
}
async function runPostWithToolCalling(skillName, content) {
  return runWithToolCalling(skillName, "post", `Write and post: ${content}`);
}

// src/modes/batch.ts
async function runBatchMode(skillName) {
  try {
    const skill = await loadSkill(skillName);
    const subredditsContent = await loadResource(skill, "subreddits");
    if (!subredditsContent) {
      output.error("No subreddits.md found");
      return;
    }
    const subreddits = parseSubreddits(subredditsContent);
    if (subreddits.length === 0) {
      output.error("No subreddits configured");
      return;
    }
    const trackingContent = await loadTracking(skill);
    const tracking = trackingContent ? parseTracking(trackingContent) : [];
    const statuses = subreddits.map((sub) => {
      const tracked = tracking.find((t) => t.subreddit === sub.name);
      const todayComments = tracked?.todayComments || 0;
      return {
        name: sub.name,
        todayComments,
        dailyLimit: sub.dailyLimit,
        remaining: Math.max(0, sub.dailyLimit - todayComments)
      };
    });
    const totalRemaining = statuses.reduce((sum, s) => sum + s.remaining, 0);
    const totalDaily = statuses.reduce((sum, s) => sum + s.dailyLimit, 0);
    const totalCompleted = totalDaily - totalRemaining;
    if (totalRemaining === 0) {
      output.success("All quotas completed for today!");
      return;
    }
    output.divider();
    output.info(`Current quota: ${totalCompleted}/${totalDaily} (${totalRemaining} remaining)`);
    output.divider();
    output.table(statuses.map((s) => ({
      Subreddit: `r/${s.name}`,
      Today: s.todayComments,
      Limit: s.dailyLimit,
      Remaining: s.remaining
    })));
    output.divider();
    const trackingSummary = statuses.filter((s) => s.remaining > 0).map((s) => `r/${s.name}: ${s.todayComments}/${s.dailyLimit} (${s.remaining} remaining)`).join("\n");
    await runBatchWithToolCalling(skillName, trackingSummary);
  } catch (error) {
    output.error(`Batch mode failed: ${error}`);
  }
}

// src/modes/commenter.ts
function parseInstruction(instruction) {
  const subredditMatch = instruction.match(/r\/(\w+)/i);
  const subreddit = subredditMatch ? subredditMatch[1] : "";
  const countMatch = instruction.match(/(\d+)\s*comments?/i);
  const oneMatch = instruction.match(/\bone\b/i);
  let count = 1;
  if (countMatch) {
    count = parseInt(countMatch[1], 10);
  } else if (oneMatch) {
    count = 1;
  }
  return { subreddit, count };
}
async function runCommenterMode(skillName, instruction) {
  const { subreddit, count } = parseInstruction(instruction);
  if (!subreddit) {
    output.error("Could not parse subreddit from instruction");
    output.info('Example: "Post 3 comments on r/chatgptpro"');
    return;
  }
  output.info(`Target: r/${subreddit}`);
  output.info(`Comments to post: ${count}`);
  try {
    await runCommenterWithToolCalling(skillName, instruction);
  } catch (error) {
    output.error(`Commenter mode failed: ${error}`);
  }
}

// src/modes/notifications.ts
async function runNotificationsMode(skillName) {
  output.info("Checking Reddit notifications...");
  try {
    await runNotificationsWithToolCalling(skillName);
  } catch (error) {
    output.error(`Notifications mode failed: ${error}`);
  }
}

// src/modes/trending.ts
async function runTrendingMode(skillName, targetSubreddit) {
  if (targetSubreddit) {
    output.info(`Finding trending posts in r/${targetSubreddit}...`);
  } else {
    output.info("Finding trending posts across configured subreddits...");
  }
  try {
    await runTrendingWithToolCalling(skillName, targetSubreddit);
  } catch (error) {
    output.error(`Trending mode failed: ${error}`);
  }
}

// src/modes/post.ts
async function runPostMode(skillName, content) {
  if (!content.trim()) {
    output.error("Post content/instruction is required");
    output.info('Example: "Write a post about AI tools in r/chatgptpro"');
    return;
  }
  output.info(`Creating post: ${content.substring(0, 50)}...`);
  try {
    await runPostWithToolCalling(skillName, content);
  } catch (error) {
    output.error(`Post mode failed: ${error}`);
  }
}

// src/cli.ts
function createCLI() {
  const program = new Command();
  program.name("agent0").description("Autonomous CLI for skill-based browser automation").version("1.0.0");
  program.command("batch").description("Run batch mode to fill daily quota").option("-s, --skill <name>", "Skill to use", "reddit-commenter").action(async (options) => {
    await runWithSkillSelection(options.skill, "batch");
  });
  program.command("comment [instruction]").description("Post comments based on instruction").option("-s, --skill <name>", "Skill to use", "reddit-commenter").action(async (instruction, options) => {
    const finalInstruction = instruction || await promptForInstruction("comment");
    await runWithSkillSelection(options.skill, "commenter", finalInstruction);
  });
  program.command("notifications").alias("notif").description("Check and interact with notifications").option("-s, --skill <name>", "Skill to use", "reddit-commenter").action(async (options) => {
    await runWithSkillSelection(options.skill, "notifications");
  });
  program.command("trending").description("Find trending posts for inspiration").option("-s, --skill <name>", "Skill to use", "reddit-commenter").option("-r, --subreddit <name>", "Specific subreddit to check").action(async (options) => {
    await runWithSkillSelection(options.skill, "trending", options.subreddit);
  });
  program.command("post [content]").description("Write and post content").option("-s, --skill <name>", "Skill to use", "reddit-commenter").action(async (content, options) => {
    const finalContent = content || await promptForInstruction("post");
    await runWithSkillSelection(options.skill, "post", finalContent);
  });
  program.command("interactive", { isDefault: true }).description("Start interactive mode").action(async () => {
    await runInteractiveMode();
  });
  return program;
}
async function promptForInstruction(type2) {
  const placeholders = {
    comment: "Post 3 comments on r/chatgptpro",
    post: "Write a post about..."
  };
  const result = await p2.text({
    message: `Enter ${type2} instruction:`,
    placeholder: placeholders[type2] ?? "Enter instruction...",
    validate: (value) => {
      if (!value.trim()) return "Instruction is required";
      return void 0;
    }
  });
  if (p2.isCancel(result)) {
    p2.cancel("Operation cancelled.");
    process.exit(0);
  }
  return result;
}
async function runWithSkillSelection(skillName, mode, instruction) {
  showBanner();
  const skills = await discoverSkills();
  if (skills.length === 0) {
    output.error("No skills found in .claude/skills/");
    process.exit(1);
  }
  if (!skills.includes(skillName)) {
    output.warning(`Skill "${skillName}" not found.`);
    const selected = await p2.select({
      message: "Select a skill:",
      options: skills.map((s) => ({ value: s, label: s }))
    });
    if (p2.isCancel(selected)) {
      p2.cancel("Operation cancelled.");
      process.exit(0);
    }
    skillName = selected;
  }
  output.info(`Using skill: ${skillName}`);
  output.info(`Mode: ${mode}`);
  switch (mode) {
    case "batch":
      await runBatchMode(skillName);
      break;
    case "commenter":
      await runCommenterMode(skillName, instruction || "");
      break;
    case "notifications":
      await runNotificationsMode(skillName);
      break;
    case "trending":
      await runTrendingMode(skillName, instruction);
      break;
    case "post":
      await runPostMode(skillName, instruction || "");
      break;
    default:
      output.error(`Unknown mode: ${mode}`);
  }
}
async function runInteractiveMode() {
  showBanner();
  const skills = await discoverSkills();
  if (skills.length === 0) {
    output.error("No skills found in .claude/skills/");
    process.exit(1);
  }
  const skill = await p2.select({
    message: "Select a skill:",
    options: skills.map((s) => ({ value: s, label: s }))
  });
  if (p2.isCancel(skill)) {
    p2.cancel("Operation cancelled.");
    process.exit(0);
  }
  const mode = await p2.select({
    message: "Select a mode:",
    options: [
      { value: "batch", label: "Batch Mode", hint: "Fill daily quota" },
      { value: "commenter", label: "Comment", hint: "Post specific comments" },
      { value: "notifications", label: "Notifications", hint: "Check and respond" },
      { value: "trending", label: "Trending", hint: "Find trending posts" },
      { value: "post", label: "Post", hint: "Write and publish content" }
    ]
  });
  if (p2.isCancel(mode)) {
    p2.cancel("Operation cancelled.");
    process.exit(0);
  }
  let instruction;
  if (mode === "commenter") {
    instruction = await promptForInstruction("comment");
  } else if (mode === "post") {
    instruction = await promptForInstruction("post");
  }
  await runWithSkillSelection(skill, mode, instruction);
}

// src/index.ts
var cwd = process.cwd();
var envPaths = [resolve(cwd, ".env"), resolve(cwd, "..", "..", ".env")];
for (const envPath of envPaths) {
  if (existsSync4(envPath)) {
    config({ path: envPath, override: true });
    break;
  }
}
async function main() {
  const cli = createCLI();
  await cli.parseAsync(process.argv);
}
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
