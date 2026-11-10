#!/usr/bin/env node
// Moves a consuming project to a release of scoringthespeltair. Run it from the PROJECT's root:
//
//   node node_modules/scoringthespeltair/scripts/bump.js v0.5.1          (do it)
//   node node_modules/scoringthespeltair/scripts/bump.js v0.5.1 --dry    (only say what it would do)
//
// It (1) points the dependency at the tag and refreshes package-lock.json (npm install), and
// (2) rewrites every jsDelivr URL "scoringthespeltair@<anything>" in nbks/ (.html .js .md) to the
// same tag, so notebooks and players that load the engine from the CDN move too.
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const [tag, ...flags] = process.argv.slice(2);
const dry = flags.includes("--dry");
if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error("usage: node node_modules/scoringthespeltair/scripts/bump.js vX.Y.Z [--dry]");
  process.exit(1);
}

const urlPattern = /(cdn\.jsdelivr\.net\/gh\/observable2\/scoringthespeltair)@[\w.\-]+/g;
function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(html|js|md|tmpl)$/.test(name)) yield p;
  }
}

let changed = 0;
for (const f of files("nbks")) {
  const before = readFileSync(f, "utf8");
  const after = before.replace(urlPattern, `$1@${tag}`);
  if (after !== before) {
    changed++;
    console.log(`${dry ? "would update" : "updated"} ${f}`);
    if (!dry) writeFileSync(f, after);
  }
}
if (!changed) console.log("no jsDelivr URLs to update under nbks/");

const cmd = `npm install github:observable2/scoringthespeltair#${tag}`;
console.log(dry ? `would run: ${cmd}` : `running: ${cmd}`);
if (!dry) execSync(cmd, { stdio: "inherit" });
console.log(dry ? "dry run: nothing changed" : `done. Check the piece in preview, then commit package.json, package-lock.json and nbks/.`);
