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

test("HTML text escaping covers markup and attribute delimiters", () => {
  assert.equal(escapeHtml(`<tag attr="a"> & 'b'`), "&lt;tag attr=&quot;a&quot;&gt; &amp; &#39;b&#39;");
});
