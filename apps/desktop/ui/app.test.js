import assert from "node:assert/strict";
import { test } from "node:test";

import { escapeHtml, renderDashboard } from "./view.js";
import { getMessages } from "./messages.js";
import { readFile } from "node:fs/promises";

test("desktop agent translations cover all supported locales", () => {
  for (const locale of ["uz", "ru", "en"]) {
    const translated = getMessages(locale);
    assert.ok(translated.appTitle);
    assert.ok(translated.syncStatement);
    assert.ok(translated.apiUnreachable);
    assert.ok(translated.invalidInput);
    assert.doesNotMatch(Object.values(translated).join(" "), /Рџ|РЎ|Р°|Рё|Рµ|Рѕ|РЅ|Р»|Рї|СЃ|С‚|вЂ/);
  }
});

test("desktop styles use the shared indigo and amber light/dark design tokens", async () => {
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");
  assert.match(styles, /--primary:\s*243 75% 59%/);
  assert.match(styles, /--primary:\s*243 100% 76%/);
  assert.match(styles, /--accent:\s*38 92% 50%/);
  assert.match(styles, /--accent:\s*43 96% 56%/);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b/i);
  assert.match(styles, /prefers-reduced-motion/);
});

test("dashboard rendering escapes API-controlled content", () => {
  const html = renderDashboard(
    {
      devices: [
        {
          id: `device"><script>alert(1)</script>`,
          name: `<img src=x onerror=alert(1)>`,
          status: "registered"
        }
      ],
      commands: [
        {
          id: "command-1",
          name: "sync_statement",
          status: "queued",
          device_id: "device-1",
          created_at: "2026-10-04T08:00:00Z"
        }
      ]
    },
    "en"
  );

  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /Queued/);
});

test("dashboard shows translated offline queue status", () => {
  const html = renderDashboard({ devices: [], commands: [] }, "en", false, { online: false, queued: 2 });
  assert.match(html, /Offline/);
  assert.match(html, /Queued records: 2/);
});

test("owner chat renders translated labels and escapes transcript messages", () => {
  const html = renderDashboard({ devices: [], commands: [] }, "en", false, undefined, {
    messages: [{ role: "user", content: "<script>do bad</script>" }], busy: false
  });
  assert.match(html, /Owner chat/);
  assert.match(html, /&lt;script&gt;do bad&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>do bad/);
  for (const locale of ["uz", "ru", "en"]) assert.ok(getMessages(locale).chatSend);
});

test("desktop bundle sources contain no AI credential or direct provider endpoint", async () => {
  const { readFile } = await import("node:fs/promises");
  const sources = await Promise.all(["app.js", "view.js"].map((file) => readFile(new URL(`./${file}`, import.meta.url), "utf8")));
  assert.doesNotMatch(sources.join("\n"), /OPENAI_API_KEY|sk-[A-Za-z0-9]{20,}|api\.openai\.com/);
});

test("HTML text escaping covers markup and attribute delimiters", () => {
  assert.equal(escapeHtml(`<tag attr="a"> & 'b'`), "&lt;tag attr=&quot;a&quot;&gt; &amp; &#39;b&#39;");
});
