#!/usr/bin/env node
var __glob = (map) => (path) => {
  var fn = map[path];
  if (fn) return fn();
  throw new Error("Module not found in bundle: " + path);
};

// src/index.ts
import { config } from "dotenv";
import { resolve } from "path";
import { existsSync as existsSync4 } from "fs";

// src/cli.ts
import { createInterface } from "readline";
import { Command } from "commander";
import * as p from "@clack/prompts";

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
  comment(text2, title = "Proposed Comment") {
    console.log(
      boxen(text2, {
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
function parseTargets(targetsContent) {
  const targets = [];
  const tableRegex = /\|\s*(?:r\/)?(\w+)\s*\|[^|]*\|\s*(\d+)\s*\|/g;
  let match;
  while ((match = tableRegex.exec(targetsContent)) !== null) {
    targets.push({
      name: match[1],
      dailyLimit: parseInt(match[2], 10)
    });
  }
  return targets;
}
function parseTracking(trackingContent) {
  const activities = [];
  const tableRegex = /\|\s*(?:r\/)?(\w+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([^|]*)\s*\|/g;
  let match;
  while ((match = tableRegex.exec(trackingContent)) !== null) {
    activities.push({
      target: match[1],
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
function createSpinner(text2) {
  const spinner = ora({
    text: text2,
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
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
var client = null;
var transport = null;
function createTransport() {
  const url = process.env.PLAYWRITER_MCP_URL;
  if (url) {
    return new StreamableHTTPClientTransport(new URL(url));
  }
  return new StdioClientTransport({
    command: "playwriter",
    args: ["mcp"],
    stderr: "pipe",
    env: { ...process.env }
  });
}
async function connect() {
  if (client) {
    return;
  }
  transport = createTransport();
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
    const text3 = extractText(content);
    return { text: text3, isError: true };
  }
  const text2 = extractText(content);
  return { text: text2, isError: false };
}
function extractText(content) {
  const list = content ?? [];
  const textPart = list.find((c) => c.type === "text" && c.text != null);
  return textPart && typeof textPart.text === "string" ? textPart.text : "";
}

// src/browser.ts
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
async function executeScript(code, timeout = 3e4) {
  return callExecute(code, timeout);
}

// src/tools.ts
function getToolDefinitions() {
  return [
    {
      type: "function",
      function: {
        name: "read_file",
        description: "Read contents of a file. Use for skill instructions, tracking data, personalization, target rules, product info, or memory. Paths are relative to project root. Resources are inside .claude/skills/<skill>/resources/.",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path relative to project root. Examples: .claude/skills/reddit-commenter/SKILL.md, .claude/skills/reddit-commenter/resources/targets.md, .claude/skills/reddit-commenter/resources/personalization_reddit.md, tracking/reddit/2026-02-05.md, .claude/skills/reddit-commenter/memory.md, .claude/skills/twitter-commenter/resources/targets.md, .claude/skills/twitter-commenter/resources/personalization_twitter.md"
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
              description: "Path relative to project root (e.g. .claude/skills, tracking/reddit, tracking/twitter)"
            }
          },
          required: ["path"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "playwriter_execute",
        description: "Execute Playwriter/Playwright JavaScript in the browser. Scope: page, state, context, accessibilitySnapshot, getCDPSession, etc. Use semicolons for multi-statement scripts. Return values via return statement or JSON.stringify. Examples: await page.goto(url), await page.locator(sel).click(), await accessibilitySnapshot({ page })",
        parameters: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "JavaScript code to run in the browser"
            },
            timeout: {
              type: "number",
              description: "Timeout in milliseconds (default 30000)"
            }
          },
          required: ["code"]
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
      case "playwriter_execute": {
        const code = args.code;
        const timeout = args.timeout ?? 3e4;
        const result = await executeScript(code, timeout);
        if (result.isError) {
          return JSON.stringify({ error: result.text });
        }
        return result.text;
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    output.error(`Tool "${name}" failed: ${message}`);
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
      const toolResult = await executeTool(tc.function.name, args, toolContext);
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
    }
    trimMessageContext(messages);
  }
  spinner?.warn("Max iterations reached");
  return lastContent || "(Max iterations reached)";
}

// import("./**/*.js") in src/modes/instructions/index.ts
var globImport_js = __glob({});

// src/modes/instructions/index.ts
async function loadPlatformInstructions(platform) {
  try {
    const module = await globImport_js(`./${platform}.js`);
    const instructions = module[`${platform}Instructions`];
    if (!instructions) {
      throw new Error(`Platform instructions export not found: ${platform}Instructions`);
    }
    return instructions;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Platform instructions not found for: ${platform}. ${errorMessage}`);
  }
}

// src/agent-runner.ts
async function buildSystemPrompt(skill, mode, skillContent, batchContent, memory, personalization, product, playwriterSnippets, modeContext) {
  const baseToolsSection = `## Available Tools
You have access to these tools. Use them to accomplish the task:
- read_file: Read files (skill instructions, tracking, personalization, target rules, memory)
- write_file, append_file: Update tracking files, leads, memory
- list_dir: Discover files
- playwriter_execute: Execute Playwriter JavaScript in the browser. ALWAYS use the exact snippets from the "Playwriter Snippets" section below. Do NOT use accessibilitySnapshot. Use user-defined selectors (e.g. await page.click('comment-composer-host')). Scope: page, state, context.`;
  const playwriterSnippetsSection = playwriterSnippets ? `## Playwriter Snippets (use these exact patterns)
${playwriterSnippets}` : "";
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
(Use read_file to load .claude/skills/${skill.name}/resources/personalization_${skill.platform}.md)`;
  const productSection = product ? `## Product Info
${product}` : "";
  const platformInstructions = await loadPlatformInstructions(skill.platform);
  let modeInstructions = "";
  switch (mode) {
    case "batch":
      modeInstructions = platformInstructions.batch(skill, batchContent, modeContext);
      break;
    case "commenter":
      modeInstructions = platformInstructions.commenter(skill);
      break;
    case "notifications":
      modeInstructions = platformInstructions.notifications(skill);
      break;
    case "trending":
      modeInstructions = platformInstructions.trending(skill, modeContext);
      break;
    case "post":
      modeInstructions = platformInstructions.post(skill);
      break;
  }
  return `You are Agent0, an autonomous agent executing ${skill.platform} engagement tasks.

${baseToolsSection}

${playwriterSnippetsSection}

${modeInstructions}

${skillSection}

${memorySection}

${personalizationSection}

${productSection}

${projectStructure}

## Critical Rules
1. Follow the skill workflow and personalization guidelines exactly
2. Update tracking after each action
3. Log actions to memory
4. Be autonomous - complete the full task without asking questions
5. If something fails, log the error and try an alternative approach
6. Report what you accomplished when done
7. In commenter mode: ONLY write comments on existing posts. Open the post first, then use playwriter_execute to submit the comment.`;
}
async function runWithToolCalling(skillName, mode, userPrompt, modeContext) {
  output.header(`Agent0 ${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode`);
  try {
    const skill = await loadSkill(skillName);
    output.success(`Loaded skill: ${skill.name}`);
    const skillContent = skill.skillContent;
    const batchContent = skill.batchContent;
    const memory = await readMemory(skill);
    const personalization = await loadResource(skill, `personalization_${skill.platform}`);
    const product = await loadResource(skill, "product");
    const playwriterSnippets = await loadResource(skill, "playwriter_snippets");
    const systemPrompt = await buildSystemPrompt(
      skill,
      mode,
      skillContent,
      batchContent,
      memory,
      personalization,
      product,
      playwriterSnippets,
      modeContext
    );
    output.info(`Instruction: ${userPrompt}`);
    output.divider();
    await connectBrowser();
    const maxIterationsMap = {
      commenter: 30,
      notifications: 10,
      trending: 8,
      post: 10,
      batch: 250
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    output.error(`${mode} mode failed: ${errorMessage}`);
    throw error;
  } finally {
    await closeBrowser();
  }
}
async function runBatchWithToolCalling(skillName, trackingSummary) {
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const skill = await loadSkill(skillName);
  return runWithToolCalling(
    skillName,
    "batch",
    `Fill today's quota according to BATCH.md. Check tracking/${skill.platform}/${today}.md for current status.`,
    { trackingSummary }
  );
}
async function runCommenterWithToolCalling(skillName, instruction) {
  return runWithToolCalling(skillName, "commenter", instruction);
}
async function runNotificationsWithToolCalling(skillName) {
  const skill = await loadSkill(skillName);
  const platformLabel = skill.platform === "reddit" ? "Reddit" : skill.platform === "twitter" ? "X/Twitter" : skill.platform;
  return runWithToolCalling(
    skillName,
    "notifications",
    `Check ${platformLabel} notifications and respond to any replies that need attention.`
  );
}
async function runTrendingWithToolCalling(skillName, target) {
  const skill = await loadSkill(skillName);
  const platformLabel = skill.platform === "reddit" ? "posts" : skill.platform === "twitter" ? "tweets" : "content";
  const prompt = target ? `Find trending ${platformLabel} in ${skill.platform === "reddit" ? `r/${target}` : target} and analyze what's popular.` : `Find trending content across configured targets and compile a summary.`;
  return runWithToolCalling(skillName, "trending", prompt, { target });
}
async function runPostWithToolCalling(skillName, content) {
  return runWithToolCalling(skillName, "post", `Write and post: ${content}`);
}

// src/modes/batch.ts
async function runBatchMode(skillName) {
  try {
    const skill = await loadSkill(skillName);
    const targetsContent = await loadResource(skill, "targets");
    if (!targetsContent) {
      output.error("No targets.md found");
      return;
    }
    const targets = parseTargets(targetsContent);
    if (targets.length === 0) {
      output.error("No targets configured");
      return;
    }
    const trackingContent = await loadTracking(skill);
    const tracking = trackingContent ? parseTracking(trackingContent) : [];
    const statuses = targets.map((target) => {
      const tracked = tracking.find((t) => t.target === target.name);
      const todayComments = tracked?.todayComments || 0;
      return {
        name: target.name,
        todayComments,
        dailyLimit: target.dailyLimit,
        remaining: Math.max(0, target.dailyLimit - todayComments)
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
    const targetLabel = skill.platform === "reddit" ? "Subreddit" : "Target";
    const targetPrefix = skill.platform === "reddit" ? "r/" : "";
    output.table(statuses.map((s) => ({
      [targetLabel]: `${targetPrefix}${s.name}`,
      Today: s.todayComments,
      Limit: s.dailyLimit,
      Remaining: s.remaining
    })));
    output.divider();
    const trackingSummary = statuses.filter((s) => s.remaining > 0).map((s) => `${targetPrefix}${s.name}: ${s.todayComments}/${s.dailyLimit} (${s.remaining} remaining)`).join("\n");
    await runBatchWithToolCalling(skillName, trackingSummary);
  } catch (error) {
    output.error(`Batch mode failed: ${error}`);
  }
}

// src/modes/commenter.ts
function parseInstruction(instruction) {
  const subredditMatch = instruction.match(/r\/(\w+)/i);
  const target = subredditMatch ? subredditMatch[1] : "";
  const countMatch = instruction.match(/(\d+)\s*(?:comments?|replies?)/i);
  const oneMatch = instruction.match(/\bone\b/i);
  let count = 1;
  if (countMatch) {
    count = parseInt(countMatch[1], 10);
  } else if (oneMatch) {
    count = 1;
  }
  return { target, count };
}
async function runCommenterMode(skillName, instruction) {
  const { target, count } = parseInstruction(instruction);
  if (!target) {
    output.error("Could not parse target from instruction");
    output.info('Example: "Post 3 comments on r/chatgptpro" or "Write one reply on For you"');
    return;
  }
  const isSubreddit = instruction.toLowerCase().includes("r/");
  const targetLabel = isSubreddit ? `r/${target}` : target;
  const actionLabel = isSubreddit ? "Comments" : "Replies";
  output.info(`Target: ${targetLabel}`);
  output.info(`${actionLabel} to post: ${count}`);
  try {
    await runCommenterWithToolCalling(skillName, instruction);
  } catch (error) {
    output.error(`Commenter mode failed: ${error}`);
  }
}

// src/modes/notifications.ts
async function runNotificationsMode(skillName) {
  output.info("Checking notifications...");
  try {
    await runNotificationsWithToolCalling(skillName);
  } catch (error) {
    output.error(`Notifications mode failed: ${error}`);
  }
}

// src/modes/trending.ts
async function runTrendingMode(skillName, target) {
  if (target) {
    const isSubreddit = target.toLowerCase().startsWith("r/") || !target.includes(" ");
    const targetLabel = isSubreddit ? `r/${target.replace("r/", "")}` : target;
    output.info(`Finding trending content in ${targetLabel}...`);
  } else {
    output.info("Finding trending content across configured targets...");
  }
  try {
    await runTrendingWithToolCalling(skillName, target);
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
  program.command("trending").description("Find trending posts for inspiration").option("-s, --skill <name>", "Skill to use", "reddit-commenter").option("-t, --target <name>", "Specific target to check (subreddit or timeline tab)").action(async (options) => {
    await runWithSkillSelection(options.skill, "trending", options.target);
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
async function promptForInstruction(type) {
  const placeholders = {
    comment: "Post 3 comments on r/chatgptpro",
    post: "Write a post about..."
  };
  const result = await p.text({
    message: `Enter ${type} instruction:`,
    placeholder: placeholders[type] ?? "Enter instruction...",
    validate: (value) => {
      if (!value.trim()) return "Instruction is required";
      return void 0;
    }
  });
  if (p.isCancel(result)) {
    p.cancel("Operation cancelled.");
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
    const selected = await p.select({
      message: "Select a skill:",
      options: skills.map((s) => ({ value: s, label: s }))
    });
    if (p.isCancel(selected)) {
      p.cancel("Operation cancelled.");
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
  while (true) {
    const skill = await p.select({
      message: "Select a skill:",
      options: skills.map((s) => ({ value: s, label: s }))
    });
    if (p.isCancel(skill)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    const mode = await p.select({
      message: "Select a mode:",
      options: [
        { value: "batch", label: "Batch Mode", hint: "Fill daily quota" },
        { value: "commenter", label: "Comment", hint: "Post specific comments" },
        { value: "notifications", label: "Notifications", hint: "Check and respond" },
        { value: "trending", label: "Trending", hint: "Find trending posts" },
        { value: "post", label: "Post", hint: "Write and publish content" }
      ]
    });
    if (p.isCancel(mode)) {
      p.cancel("Operation cancelled.");
      process.exit(0);
    }
    let instruction;
    if (mode === "commenter") {
      instruction = await promptForInstruction("comment");
    } else if (mode === "post") {
      instruction = await promptForInstruction("post");
    }
    await runWithSkillSelection(skill, mode, instruction);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.resume();
      process.stdin.removeAllListeners("data");
    }
    process.stdout.write("\n");
    const runAgain = await promptRunAnotherTask();
    if (runAgain === null) {
      process.exit(0);
    }
    if (!runAgain) {
      break;
    }
  }
}
function promptRunAnotherTask() {
  return new Promise((resolve2) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const onSigInt = () => {
      rl.close();
      process.removeListener("SIGINT", onSigInt);
      process.stdout.write("\n");
      resolve2(null);
    };
    process.on("SIGINT", onSigInt);
    rl.question("Run another task? (y/n): ", (answer) => {
      process.removeListener("SIGINT", onSigInt);
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === "y" || trimmed === "yes") {
        resolve2(true);
      } else {
        resolve2(false);
      }
    });
  });
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
