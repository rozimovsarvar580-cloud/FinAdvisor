import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const appDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/view.js", ["view.js", "text/javascript; charset=utf-8"]],
  ["/messages.js", ["messages.js", "text/javascript; charset=utf-8"]]
]);

export function createStaticServer() {
  const content = new Map(
    [...assets].map(([route, [fileName, contentType]]) => [
      route,
      {
        body: readFileSync(join(appDirectory, "ui", fileName)),
        contentType
      }
    ])
  );

  return createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const asset = content.get(pathname);
    if (!asset) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "content-type": asset.contentType,
      "x-content-type-options": "nosniff",
      "cache-control": "no-store"
    });
    response.end(asset.body);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createStaticServer();
  server.listen(1420, "127.0.0.1", () => {
    console.log("FinAdvisor Agent UI ready at http://127.0.0.1:1420");
  });
}
