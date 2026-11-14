import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function checkDist(dist) {
  const errors = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(html|css|js)$/.test(entry.name)) continue;
      const text = fs.readFileSync(full, "utf8");
      if (text.includes("@include")) {
        errors.push(`${path.relative(dist, full)} still has an include marker`);
      }
    }
  }

  walk(dist);

  for (const name of fs.readdirSync(dist)) {
    if (!name.endsWith(".html")) continue;
    const text = fs.readFileSync(path.join(dist, name), "utf8");
    if (!text.includes('<header class="lab-header')) errors.push(`${name} is missing the header`);
    if (!text.includes('<footer class="lab-site-footer')) errors.push(`${name} is missing the footer`);
    const nav = text.match(/<div class="lab-nav-links">([\s\S]*?)<\/div>/);
    const links = nav ? (nav[1].match(/<a\b/g) || []).length : 0;
    if (links < 6) errors.push(`${name} has ${links} links in .lab-nav-links`);
  }

  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    checkDist(path.join(process.cwd(), "dist"));
    console.log("Header and footer includes resolved in dist/");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
