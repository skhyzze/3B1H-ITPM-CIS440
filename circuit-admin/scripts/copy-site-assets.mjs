// Builds circuit-admin/public: the desk pages plus the site files they share,
// so the desk looks like the website without being part of it.
// Run with: npm run assets  (dev and deploy run it first)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const deskDir = path.resolve(here, "..");
const siteDir = path.resolve(deskDir, "..");
const out = path.join(deskDir, "public");

// Files taken from the public site, at the same paths, so the CSS font links still work.
const siteFiles = [
  "css/shared/tokens.css",
  "css/shared/base.css",
  "css/shared/theme.css",
  "css/pages/event.css",
  "fonts/oxanium/oxanium-latin.woff2",
  "fonts/oxanium/Oxanium-Variable.ttf",
  "fonts/space-grotesk/space-grotesk-latin.woff2",
  "fonts/space-grotesk/SpaceGrotesk-Variable.ttf",
  "images_icons/AAI-Logo-Black-Animated-Match.png",
];

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDir(from, to) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(source, target);
    else copy(source, target);
  }
}

fs.rmSync(out, { recursive: true, force: true });
for (const file of siteFiles) copy(path.join(siteDir, file), path.join(out, file));
copyDir(path.join(deskDir, "pages"), out);
console.log(`Copied ${siteFiles.length} site files and the desk pages into circuit-admin/public`);
