import assert from "node:assert/strict";
import test from "node:test";

import { findColorLiterals } from "./check-tokens.mjs";

test("rejects short and long hex color literals", () => {
  assert.deepEqual(findColorLiterals("color: #abc;\ncolor: #12345678;"), [
    { line: 1, literal: "#abc" },
    { line: 2, literal: "#12345678" },
  ]);
});

test("rejects rgb and rgba color literals, case-insensitively", () => {
  assert.deepEqual(findColorLiterals("color: rgb(1, 2, 3);\ncolor: RGBA(1 2 3 / 50%);"), [
    { line: 1, literal: "rgb(" },
    { line: 2, literal: "RGBA(" },
  ]);
});

test("allows a marked brand-logo line only", () => {
  assert.deepEqual(findColorLiterals('className="brand-[#123456]" /* allow-hex */;\ncolor: #abc;'), [
    { line: 2, literal: "#abc" },
  ]);
});

test("does not treat ordinary text as an allow-hex marker", () => {
  assert.deepEqual(findColorLiterals('const value = "allow-hex #abc";'), [
    { line: 1, literal: "#abc" },
  ]);
});

test("allows token-based colors and HSL palette declarations", () => {
  assert.deepEqual(findColorLiterals("color: hsl(var(--foreground));\n--gradient-brand: linear-gradient(135deg, hsl(243 75% 59%));"), []);
});
