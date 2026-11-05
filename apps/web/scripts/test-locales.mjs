import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const localeNames = ["uz", "ru", "en"];
const brandAndProductNames = new Set([
  "Business",
  "English",
  "FinAdvisor",
  "Free",
  "macOS",
  "O‘zbekcha",
  "Pro",
  "Русский",
  "UZS",
  "Windows",
  "—"
]);
const numberOnly = /^[\s\d.,/%:+()—–-]+$/;

function flattenMessages(value, prefix = "", entries = {}) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      flattenMessages(item, `${prefix}[${index}]`, entries)
    );
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      flattenMessages(child, prefix ? `${prefix}.${key}` : key, entries);
    }
  } else {
    entries[prefix] = value;
  }
  return entries;
}

const messagesByLocale = {};
for (const locale of localeNames) {
  const path = new URL(`../src/messages/${locale}.json`, import.meta.url);
  messagesByLocale[locale] = flattenMessages(
    JSON.parse(await readFile(path, "utf8"))
  );
}

const english = messagesByLocale.en;
const englishKeys = Object.keys(english).sort();
for (const locale of ["ru", "uz"]) {
  const localized = messagesByLocale[locale];
  assert.deepEqual(
    Object.keys(localized).sort(),
    englishKeys,
    `${locale} message keys do not match English`
  );

  for (const key of englishKeys) {
    const englishValue = english[key];
    const localizedValue = localized[key];
    if (
      typeof englishValue !== "string" ||
      typeof localizedValue !== "string" ||
      englishValue.trim() !== localizedValue.trim() ||
      numberOnly.test(englishValue.trim()) ||
      brandAndProductNames.has(englishValue.trim())
    ) {
      continue;
    }
    assert.fail(
      `${locale} translation at "${key}" is identical to English: ${JSON.stringify(englishValue)}`
    );
  }
}

console.log(
  `Validated ${englishKeys.length} message keys across ${localeNames.length} locales.`
);
