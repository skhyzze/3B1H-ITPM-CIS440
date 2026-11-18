import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import esbuild from "esbuild";
import { checkDist } from "./check-dist.mjs";

const root = process.cwd();
const dist = path.join(root, "dist");
const skipDirs = new Set([".git", ".github", ".cursor", "node_modules", "dist", "scripts", "src"]);
const headerTemplate = fs.readFileSync(path.join(root, "src", "partials", "header.html"), "utf8").trim();
const footerTemplate = fs.readFileSync(path.join(root, "src", "partials", "footer.html"), "utf8").trim();
const headerPages = new Set(["home", "industry", "fellowship", "outcomes", "events", "insights"]);
const showIndustryPartners = /showIndustryPartners:\s*true/.test(
  fs.readFileSync(path.join(root, "js", "config.js"), "utf8")
);
const siteUrl = readSiteUrl(process.env.SITE_URL);

function readSiteUrl(value) {
  const raw = (value || "").trim();
  if (!raw) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("SITE_URL must be an absolute URL, or left empty");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("SITE_URL must start with http:// or https://");
  }
  const prefix = url.pathname.replace(/\/+$/, "");
  return { prefix, root: `${url.origin}${prefix}` };
}

function pageUrl(file) {
  return file === "index.html" ? `${siteUrl.root}/` : `${siteUrl.root}/${file}`;
}

function isNoindex(html) {
  return /<meta\b[^>]*\bname\s*=\s*["']robots["'][^>]*\bcontent\s*=\s*["'][^"']*noindex/i.test(html)
    || /<meta\b[^>]*\bcontent\s*=\s*["'][^"']*noindex[^"']*["'][^>]*\bname\s*=\s*["']robots["']/i.test(html);
}

function rootRelative404(html) {
  return html.replace(/(\s(?:href|src|data-logo-animated)\s*=\s*["'])(?![a-z]+:|\/\/|#|\/)([^"']+)/gi, "$1/$2");
}

function prefixRootPaths(html) {
  if (!siteUrl.prefix) return html;
  return html.replace(/(\s(?:href|src|data-logo-animated)\s*=\s*["'])\/(?!\/)/gi, `$1${siteUrl.prefix}/`);
}

function insertCanonical(html, file) {
  if (/<link\b[^>]*\brel\s*=\s*["']canonical["']/i.test(html)) return html;
  return html.replace("</head>", `  <link rel="canonical" href="${pageUrl(file)}">\n</head>`);
}

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

function renderHeader(current) {
  if (current && !headerPages.has(current)) {
    throw new Error(`Unknown header page "${current}"`);
  }
  let html = headerTemplate;
  html = html.replaceAll("{{logo-href}}", current === "home" ? "#top" : "index.html");
  html = html.replaceAll("{{header-attrs}}", `${current === "insights" ? ' id="nav"' : ""} data-nav-current="${current}"`);
  html = html.replace(/\{\{current:([a-z]+)\}\}/g, (_match, key) => (key === current ? ' aria-current="page"' : ""));
  if (html.includes("{{")) throw new Error("Header partial has an unresolved token");
  return html;
}

function applyIncludes(html, file) {
  const marker = /<!--\s*@include\s+header([^>]*)-->/.exec(html);
  let current = "";
  if (marker) {
    const named = /current\s*=\s*([a-z]+)/.exec(marker[1]);
    current = named ? named[1] : "";
  } else {
    const named = /<header class="lab-header"[^>]*\bdata-nav-current="([a-z]*)"/.exec(html);
    if (!named) throw new Error(`${file} is missing a header`);
    current = named[1];
  }
  const header = renderHeader(current);
  let next = html.replace(/<!--\s*@include\s+(header|footer)[^>]*-->\s*/g, "");
  if (!/<header class="lab-header"/.test(next)) throw new Error(`${file} is missing a header`);
  if (!/<footer class="lab-site-footer"/.test(next)) throw new Error(`${file} is missing a footer`);
  next = next.replace(/<header class="lab-header"[\s\S]*?<\/header>/, header);
  next = next.replace(/<footer class="lab-site-footer"[\s\S]*?<\/footer>/, footerTemplate);
  if (next.includes("@include")) throw new Error(`${file} has an unresolved include`);
  return next;
}

function stripHiddenIndustry(html) {
  if (showIndustryPartners) return html;
  return html.replace(/<a\b[^>]*\bdata-industry-link\b[^>]*>[\s\S]*?<\/a>\s*/g, "");
}

const files = walk(root);
const copyAsIs = new Set(["js/ai-insights.js", "css/pages/ai-insights.css"]);
const assets = files
  .map(rel)
  .filter((file) => /^(css|js)\//.test(file) && /\.(css|js)$/.test(file) && !copyAsIs.has(file));

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
const bundledSite = rewrite(minified.get("js/site.js"), pairs);
minified.set("js/site.js", bundledSite);
map.set("js/site.js", hashedName("js/site.js", bundledSite));
const allPairs = [...map.entries()].sort((a, b) => b[0].length - a[0].length);

fs.mkdirSync(dist, { recursive: true });
for (const entry of fs.readdirSync(dist)) {
  fs.rmSync(path.join(dist, entry), { recursive: true, force: true });
}

const publicPages = [];

for (const file of files) {
  const name = rel(file);
  if (/^(css|js)\//.test(name) && /\.(css|js)$/.test(name)) continue;
  if (name === "package.json" || name === "package-lock.json") continue;
  const target = path.join(dist, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (name === "ai-insights.html" || name.startsWith("ai_brief/")) {
    fs.copyFileSync(file, target);
    continue;
  }
  if (name.endsWith(".html") && !name.includes("/")) {
    let page = rewrite(stripHiddenIndustry(applyIncludes(fs.readFileSync(file, "utf8"), name)), allPairs);
    if (siteUrl) {
      if (name === "404.html") page = rootRelative404(page);
      page = prefixRootPaths(page);
      page = insertCanonical(page, name);
      const hiddenIndustry = name === "industry.html" && !showIndustryPartners;
      if (name !== "404.html" && !hiddenIndustry && !isNoindex(page)) publicPages.push(name);
    }
    fs.writeFileSync(target, page);
  } else {
    fs.copyFileSync(file, target);
  }
}

if (siteUrl) {
  const locs = publicPages.sort().map((file) => `  <url><loc>${pageUrl(file)}</loc></url>`).join("\n");
  fs.writeFileSync(path.join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs}\n</urlset>\n`);
  fs.writeFileSync(path.join(dist, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl.root}/sitemap.xml\n`);
}

for (const [file, code] of minified) {
  const target = path.join(dist, map.get(file));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, code);
}

const unchangedAssets = [
  "ai-insights.html",
  "js/ai-insights.js",
  "css/pages/ai-insights.css",
  "css/shared/tokens.css",
  "css/shared/base.css",
  "css/shared/theme.css",
  "js/config.js",
  "js/site.js",
  "js/chatbot.js"
];
for (const file of unchangedAssets) {
  const from = path.join(root, file);
  if (!fs.existsSync(from)) continue;
  const target = path.join(dist, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(from, target);
}

checkDist(dist);
console.log(`Built ${map.size} assets into dist/`);
