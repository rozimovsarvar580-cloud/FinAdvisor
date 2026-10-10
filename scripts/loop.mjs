#!/usr/bin/env node
// FinAdvisor agent loop driver.
//
//   node scripts/loop.mjs              run the loop (needs AGENT_CMD)
//   node scripts/loop.mjs --status     progress summary, next task, what waits on humans
//   node scripts/loop.mjs --review     run a read-only review pass with a fresh agent session
//   DRY_RUN=1 node scripts/loop.mjs    print the next prompt, run nothing
//
// Environment:
//   AGENT_CMD          shell command that reads the prompt on stdin (and/or from {{PROMPT_FILE}})
//                      and edits files in the repo. Use the command of your own agent CLI.
//   MAX_ITER=10        iterations per run
//   MAX_FAILS=3        consecutive failed iterations on one task before handing over to a human
//   MAX_MINUTES=240    total wall-clock budget
//   AGENT_TIMEOUT_MIN=30
//   ALLOW_MAIN=1       allow running on main/master (not recommended)
//   ALLOW_DIRTY=1      allow a dirty working tree at start
//   PY=python          python executable used in `cmd:` checks via {{PY}}
//
// The LOOP (not the agent) decides when a task is done: verify must pass AND every
// check line of the task must pass. The loop ticks the box and commits.

import { spawnSync } from "node:child_process";
import { createHash as hash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTasks, runTaskChecks, taskNeeds } from "./task-checks.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

const TASKS_FILE = "specs/TASKS.md";
const PY = process.env.PY || "python";
const MAX_ITER = Number(process.env.MAX_ITER ?? 10);
const DEFAULT_MAX_FAILS = Number(process.env.MAX_FAILS ?? 3);
const MAX_MINUTES = Number(process.env.MAX_MINUTES ?? 240);
const AGENT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MIN ?? 30) * 60 * 1000;
const AGENT = process.env.AGENT_CMD;
const DRY = process.env.DRY_RUN === "1";
const args = new Set(process.argv.slice(2));

