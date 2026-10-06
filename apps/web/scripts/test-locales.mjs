import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const required = ["home", "common", "features", "faq"];
const localeNames = ["uz", "ru", "en"];

for (const locale of localeNames) {
  const path = new URL(`../../../packages/i18n/messages/${locale}.json`, import.meta.url);
  const messages = JSON.parse(await readFile(path, "utf8"));
  for (const key of required) assert.ok(messages[key], `${locale} is missing ${key}`);
  assert.equal(messages.features.items.length, 6, `${locale} features item count`);
  assert.equal(messages.faq.items.length, 3, `${locale} FAQ item count`);
}

console.log(`Validated ${localeNames.length} locale resources.`);
