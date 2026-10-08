#!/usr/bin/env node
// FinAdvisor verification gate: ONE command, same checks locally, in the loop and in CI.
//
//   node scripts/verify.mjs                fast gate
//   FULL=1 node scripts/verify.mjs         + production build + Playwright e2e (+ cargo check)
//   SKIP=web:types,py:ruff node ...        skip named steps
//   ONLY=py:pytest node ...                run one step only
//   PY=python3 node ...                    choose the Python executable (default: python)
//
// Optional scripts/verify.config.json: { "extraSteps": [["name", "command", "cwd"]] }
//
// On failure it prints the tail of the failing step and writes it to .loop/last-failure.txt
// so the loop can feed it to the agent on the next iteration.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { containsPrivateKeyBlock } from "./private-key-scan.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PY = process.env.PY || "python";
const FULL = Boolean(process.env.FULL);
const skip = new Set((process.env.SKIP || "").split(",").map((s) => s.trim()).filter(Boolean));
const only = process.env.ONLY || "";
const STEP_TIMEOUT_MS = 15 * 60 * 1000;

const has = (p) => existsSync(join(ROOT, p));
const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(join(ROOT, p), "utf8"));
  } catch {
    return null;
  }
};

// ---------- secret / leak scan ----------
function scanSecrets() {
  const problems = [];
  const ls = spawnSync("git", ["ls-files", "-co", "--exclude-standard"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (ls.status !== 0) return { ok: true, note: "not a git repository, scan skipped" };

  // .gitignore must protect the secret files
  const gi = has(".gitignore") ? readFileSync(join(ROOT, ".gitignore"), "utf8") : "";
  for (const needle of ["ai.config.json", ".env", ".loop"]) {
    if (!gi.includes(needle)) problems.push(`.gitignore does not contain "${needle}"`);
  }

  const patterns = [
    [/sk-[A-Za-z0-9_-]{20,}/, "OpenAI-style API key"],
    [/AIza[0-9A-Za-z_-]{35}/, "Google API key"],
    [/gh[pousr]_[A-Za-z0-9]{36,}/, "GitHub token"],
    [/xox[baprs]-[A-Za-z0-9-]{10,}/, "Slack token"],
  ];
  const skipExt = new Set([".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".pdf", ".zip", ".db", ".lock", ".tsbuildinfo", ".icns"]);
  const files = ls.stdout.split("\n").filter(Boolean);
  for (const f of files) {
    const base = f.split("/").pop();
    if (base === "ai.config.json" || base === ".env" || (base.startsWith(".env.") && !base.endsWith(".example"))) {
      problems.push(`${f} is not ignored by git (secret file would be committed)`);
      continue;
    }
    if (f.split("/").includes("node_modules") || skipExt.has(extname(f).toLowerCase()) || /\.example(\.|$)/.test(base) || base === "package-lock.json") continue;
    try {
      const full = join(ROOT, f);
      if (!existsSync(full) || statSync(full).size > 1_000_000) continue;
      const text = readFileSync(full, "utf8");
      if (containsPrivateKeyBlock(text)) problems.push(`${f}: looks like a private key`);
      for (const [re, label] of patterns) {
        if (re.test(text)) problems.push(`${f}: looks like a ${label}`);
      }
    } catch {
      /* unreadable file: ignore */
    }
  }
  return { ok: problems.length === 0, problems };
}

// ---------- step list ----------
const steps = [];
const add = (name, cmd, cwd = ".") => steps.push({ name, cmd, cwd });

if (has("apps/web/package.json")) {
  add("web:lint", "npm run lint", "apps/web");
  add("web:types", "npx tsc --noEmit", "apps/web");
  add("web:unit", "npm test", "apps/web");
  if (has("apps/web/scripts/test-locales.mjs")) add("web:locales", "node scripts/test-locales.mjs", "apps/web");
}
add("web:tokens:test", "node --test scripts/check-tokens.test.mjs", ".");
add("secrets:test", "node --test scripts/private-key-scan.test.mjs", ".");
add("web:tokens", "node scripts/check-tokens.mjs", ".");
if (has("apps/api") || has("packages/finance-engine")) {
  add("py:ruff", `${PY} -m ruff check apps/api packages/finance-engine`);
  add("py:pytest", `${PY} -m pytest apps/api/tests packages/finance-engine/tests -q -x`);
}
if (has("apps/desktop/package.json") && readJson("apps/desktop/package.json")?.scripts?.test) {
  add("desktop:test", "npm test", "apps/desktop");
}
steps.push({ name: "secrets", fn: scanSecrets });
if (FULL) {
  if (has("apps/web/package.json")) {
    add("web:build", "npm run build", "apps/web");
    add("web:e2e", "npm run test:e2e", "apps/web");
  }
  if (has("apps/desktop/src-tauri/Cargo.toml")) add("desktop:cargo", "cargo check", "apps/desktop/src-tauri");
}
for (const [name, cmd, cwd] of readJson("scripts/verify.config.json")?.extraSteps ?? []) add(name, cmd, cwd || ".");

// ---------- run ----------
mkdirSync(join(ROOT, ".loop"), { recursive: true });
const failureFile = join(ROOT, ".loop", "last-failure.txt");
const results = [];
let failed = null;

for (const step of steps) {
  if (only && step.name !== only) continue;
  if (skip.has(step.name)) {
    console.log(`SKIP  ${step.name}`);
    continue;
  }
  const started = Date.now();
  let ok;
  let output = "";
  if (step.fn) {
    const r = step.fn();
    ok = r.ok;
    output = (r.problems || [r.note || ""]).join("\n");
  } else {
    const r = spawnSync(step.cmd, {
      cwd: join(ROOT, step.cwd),
      shell: true,
      encoding: "utf8",
      timeout: STEP_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
    });
    ok = r.status === 0;
    output = `${r.stdout || ""}${r.stderr || ""}`;
    if (r.error) output += `\n${r.error.message}`;
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`${ok ? "PASS" : "FAIL"}  ${step.name}  (${secs}s)`);
  results.push({ name: step.name, ok, secs: Number(secs) });
  if (!ok) {
    const tail = output.split("\n").slice(-60).join("\n");
    const report = `STEP: ${step.name}\nCOMMAND: ${step.cmd || "(internal)"}\n\n${tail}\n`;
    writeFileSync(failureFile, report);
    console.log(`\n${report}`);
    failed = step.name;
    break; // fail fast: one problem at a time keeps the agent focused
  }
}

if (!failed) writeFileSync(failureFile, "");
writeFileSync(join(ROOT, ".loop", "last-verify.json"), JSON.stringify({ at: new Date().toISOString(), failed, results }, null, 2));
if (!failed) console.log("\nverify: ALL GREEN");
process.exit(failed ? 1 : 0);