mkdirSync(".loop", { recursive: true });
const log = (m) => appendFileSync(".loop/progress.log", `${new Date().toISOString()} ${m}\n`);
const run = (cmd, argv, opts = {}) => spawnSync(cmd, argv, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
const sh = (command, opts = {}) => spawnSync(command, { shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
const read = (p) => readFileSync(p, "utf8");

// ---------------- task file parsing ----------------
const isHuman = (t) => /^H\d+$/i.test(t.id);
const field = (t, key) => {
  const re = new RegExp(`^\\s*-?\\s*${key}:\\s*(.+)$`, "i");
  return t.body.map((l) => l.match(re)).filter(Boolean).map((m) => m[1].trim());
};
const needsOf = taskNeeds;
const fullText = (t) => `- [ ] ${t.id} ${t.title}\n${t.body.join("\n")}`.trimEnd();

function pickNext(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const open = tasks.filter((t) => !t.done && !isHuman(t));
  const eligible = open.filter((t) => needsOf(t).every((id) => byId.get(id)?.done));
  return { next: eligible[0] ?? null, open, byId };
}

function setBox(id, done) {
  const lines = read(TASKS_FILE).split(/\r?\n/);
  const t = parseTasks(lines.join("\n")).find((x) => x.id === id);
  if (!t) return;
  lines[t.idx] = lines[t.idx].replace(/^- \[( |x|X)\]/, done ? "- [x]" : "- [ ]");
  writeFileSync(TASKS_FILE, lines.join("\n"));
}

// ---------------- status ----------------
function status() {
  const tasks = parseTasks(read(TASKS_FILE));
  const stages = new Map();
  for (const t of tasks) {
    const s = stages.get(t.stage) ?? { done: 0, total: 0 };
    s.total++;
    if (t.done) s.done++;
    stages.set(t.stage, s);
  }
  console.log("PROGRESS");
  for (const [name, s] of stages) console.log(`  ${String(s.done).padStart(3)}/${String(s.total).padEnd(3)} ${name}`);
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  console.log(`  ----\n  ${done}/${total} total (${Math.round((done / Math.max(total, 1)) * 100)}%)\n`);
  const { next, open, byId } = pickNext(tasks);
  if (next) console.log(`NEXT AGENT TASK: ${next.id} ${next.title}`);
  const blocked = open.filter((t) => !needsOf(t).every((id) => byId.get(id)?.done));
  if (blocked.length) {
    const waiting = new Set();
    for (const t of blocked) for (const id of needsOf(t)) if (!byId.get(id)?.done) waiting.add(id);
    console.log(`\nBLOCKED agent tasks: ${blocked.length}`);
    console.log("WAITING ON (you must do these, then change [ ] to [x] in specs/TASKS.md):");
    for (const id of waiting) {
      const h = byId.get(id);
      console.log(`  ${id}  ${h ? h.title : "(unknown id)"}`);
    }
  }
  const humanOpen = tasks.filter((t) => isHuman(t) && !t.done);
  if (humanOpen.length) console.log(`\nHUMAN TASKS open: ${humanOpen.map((t) => t.id).join(", ")}`);
}

if (args.has("--status")) {
  status();
  process.exit(0);
}

// ---------------- checks ----------------
// ---------------- guards ----------------
const PROTECTED = [".env", "apps/api/ai.config.json", "apps/web/.env.local"];
const fingerprint = () =>
  Object.fromEntries(PROTECTED.map((p) => [p, existsSync(p) ? hash("sha256").update(readFileSync(p)).digest("hex") : null]));

function gitOut(argv) {
  const r = run("git", argv);
  return r.status === 0 ? r.stdout : "";
}
function deletedTestFiles() {
  return gitOut(["status", "--porcelain"])
    .split("\n")
    .filter((l) => /^\s?D\s/.test(l) || /^D\s/.test(l))
    .map((l) => l.slice(3).trim())
    .filter((p) => /(\btests?\b|\.test\.|\.spec\.|test_)/i.test(p));
}

// ---------------- prompts ----------------
function buildPrompt(templateFile, vars) {
  let p = read(templateFile);
  for (const [k, v] of Object.entries(vars)) p = p.replaceAll(`{{${k}}}`, v);
  writeFileSync(".loop/prompt.md", p);
  return p;
}
function callAgent(prompt) {
  if (!AGENT) {
    console.error("Set AGENT_CMD to your agent CLI command (it receives the prompt on stdin, or use {{PROMPT_FILE}}).");
    process.exit(2);
  }
  const cmd = AGENT.replaceAll("{{PROMPT_FILE}}", ".loop/prompt.md");
  return spawnSync(cmd, { shell: true, input: prompt, stdio: ["pipe", "inherit", "inherit"], timeout: AGENT_TIMEOUT_MS });
}
const tail = (p, n) => (existsSync(p) ? read(p).split("\n").slice(-n).join("\n") : "");

// ---------------- review mode ----------------
if (args.has("--review")) {
  const prompt = buildPrompt("specs/REVIEW_PROMPT.md", {});
  if (DRY) {
    console.log(prompt);
    process.exit(0);
  }
  callAgent(prompt);
  console.log(existsSync(".loop/review.md") ? `\n--- .loop/review.md ---\n${read(".loop/review.md")}` : "\nNo .loop/review.md was written.");
  process.exit(0);
}

// ---------------- main loop ----------------
const branch = gitOut(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
if (!DRY && /^(main|master)$/.test(branch) && !process.env.ALLOW_MAIN) {
  console.error(`Refusing to run on "${branch}". Create a branch or worktree first:\n  git switch -c loop/work\n(or set ALLOW_MAIN=1)`);
  process.exit(2);
}
if (!DRY && !process.env.ALLOW_DIRTY && gitOut(["status", "--porcelain"]).trim()) {
  console.error("Working tree is not clean. Commit or stash your changes first (or set ALLOW_DIRTY=1).");
  process.exit(2);
}
if (existsSync(".loop/blocked.md")) {
  console.error(`A previous run left .loop/blocked.md:\n${read(".loop/blocked.md")}\nResolve it, delete the file, then run again.`);
  process.exit(1);
}

const startedAt = Date.now();
let fails = 0;
let lastId = "";
let completed = 0;

for (let i = 1; i <= MAX_ITER; i++) {
  if ((Date.now() - startedAt) / 60000 > MAX_MINUTES) {
    console.log(`Time budget (${MAX_MINUTES} min) used up. Stopping.`);
    break;
  }
  const tasks = parseTasks(read(TASKS_FILE));
  const { next, open, byId } = pickNext(tasks);
  if (!next) {
    if (open.length === 0) {
      console.log("All agent tasks are done.");
      process.exit(0);
    }
    const waiting = new Set();
    for (const t of open) for (const id of needsOf(t)) if (!byId.get(id)?.done) waiting.add(id);
    console.log(`No eligible task. ${open.length} task(s) wait on: ${[...waiting].join(", ")}\nRun: node scripts/loop.mjs --status`);
    process.exit(3);
  }
  if (next.id !== lastId) fails = 0;
  lastId = next.id;
  const maxFails = Number(field(next, "max_fails")[0] ?? DEFAULT_MAX_FAILS);

  const prompt = buildPrompt("specs/LOOP_PROMPT.md", {
    TASK: fullText(next),
    FAILURE: tail(".loop/last-failure.txt", 80).trim() || "(none)",
    NOTES: tail(".loop/notes.md", 40).trim() || "(none)",
    ITERATION: String(i),
  });
  console.log(`\n=== iteration ${i}/${MAX_ITER}  task ${next.id}: ${next.title}  (fail ${fails}/${maxFails})`);
  if (DRY) {
    console.log(prompt);
    process.exit(0);
  }

  const before = fingerprint();
  const doneBefore = new Set(tasks.filter((t) => t.done).map((t) => t.id));
  const agent = callAgent(prompt);
  if (agent.error) console.error(`agent error: ${agent.error.message}`);

  // guard: secrets untouched
  const after = fingerprint();
  const touched = PROTECTED.filter((p) => before[p] !== after[p]);
  if (touched.length) {
    console.error(`STOP: the agent modified protected file(s): ${touched.join(", ")}`);
    log(`STOP protected files touched: ${touched.join(", ")}`);
    process.exit(4);
  }

  // guard: the agent must not tick boxes (the loop does that)
  for (const t of parseTasks(read(TASKS_FILE))) {
    if (t.done && !doneBefore.has(t.id)) setBox(t.id, false);
  }

  // agent asked for a human
  if (existsSync(".loop/blocked.md")) {
    console.error(`\nAgent is blocked:\n${read(".loop/blocked.md")}`);
    log(`BLOCKED ${next.id}`);
    process.exit(1);
  }

  const problems = [];
  const v = sh("node scripts/verify.mjs", { env: { ...process.env, FINADVISOR_LOOP: "1" } });
  process.stdout.write(v.stdout || "");
  if (v.status !== 0) problems.push("verify failed (see .loop/last-failure.txt)");

  const deleted = deletedTestFiles();
  if (deleted.length && !fullText(next).includes("allow-test-delete")) {
    problems.push(`test files were deleted: ${deleted.join(", ")}`);
  }
  if (v.status === 0) problems.push(...runTaskChecks(next, { root: ROOT, python: PY }));

  if (problems.length) {
    fails++;
    const msg = `ITERATION ${i} FAILED for task ${next.id}\n${problems.join("\n")}\n`;
    writeFileSync(".loop/last-failure.txt", `${read(".loop/last-failure.txt").trim()}\n\n${msg}`.trim() + "\n");
    console.error(msg);
    log(`FAIL(${fails}/${maxFails}) ${next.id}: ${problems[0].split("\n")[0]}`);
    if (fails >= maxFails) {
      writeFileSync(".loop/blocked.md", `Task ${next.id} (${next.title}) failed ${fails} times in a row.\nLast failure:\n${read(".loop/last-failure.txt")}`);
      console.error(`\nSTUCK on ${next.id}. A human should look at .loop/blocked.md.`);
      process.exit(1);
    }
    continue;
  }

  // success: the loop ticks the box and commits
  setBox(next.id, true);
  run("git", ["add", "-A", "--", ".", ":(exclude).loop"]);
  const staged = run("git", ["diff", "--cached", "--quiet"]);
  if (staged.status !== 0) {
    const c = run("git", ["commit", "-m", `loop(${next.id}): ${next.title}`.slice(0, 100)]);
    if (c.status !== 0) console.error(`git commit failed:\n${c.stderr}`);
  }
  writeFileSync(".loop/last-failure.txt", "");
  completed++;
  fails = 0;
  log(`PASS ${next.id} ${next.title}`);
  console.log(`DONE ${next.id}`);
}

console.log(`\nRun finished: ${completed} task(s) completed. Next: node scripts/loop.mjs --status`);
