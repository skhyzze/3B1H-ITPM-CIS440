import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import esbuild from "esbuild";

const root = process.cwd();
const dist = path.join(root, "dist");
const skipDirs = new Set([".git", ".github", ".cursor", "node_modules", "dist", "scripts"]);

function rel(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function hashedName(file, code) {
  const ext = path.extname(file);
  const base = path.basename(file, ext);
  const hash = crypto.createHash("sha256").update(code).digest("hex").slice(0, 10);
  return path.posix.join(path.dirname(file), `${base}.${hash}${ext}`);
}

function rewrite(text, pairs) {
  let next = text;
  for (const [from, to] of pairs) next = next.split(from).join(to);
  return next;
}

const files = walk(root);
const assets = files
  .map(rel)
  .filter((file) => /^(css|js)\//.test(file) && /\.(css|js)$/.test(file));

const minified = new Map();
for (const file of assets) {
  const result = await esbuild.transform(fs.readFileSync(path.join(root, file), "utf8"), {
    loader: file.endsWith(".css") ? "css" : "js",
    minify: true,
    legalComments: "none",
    target: "es2018",
  });
  minified.set(file, result.code);
}

const map = new Map();
for (const [file, code] of minified) {
  if (file === "js/site.js") continue;
  map.set(file, hashedName(file, code));
}

const pairs = [...map.entries()].sort((a, b) => b[0].length - a[0].length);
const site = rewrite(minified.get("js/site.js"), pairs);
minified.set("js/site.js", site);
map.set("js/site.js", hashedName("js/site.js", site));
const allPairs = [...map.entries()].sort((a, b) => b[0].length - a[0].length);

fs.rmSync(dist, { recursive: true, force: true });

for (const file of files) {
  const name = rel(file);
  if (/^(css|js)\//.test(name) && /\.(css|js)$/.test(name)) continue;
  if (name === "package.json" || name === "package-lock.json") continue;
  const target = path.join(dist, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (name.endsWith(".html") && !name.includes("/")) {
    fs.writeFileSync(target, rewrite(fs.readFileSync(file, "utf8"), allPairs));
  } else {
    fs.copyFileSync(file, target);
  }
}

for (const [file, code] of minified) {
  const target = path.join(dist, map.get(file));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, code);
}

console.log(`Built ${map.size} assets into dist/`);
