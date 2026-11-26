import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const LOCALES = ["en", "ru", "uz"];
const INDUSTRY_TERMS =
  /restaurant\p{L}*|restoran\p{L}*|ресторан\p{L}*|caf[eé]|kafe|кафе/iu;
const EXAMPLE_TEXT = {
  "apps/web/src/messages/en.json": {
    "landing.about.story.eyebrow": "A restaurant example",
    "landing.about.story.paragraph1":
      "Imagine you want to open a restaurant. You have a menu and location in mind, but questions remain about costs, team size, and expected revenue.",
    "landing.about.story.exampleLabel": "Restaurant project",
    "finadvisor.wizard.eyebrow": "Restaurant example",
    "finadvisor.wizard.formats.cafe": "Cafe",
  },
  "apps/web/src/messages/ru.json": {
    "landing.about.story.eyebrow": "На примере ресторана",
    "landing.about.story.paragraph1":
      "Представьте, что вы хотите открыть ресторан. Меню и место уже выбраны, но остаются вопросы о расходах, размере команды и ожидаемой выручке.",
    "landing.about.story.exampleLabel": "Ресторанный проект",
    "finadvisor.wizard.eyebrow": "Пример ресторана",
    "finadvisor.wizard.formats.cafe": "Кафе",
  },
  "apps/web/src/messages/uz.json": {
    "landing.about.story.eyebrow": "Restoran misolida",
    "landing.about.story.paragraph1":
      "Tasavvur qiling: siz o‘z restoraningizni ochmoqchisiz. Taomlar va joy tayyor, ammo xarajatlar, jamoa soni va kutilayotgan tushum bo‘yicha savollar ko‘p.",
    "landing.about.story.exampleLabel": "Restoran loyihasi",
    "finadvisor.wizard.eyebrow": "Restoran misolida",
    "finadvisor.wizard.formats.cafe": "Kafe",
  },
  "apps/api/src/finadvisor_api/document_messages.json": {
    "en.formats.cafe": "Cafe",
    "ru.formats.cafe": "Кафе",
    "uz.formats.cafe": "Kafe",
  },
};

function isAllowedExample(file, valuePath, value) {
  if (EXAMPLE_TEXT[file]?.[valuePath] === value) {
    return true;
  }
  const pathSegments = valuePath.split(/[.[\]]+/);
  return (
    pathSegments.includes("restaurant_cafe") &&
    pathSegments.some((segment) => ["sector", "sectors", "sectorNames"].includes(segment))
  );
}

export function findIndustryWordingViolations(file, value, prefix = "") {
  const violations = [];
  function visit(current, currentPath) {
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${currentPath}[${index}]`));
      return;
    }
    if (current && typeof current === "object") {
      for (const [key, child] of Object.entries(current)) {
        visit(child, currentPath ? `${currentPath}.${key}` : key);
      }
      return;
    }
    if (typeof current !== "string" || isAllowedExample(file, currentPath, current)) {
      return;
    }
    const match = current.match(INDUSTRY_TERMS);
    if (match) {
      violations.push({ file, path: currentPath, term: match[0], value: current });
    }
  }
  visit(value, prefix);
  return violations;
}

function readJson(relativePath) {
  const absolutePath = resolve(ROOT, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing locale file: ${relativePath}`);
  }
  return JSON.parse(readFileSync(absolutePath, "utf8"));
}

function localeEntries(relativePath, localeBundle) {
  const entries = [];
  for (const locale of LOCALES) {
    if (!localeBundle || typeof localeBundle !== "object" || !(locale in localeBundle)) {
      throw new Error(`${relativePath} is missing the ${locale} locale`);
    }
    entries.push([locale, localeBundle[locale]]);
  }
  return entries;
}

async function main() {
  const violations = [];
  const localeFiles = [
    "apps/web/src/messages/en.json",
    "apps/web/src/messages/ru.json",
    "apps/web/src/messages/uz.json",
    "packages/i18n/messages/en.json",
    "packages/i18n/messages/ru.json",
    "packages/i18n/messages/uz.json",
  ];
  for (const file of localeFiles) {
    violations.push(...findIndustryWordingViolations(file, readJson(file)));
  }

  const apiMessageFiles = [
    "apps/api/src/finadvisor_api/document_messages.json",
    "apps/api/src/finadvisor_api/auth_email_messages.json",
    "apps/api/src/finadvisor_api/lead_magnet_messages.json",
  ];
  for (const file of apiMessageFiles) {
    for (const [locale, messages] of localeEntries(file, readJson(file))) {
      violations.push(...findIndustryWordingViolations(file, messages, locale));
    }
  }

  const desktopPath = "apps/desktop/ui/messages.js";
  const desktopModule = await import(
    pathToFileURL(resolve(ROOT, desktopPath)).href
  );
  for (const [locale, messages] of localeEntries(desktopPath, desktopModule.messages)) {
    violations.push(...findIndustryWordingViolations(desktopPath, messages, locale));
  }

  if (violations.length) {
    const lines = violations.map(({ file, path, term, value }) => {
      return `${file}: ${path}: disallowed term "${term}" in "${value}"`;
    });
    console.error(`Industry wording check failed:\n${lines.join("\n")}`);
    process.exitCode = 1;
    return;
  }
  console.log("Industry wording check passed.");
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await main();
}
