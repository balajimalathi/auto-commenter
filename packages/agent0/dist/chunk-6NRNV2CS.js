var __glob = (map) => (path) => {
  var fn = map[path];
  if (fn) return fn();
  throw new Error("Module not found in bundle: " + path);
};

// src/ui/prompts-inquirer.ts
import { select, input, confirm } from "@inquirer/prompts";

// src/skill-loader.ts
import { readdir, readFile, writeFile } from "fs/promises";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { existsSync } from "fs";
var SKILLS_DIR = ".claude/skills";
var TRACKING_DIR = "tracking";
var LEADS_DIR = "leads";
function getProjectRoot() {
  let current = process.cwd();
  while (current !== dirname(current)) {
    const skillsPath = join(current, SKILLS_DIR);
    if (existsSync(skillsPath)) {
      return current;
    }
    current = dirname(current);
  }
  return process.cwd();
}
async function discoverSkills() {
  const skillsPath = join(getProjectRoot(), SKILLS_DIR);
  if (!existsSync(skillsPath)) {
    return [];
  }
  const entries = await readdir(skillsPath, { withFileTypes: true });
  const skills = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillMdPath = join(skillsPath, entry.name, "SKILL.md");
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
  const skillPath = join(root, SKILLS_DIR, skillName);
  const platform = extractPlatform(skillName);
  if (!existsSync(skillPath)) {
    throw new Error(`Skill not found: ${skillName}`);
  }
  const skillMdPath = join(skillPath, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    throw new Error(`SKILL.md not found for skill: ${skillName}`);
  }
  const skillContent = await readFile(skillMdPath, "utf-8");
  const batchMdPath = join(skillPath, "BATCH.md");
  const batchContent = existsSync(batchMdPath) ? await readFile(batchMdPath, "utf-8") : null;
  const resourcesPath = join(skillPath, "resources");
  const resources = {};
  if (existsSync(resourcesPath)) {
    const resourceFiles = await readdir(resourcesPath);
    for (const file of resourceFiles) {
      if (file.endsWith(".md")) {
        const resourceName = file.replace(".md", "");
        resources[resourceName] = await readFile(
          join(resourcesPath, file),
          "utf-8"
        );
      }
    }
  }
  const trackingPath = join(root, TRACKING_DIR, platform);
  const leadsPath = join(root, LEADS_DIR, `${platform}.md`);
  const memoryPath = join(skillPath, "memory.md");
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
  const resourcePath = join(skill.skillPath, "resources", `${resourceName}.md`);
  if (existsSync(resourcePath)) {
    const content = await readFile(resourcePath, "utf-8");
    skill.resources[resourceName] = content;
    return content;
  }
  return null;
}
function getTodayTrackingPath(skill) {
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  return join(skill.trackingPath, `${today}.md`);
}
async function loadTracking(skill) {
  const trackingFile = getTodayTrackingPath(skill);
  if (existsSync(trackingFile)) {
    return await readFile(trackingFile, "utf-8");
  }
  const templatePath = join(skill.trackingPath, "template.md");
  if (existsSync(templatePath)) {
    let templateContent = await readFile(templatePath, "utf-8");
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    templateContent = templateContent.replace(/\[YYYY-MM-DD\]/g, today);
    const trackingDir = skill.trackingPath;
    if (!existsSync(trackingDir)) {
      mkdirSync(trackingDir, { recursive: true });
    }
    await writeFile(trackingFile, templateContent, "utf-8");
    return templateContent;
  }
  return null;
}
function parseTargets(targetsContent) {
  const targets = [];
  const tableRegex = /\|\s*(?:r\/)?([^|]+?)\s*\|[^|]*\|\s*(\d+)\s*\|/g;
  let match;
  while ((match = tableRegex.exec(targetsContent)) !== null) {
    const name = match[1].trim();
    if (name.toLowerCase() === "target" || name.toLowerCase() === "subreddit" || name.toLowerCase() === "tab") {
      continue;
    }
    targets.push({
      name,
      dailyLimit: parseInt(match[2], 10)
    });
  }
  return targets;
}
function parseTracking(trackingContent) {
  const activities = [];
  const tableRegex = /\|\s*(?:r\/)?([^|]+?)\s*\|\s*(\d+)(?:\/(\d+))?\s*\|\s*(\d+)\s*\|\s*([^|]*)\s*\|/g;
  let match;
  while ((match = tableRegex.exec(trackingContent)) !== null) {
    const target = match[1].trim();
    const lowerTarget = target.toLowerCase();
    if (lowerTarget === "target" || lowerTarget === "subreddit" || lowerTarget === "tab" || lowerTarget.includes("\u2500\u2500") || lowerTarget === "") {
      continue;
    }
    const todayComments = parseInt(match[2], 10);
    const dailyLimit = parseInt(match[4], 10);
    const lastActivity = match[5].trim();
    activities.push({
      target,
      todayComments,
      dailyLimit,
      lastComment: lastActivity === "-" || lastActivity === "" ? null : lastActivity
    });
  }
  return activities;
}

