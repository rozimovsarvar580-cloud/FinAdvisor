import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const CHECK = /^\s*-\s*(exists|absent|contains|not-contains|cmd):\s*(.+)$/i;

export function parseTasks(text) {
  const tasks = [];
  let current = null;
  let stage = "";

  text.split(/\r?\n/).forEach((line, idx) => {
    const task = line.match(/^- \[( |x|X)\]\s+(\S+)\s+(.*)$/);
    if (task) {
      current = {
        idx,
        done: task[1].toLowerCase() === "x",
        id: task[2],
        title: task[3],
        body: [],
        stage,
      };
      tasks.push(current);
    } else if (/^#{1,6}\s/.test(line)) {
      current = null;
      const heading = line.match(/^##\s+(.*)$/);
      if (heading) stage = heading[1];
    } else if (current) {
      current.body.push(line);
    }
  });

  return tasks;
}

export function hasMachineChecks(task) {
  return task.body.some((line) => CHECK.test(line));
}

export function taskNeeds(task) {
  return task.body
    .map((line) => line.match(/^\s*-?\s*needs:\s*(.+)$/i))
    .filter(Boolean)
    .flatMap((match) => match[1].split(",").map((item) => item.trim()).filter(Boolean));
}

export function runTaskChecks(task, { root = process.cwd(), python = "python", runCommand = spawnSync } = {}) {
  const problems = [];

  for (const line of task.body) {
    const match = line.match(CHECK);
    if (!match) continue;
    const kind = match[1].toLowerCase();
    const value = match[2].trim();

    if (kind === "exists") {
      for (const path of value.split(",").map((item) => item.trim())) {
        if (!existsSync(join(root, path))) problems.push(`missing: ${path}`);
      }
    } else if (kind === "absent") {
      for (const path of value.split(",").map((item) => item.trim())) {
        if (existsSync(join(root, path))) problems.push(`should not exist: ${path}`);
      }
    } else if (kind === "contains" || kind === "not-contains") {
      const [path, needle] = value.split("::").map((item) => item.trim());
      if (!path || needle === undefined) {
        problems.push(`invalid ${kind} check: ${value}`);
        continue;
      }
      if (!existsSync(join(root, path))) {
        problems.push(`missing file for ${kind}: ${path}`);
        continue;
      }
      const hasText = readFileSync(join(root, path), "utf8").includes(needle);
      if (kind === "contains" && !hasText) problems.push(`${path} must contain: ${needle}`);
      if (kind === "not-contains" && hasText) problems.push(`${path} must NOT contain: ${needle}`);
    } else {
      const command = value.replaceAll("{{PY}}", python);
      const result = runCommand(command, { cwd: root, shell: true, encoding: "utf8" });
      if (result.status !== 0) {
        const output = `${result.stdout || ""}${result.stderr || ""}`.split("\n").slice(-25).join("\n");
        problems.push(`command failed: ${value}${output ? `\n${output}` : ""}`);
      }
    }
  }

  return problems;
}

export function markTasksDone(text, ids) {
  const completed = new Set(ids);
  if (completed.size === 0) return text;

  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  let changed = false;

  for (let index = 0; index < lines.length; index++) {
    const task = lines[index].match(/^- \[( |x|X)\]\s+(\S+)\s+/);
    if (task && task[1] === " " && completed.has(task[2])) {
      lines[index] = lines[index].replace(/^- \[ \]/, "- [x]");
      changed = true;
    }
  }

  return changed ? lines.join(newline) : text;
}
