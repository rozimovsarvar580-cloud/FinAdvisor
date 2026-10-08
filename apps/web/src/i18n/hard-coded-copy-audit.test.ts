import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import enMessages from "@/messages/en.json";
import ruMessages from "@/messages/ru.json";
import uzMessages from "@/messages/uz.json";

type Candidate = {
  file: string;
  line: number;
  kind: string;
  value: string;
};

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowedBrandCopy = new Set(["FinAdvisor"]);
const dataOnlyText = /^[\s\d.,/%:+()—–-]*(?:UZS|USD|kg|l)?[\s\d.,/%:+()—–-]*$/i;

function isTranslatableCopy(value: string, kind: string) {
  const text = value.trim();
  if (!text || allowedBrandCopy.has(text)) return false;
  if (kind === "message argument" && /^\d+(?:[.,]\d+)*$/.test(text)) return false;
  if (kind === "JSX text" && (text.length === 1 || dataOnlyText.test(text))) return false;
  if (kind === "message argument" && /^[A-Za-z][A-Za-z0-9_.-]*$/.test(text)) return false;
  return true;
}

function scanSource(source: string, file: string): Candidate[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const candidates: Candidate[] = [];
  const messageCall = /(?:^|\.)(?:setError|setMessage|setServerError|setToast|toast|notify|showToast)$/i;
  const validationCall = /\.(?:email|min|max|url|regex|refine|positive|nonempty)$/;
  const uiAttribute = new Set([
    "placeholder",
    "aria-label",
    "aria-description",
    "aria-roledescription",
    "title",
    "alt"
  ]);

  function add(node: ts.Node, kind: string, value: string) {
    if (!isTranslatableCopy(value, kind)) return;
    candidates.push({
      file,
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
      kind,
      value: value.trim()
    });
  }

  function visit(node: ts.Node, messageContext = false) {
    let nestedMessageContext = messageContext;
    if (ts.isCallExpression(node)) {
      const callName = node.expression.getText(sourceFile);
      nestedMessageContext =
        messageContext ||
        messageCall.test(callName) ||
        validationCall.test(callName) ||
        /^useState$/.test(callName);
    }

    if (ts.isJsxText(node)) add(node, "JSX text", node.getText(sourceFile));

    if (ts.isJsxAttribute(node) && uiAttribute.has(node.name.getText(sourceFile)) && node.initializer) {
      const initializer = ts.isJsxExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;
      if (initializer && ts.isStringLiteral(initializer)) {
        add(initializer, `JSX ${node.name.getText(sourceFile)}`, initializer.text);
      }
    }

    if (ts.isStringLiteral(node)) {
      const isJsxChild =
        ts.isJsxExpression(node.parent) &&
        (ts.isJsxElement(node.parent.parent) || ts.isJsxFragment(node.parent.parent));
      if (isJsxChild) add(node, "JSX text", node.text);
      else if (nestedMessageContext) add(node, "message argument", node.text);
    }

    if (ts.isTemplateExpression(node) && nestedMessageContext) {
      add(node, "message argument", node.head.text);
      for (const span of node.templateSpans) add(span, "message argument", span.literal.text);
    }

    ts.forEachChild(node, (child) => visit(child, nestedMessageContext));
  }

  visit(sourceFile);
  return candidates;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")
      ? [entryPath]
      : [];
  });
}

function leafPaths(value: unknown, parent = ""): string[] {
  if (value === null || typeof value !== "object") return [parent];
  return Object.entries(value).flatMap(([key, child]) =>
    leafPaths(child, parent ? `${parent}.${key}` : key)
  );
}

describe("hard-coded user-facing copy audit", () => {
  it("detects JSX copy, accessible text, validation and toast messages", () => {
    const fixture = `
      const form = z.string().min(8, "Use at least eight characters");
      return <button title="Save changes">Save changes</button>;
      return <input placeholder="250000000" />;
      setError("Unable to save this plan");
      toast({ title: "Plan saved" });
    `;

    expect(scanSource(fixture, "fixture.tsx").map(({ kind, value }) => [kind, value])).toEqual([
      ["message argument", "Use at least eight characters"],
      ["JSX title", "Save changes"],
      ["JSX text", "Save changes"],
      ["JSX placeholder", "250000000"],
      ["message argument", "Unable to save this plan"],
      ["message argument", "Plan saved"]
    ]);
  });

  it("finds no untranslated user-facing literals in application TSX", () => {
    const candidates = sourceFiles(sourceRoot).flatMap((file) =>
      scanSource(readFileSync(file, "utf8"), path.relative(sourceRoot, file))
    );

    expect(candidates).toEqual([]);
  });

  it("keeps the audited route copy keys aligned across all locales", () => {
    const localeKeys = [enMessages, ruMessages, uzMessages].map((messages) =>
      leafPaths(messages.routeCopy).sort()
    );

    expect(localeKeys[1]).toEqual(localeKeys[0]);
    expect(localeKeys[2]).toEqual(localeKeys[0]);
  });
});