// src/ui/prompts-inquirer.ts
async function selectSkill(skills) {
  const availableSkills = skills || await discoverSkills();
  if (availableSkills.length === 0) {
    throw new Error("No skills found in .claude/skills/");
  }
  return await select({
    message: "Select a skill:",
    choices: availableSkills.map((skill) => ({
      name: skill,
      value: skill
    }))
  });
}
async function selectMode() {
  return await select({
    message: "Select a mode:",
    choices: [
      { name: "Batch Mode", value: "batch", description: "Fill daily quota" },
      { name: "Comment", value: "commenter", description: "Post specific comments" },
      { name: "Notifications", value: "notifications", description: "Check and respond" },
      { name: "Trending", value: "trending", description: "Find trending posts" },
      { name: "Post", value: "post", description: "Write and publish content" }
    ]
  });
}
async function promptInstruction(type) {
  const placeholders = {
    comment: "Post 3 comments on r/saas",
    post: "Write a post about..."
  };
  return await input({
    message: `Enter ${type} instruction:`,
    default: placeholders[type] || "",
    validate: (value) => {
      if (!value.trim()) return "Instruction is required";
      return true;
    }
  });
}
async function promptTarget() {
  const hasTarget = await confirm({
    message: "Do you want to specify a target?",
    default: false
  });
  if (!hasTarget) {
    return void 0;
  }
  return await input({
    message: 'Enter target (subreddit like r/saas or timeline tab like "For you"):',
    validate: (value) => {
      if (!value.trim()) return "Target is required";
      return true;
    }
  });
}
async function selectScriptFile() {
  return await input({
    message: "Enter script file path (e.g., script.json):",
    default: "script.json",
    validate: (value) => {
      if (!value.trim()) return "Script file path is required";
      return true;
    }
  });
}
async function promptNextAction(options) {
  const { hasScript, isError = false, remainingSteps = 0 } = options;
  if (isError) {
    const choices = [
      { name: "Continue script", value: "continue", description: "Proceed to next step despite error" },
      { name: "Switch to manual", value: "manual", description: "Exit script and run manually" },
      { name: "Exit", value: "exit", description: "Stop execution" }
    ];
    return await select({
      message: "Step failed. What would you like to do?",
      choices
    });
  }
  if (hasScript && remainingSteps > 0) {
    const choices = [
      {
        name: `Continue script (${remainingSteps} step${remainingSteps > 1 ? "s" : ""} remaining)`,
        value: "continue"
      },
      { name: "Switch to manual", value: "manual", description: "Exit script and run manually" },
      { name: "Exit", value: "exit", description: "Stop execution" }
    ];
    return await select({
      message: "What would you like to do next?",
      choices
    });
  }
  const runAgain = await confirm({
    message: "Run another mode?",
    default: true
  });
  return runAgain ? "manual" : "exit";
}
async function selectMainAction() {
  return await select({
    message: "What would you like to do?",
    choices: [
      { name: "Run single mode", value: "single", description: "Execute one mode and exit" },
      { name: "Run from script", value: "script", description: "Execute steps from JSON script" },
      { name: "Interactive loop", value: "interactive", description: "Run modes in a loop" },
      { name: "Exit", value: "exit" }
    ]
  });
}

export {
  __glob,
  getProjectRoot,
  discoverSkills,
  loadSkill,
  loadResource,
  loadTracking,
  parseTargets,
  parseTracking,
  selectSkill,
  selectMode,
  promptInstruction,
  promptTarget,
  selectScriptFile,
  promptNextAction,
  selectMainAction
};
