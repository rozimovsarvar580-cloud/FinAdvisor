import assert from "node:assert/strict";
import test from "node:test";

import { containsPrivateKeyBlock } from "./private-key-scan.mjs";

const marker = (direction, type) => `-----${direction} ${type}-----`;

test("ignores a private-key marker without key material", () => {
  assert.equal(containsPrivateKeyBlock(marker("BEGIN", "PRIVATE KEY")), false);
  assert.equal(containsPrivateKeyBlock(`${marker("BEGIN", "PRIVATE KEY")}\n${marker("END", "PRIVATE KEY")}`), false);
});

test("detects a complete, realistically formatted private-key block", () => {
  const body = `${"A".repeat(64)}\n${"B".repeat(64)}\n`;
  const key = `${marker("BEGIN", "PRIVATE KEY")}\n${body}${marker("END", "PRIVATE KEY")}`;

  assert.equal(containsPrivateKeyBlock(key), true);
});

test("requires matching PEM markers and a plausible base64 payload", () => {
  const begin = marker("BEGIN", "RSA PRIVATE KEY");
  const body = `${"A".repeat(64)}\n`;

  assert.equal(containsPrivateKeyBlock(`${begin}\n${body}${marker("END", "PRIVATE KEY")}`), false);
  assert.equal(containsPrivateKeyBlock(`${begin}\nnot base64\n${marker("END", "RSA PRIVATE KEY")}`), false);
});
