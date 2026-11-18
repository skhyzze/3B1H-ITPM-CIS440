import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const port = Number(process.env.PORT) || 8765;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function build() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/build.mjs"], { cwd: root, stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("build failed"))));
  });
}

let building = false;
let queued = false;
let timer;

async function rebuild() {
  if (building) {
    queued = true;
    return;
  }
  building = true;
  try {
    await build();
  } catch (error) {
    console.error(error.message);
  }
  building = false;
  if (queued) {
    queued = false;
    rebuild();
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(rebuild, 150);
}

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.normalize(path.join(dist, rel));
    if (!file.startsWith(dist)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        fs.readFile(path.join(dist, "404.html"), (missingErr, page) => {
          res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
          res.end(missingErr ? "Not found" : page);
        });
        return;
      }
      const type = types[path.extname(file).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": type });
      res.end(data);
    });
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Stop that server, or run with PORT set to a free port.`);
      process.exit(1);
    }
    throw err;
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Preview at http://127.0.0.1:${port}/`);
  });
}

await build();
serve();

fs.watch(root, { recursive: true }, (_event, filename) => {
  if (!filename) return;
  const name = String(filename).replaceAll("\\", "/");
  if (/^(dist|node_modules|\.git|\.cursor)\//.test(name)) return;
  schedule();
});
