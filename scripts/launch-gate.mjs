#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_PRODUCTION_ENV = [
  "SITE_DOMAIN",
  "POSTGRES_PASSWORD",
  "DATABASE_URL",
  "JWT_SECRET",
  "NEXTAUTH_SECRET",
  "PAYMENT_PROVIDER",
];
const SHIPPED_SOURCE_DIR = "apps/web/src";
const TAX_RULES_DIR = "packages/finance-engine/src/finance_engine";
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".json"]);
const TODO_MARKER = /\bTODO\s*\(\s*(?:LEGAL\b|DECISION\b)/i;

function sourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!["__tests__", "tests"].includes(entry.name)) files.push(...sourceFiles(path));
    } else if (SOURCE_EXTENSIONS.has(path.slice(path.lastIndexOf(".")).toLowerCase())) {
      if (!/(?:\.test|\.spec)\.[^.]+$/i.test(entry.name)) files.push(path);
    }
  }
  return files;
}

function taxRuleFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...taxRuleFiles(path));
    } else if (/^tax_rules.*\.ya?ml$/i.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

export function getLaunchGateIssues({ root = ROOT, env = process.env } = {}) {
  const issues = [];
  const missingEnv = REQUIRED_PRODUCTION_ENV.filter((name) => !env[name]?.trim());
  if (missingEnv.length) {
    issues.push(`Missing production environment variables: ${missingEnv.join(", ")}`);
  }

  const paymentProvider = env.PAYMENT_PROVIDER?.trim().toLowerCase();
  if (paymentProvider === "fake" || paymentProvider === "disabled") {
    issues.push(`PAYMENT_PROVIDER must be a live provider, not "${paymentProvider}".`);
  }
  if (!env.OPENAI_API_KEY?.trim()) issues.push("OPENAI_API_KEY is missing.");
  if (!env.SENTRY_DSN?.trim()) issues.push("SENTRY_DSN is missing.");

  const taxDirectory = join(root, TAX_RULES_DIR);
  if (!existsSync(taxDirectory)) {
    issues.push(`Tax rules directory is missing: ${TAX_RULES_DIR}`);
  } else {
    const files = taxRuleFiles(taxDirectory);
    if (!files.length) issues.push(`No tax rules YAML files found under ${TAX_RULES_DIR}`);
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (/^\s*verified\s*:\s*false\s*(?:#.*)?$/i.test(line)) {
          issues.push(`Unverified tax rule: ${relative(root, file)}:${index + 1}`);
        }
      });
    }
  }

  const sourceDirectory = join(root, SHIPPED_SOURCE_DIR);
  if (!existsSync(sourceDirectory)) {
    issues.push(`Shipped web source directory is missing: ${SHIPPED_SOURCE_DIR}`);
  } else {
    for (const file of sourceFiles(sourceDirectory)) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (TODO_MARKER.test(line)) {
          issues.push(`Unresolved legal or decision marker: ${relative(root, file)}:${index + 1}`);
        }
      });
    }
  }

  return issues;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const issues = getLaunchGateIssues();
  if (issues.length) {
    console.error("LAUNCH GATE: BLOCKED");
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log("LAUNCH GATE: READY");
  }
}
