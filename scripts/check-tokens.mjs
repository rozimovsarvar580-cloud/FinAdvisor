#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOTS = [
  "apps/web/src/components",
  "apps/web/src/app",
];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);
const IGNORED_DIRECTORIES = new Set([
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "generated",
  "node_modules",
  "out",
  "__generated__",
]);

const COLOR_LITERAL = /#[\da-f]{3}(?:[\da-f]|[\da-f]{3}|[\da-f]{5})?\b|\brgba?\s*\(/gi;
const ALLOW_HEX_COMMENT = /(?:\/\/|\/\*|\*|<!--)\s*allow-hex\b/;

export function findColorLiterals(source) {
  const violations = [];

  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (ALLOW_HEX_COMMENT.test(line)) continue;

    COLOR_LITERAL.lastIndex = 0;
    for (const match of line.matchAll(COLOR_LITERAL)) {
      violations.push({ line: index + 1, literal: match[0] });
    }
  }

  return violations;
}

function collectSourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        files.push(...collectSourceFiles(join(directory, entry.name)));
      }
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      files.push(join(directory, entry.name));
    }
  }
  return files;
}

export function scanTokenSources(root = ROOT) {
  const violations = [];

  for (const sourceRoot of SOURCE_ROOTS) {
    const absoluteRoot = join(root, sourceRoot);
    for (const file of collectSourceFiles(absoluteRoot)) {
      const source = readFileSync(file, "utf8");
      for (const violation of findColorLiterals(source)) {
        violations.push({
          ...violation,
          file: relative(root, file).replaceAll("\\", "/"),
        });
      }
    }
  }

  return violations;
}

function main() {
  const violations = scanTokenSources();
  if (violations.length > 0) {
    console.error("Disallowed hex/rgb color literals found; use design tokens or mark brand-logo lines with allow-hex:");
    for (const violation of violations) {
      console.error(`  ${violation.file}:${violation.line}: ${violation.literal}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Token color guard passed.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
