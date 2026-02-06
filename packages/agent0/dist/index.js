#!/usr/bin/env node
import {
  executeScript,
  initLogger,
  loadScript,
  output,
  runBatchMode,
  runCommenterMode,
  runNotificationsMode,
  runPostMode,
  runTrendingMode,
  showBanner
} from "./chunk-LPZC5FHA.js";
import {
  discoverSkills,
  promptInstruction,
  promptNextAction,
  promptTarget,
  selectMainAction,
  selectMode,
  selectSkill
} from "./chunk-6NRNV2CS.js";

// src/index.ts
import { config } from "dotenv";
import { resolve } from "path";
import { existsSync } from "fs";

// src/cli.ts
async function runSingleMode() {
  showBanner();
  const skills = await discoverSkills();
  if (skills.length === 0) {
    output.error("No skills found in .claude/skills/");
    process.exit(1);
  }
  const skill = await selectSkill(skills);
  const mode = await selectMode();
  let instruction;
  let target;
  if (mode === "commenter" || mode === "post") {
    instruction = await promptInstruction(mode === "commenter" ? "comment" : "post");
  } else if (mode === "trending") {
    target = await promptTarget();
  }
  output.info(`Using skill: ${skill}`);
  output.info(`Mode: ${mode}`);
  output.divider();
  await executeMode(skill, mode, instruction, target);
}
async function executeMode(skill, mode, instruction, target) {
  try {
    switch (mode) {
      case "batch":
        await runBatchMode(skill);
        break;
      case "commenter":
        if (!instruction) {
          throw new Error("Instruction is required for commenter mode");
        }
        await runCommenterMode(skill, instruction);
        break;
      case "notifications":
        await runNotificationsMode(skill);
        break;
      case "trending":
        await runTrendingMode(skill, target);
        break;
      case "post":
        if (!instruction) {
          throw new Error("Instruction is required for post mode");
        }
        await runPostMode(skill, instruction);
        break;
      default:
        output.error(`Unknown mode: ${mode}`);
        return;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    output.error(`Mode execution failed: ${errorMessage}`);
    throw error;
  }
}
async function runInteractiveLoop() {
  showBanner();
  const skills = await discoverSkills();
  if (skills.length === 0) {
    output.error("No skills found in .claude/skills/");
    process.exit(1);
  }
  while (true) {
    output.divider();
    const skill = await selectSkill(skills);
    const mode = await selectMode();
    let instruction;
    let target;
    if (mode === "commenter" || mode === "post") {
      instruction = await promptInstruction(mode === "commenter" ? "comment" : "post");
    } else if (mode === "trending") {
      target = await promptTarget();
    }
    output.info(`Using skill: ${skill}`);
    output.info(`Mode: ${mode}`);
    output.divider();
    try {
      await executeMode(skill, mode, instruction, target);
      output.success("Mode completed");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      output.error(`Mode failed: ${errorMessage}`);
    }
    const nextAction = await promptNextAction({ hasScript: false });
    if (nextAction === "exit") {
      output.info("Exiting interactive mode");
      break;
    }
  }
}
async function runCLI() {
  while (true) {
    const action = await selectMainAction();
    switch (action) {
      case "single":
        await runSingleMode();
        const nextAfterSingle = await promptNextAction({ hasScript: false });
        if (nextAfterSingle === "exit") {
          return;
        }
        break;
      case "script": {
        const { selectScriptFile } = await import("./prompts-inquirer-BDK7AE2L.js");
        const { executeScript: executeScript2, loadScript: loadScript2 } = await import("./script-executor-KMRZUU6N.js");
        try {
          const scriptPath = await selectScriptFile();
          const script = await loadScript2(scriptPath);
          await executeScript2(script);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          output.error(`Script execution failed: ${errorMessage}`);
        }
        const nextAfterScript = await promptNextAction({ hasScript: false });
        if (nextAfterScript === "exit") {
          return;
        }
        break;
      }
      case "interactive":
        await runInteractiveLoop();
        break;
      case "exit":
        output.info("Goodbye!");
        return;
    }
  }
}

// src/index.ts
var cwd = process.cwd();
var envPaths = [resolve(cwd, ".env"), resolve(cwd, "..", "..", ".env")];
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    config({ path: envPath, override: true });
    break;
  }
}
async function main() {
  initLogger();
  const args = process.argv.slice(2);
  const scriptIndex = args.indexOf("--script");
  let scriptPath = null;
  if (scriptIndex !== -1 && args[scriptIndex + 1]) {
    scriptPath = args[scriptIndex + 1];
  } else if (existsSync(resolve(cwd, "script.json"))) {
    scriptPath = "script.json";
  }
  if (scriptPath) {
    try {
      const script = await loadScript(scriptPath);
      await executeScript(script);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      output.error(`Script execution failed: ${errorMessage}`);
      process.exit(1);
    }
  } else {
    await runCLI();
  }
}
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
