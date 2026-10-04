import assert from "node:assert/strict";
import { once } from "node:events";
import { after, before, test } from "node:test";

import { createStaticServer } from "./dev-server.mjs";

const server = createStaticServer();
let baseUrl;

before(async () => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(() => {
  server.close();
});

test("serves the desktop app entry point", async () => {
  const response = await fetch(baseUrl);

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(await response.text(), /FinAdvisor Agent/);
});

test("does not expose unlisted filesystem paths", async () => {
  const response = await fetch(`${baseUrl}/../src-tauri/src/main.rs`);

  assert.equal(response.status, 404);
});
