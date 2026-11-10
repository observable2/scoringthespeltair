#!/usr/bin/env node
// Moves a consuming project to a release of scoringthespeltair. Run it from the PROJECT's root:
//
//   node node_modules/scoringthespeltair/scripts/bump.js v0.5.1            (do it)
//   node node_modules/scoringthespeltair/scripts/bump.js v0.5.1 --dry      (only say what it would do)
//   (the first time, from a project whose installed engine predates this script:
//    node ../scoringthespeltair/scripts/bump.js v0.5.1)
//
// It
//  1. points the dependency in package.json at the tag;
//  2. rewrites package-lock.json: the lockfile is regenerated in a temporary folder
//     (`npm install --package-lock-only`) and copied back, then CHECKED for the new pin. This is done
//     outside the project because npm, run inside a workspace (a project folder under a root whose
//     package.json has "workspaces"), updates package.json but not the project's own lockfile, which
//     is the one GitHub Pages builds from;
//  3. rewrites every jsDelivr URL "scoringthespeltair@<anything>" in nbks/ (.html .js .md .tmpl) to
//     the same tag (a project that loads the engine from the CDN; one that uses npm has none);
//  4. unless the project is in a workspace (or --no-install), runs `npm install` to update node_modules.
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const [tag, ...flags] = process.argv.slice(2);
const dry = flags.includes("--dry");
const noInstall = flags.includes("--no-install");
if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error("usage: node node_modules/scoringthespeltair/scripts/bump.js vX.Y.Z [--dry] [--no-install]");
  process.exit(1);
}
const say = (m) => console.log(dry ? `would: ${m}` : m);
const spec = `github:observable2/scoringthespeltair#${tag}`;

// --- 1. package.json ---
if (!existsSync("package.json")) { console.error("no package.json here: run this from the project's root"); process.exit(1); }
const pkgText = readFileSync("package.json", "utf8");
const pkg = JSON.parse(pkgText);
const section = ["dependencies", "devDependencies"].find((k) => pkg[k]?.scoringthespeltair);
if (!section) { console.error("package.json has no scoringthespeltair dependency"); process.exit(1); }
const indent = (pkgText.match(/^(\s+)"/m) ?? [, "  "])[1];
if (pkg[section].scoringthespeltair === spec) console.log(`package.json already has ${spec}`);
else {
  say(`set ${section}.scoringthespeltair to ${spec} in package.json (was ${pkg[section].scoringthespeltair})`);
  if (!dry) {
    pkg[section].scoringthespeltair = spec;
    writeFileSync("package.json", JSON.stringify(pkg, null, indent) + (pkgText.endsWith("\n") ? "\n" : ""));
  }
}

// --- 2. package-lock.json, regenerated outside any workspace and checked ---
if (!existsSync("package-lock.json")) console.log("no package-lock.json: nothing to refresh (GitHub Pages builds with npm ci, which needs one)");
else {
  say("regenerate package-lock.json in a temporary folder (npm install --package-lock-only) and copy it back");
  if (!dry) {
    const tmp = mkdtempSync(join(tmpdir(), "bump-"));
    // a subfolder with the project's own name: a package.json without a "name" gets the folder's
    // name in the lockfile, which must not change
    const work = join(tmp, basename(resolve(".")));
    mkdirSync(work);
    try {
      copyFileSync("package.json", join(work, "package.json"));
      copyFileSync("package-lock.json", join(work, "package-lock.json"));
      try {
        execSync("npm install --package-lock-only --ignore-scripts", { cwd: work, stdio: "inherit" });
      } catch {
        console.error(`FAILED: npm could not install ${spec}. Is the tag pushed to GitHub (git push --tags), and are you online?`);
        console.error("package.json has already been changed; restore it with git (git checkout package.json) if you stop here.");
        process.exit(1);
      }
      copyFileSync(join(work, "package-lock.json"), "package-lock.json");
    } finally { rmSync(tmp, { recursive: true, force: true }); }
    const entry = JSON.parse(readFileSync("package-lock.json", "utf8")).packages?.["node_modules/scoringthespeltair"];
    const commit = entry?.resolved?.match(/#([0-9a-f]{40})$/)?.[1];
    if (!entry || !commit) { console.error("FAILED: package-lock.json has no pinned commit for scoringthespeltair"); process.exit(1); }
    console.log(`package-lock.json pins scoringthespeltair ${entry.version} at ${commit.slice(0, 7)}`);
    if (entry.version !== tag.slice(1))
      console.warn(`WARNING: the lockfile has version ${entry.version} but you asked for ${tag}: was package.json's version in the engine bumped before tagging?`);
  }
}

// --- 3. jsDelivr URLs ---
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
if (existsSync("nbks")) for (const f of files("nbks")) {
  const before = readFileSync(f, "utf8");
  const after = before.replace(urlPattern, `$1@${tag}`);
  if (after !== before) {
    changed++;
    say(`update the jsDelivr tag in ${f}`);
    if (!dry) writeFileSync(f, after);
  }
}
if (!changed) console.log("no jsDelivr URLs under nbks/ (normal: this project loads the engine from npm, so only the package.json and lockfile pins change)");

// --- 4. node_modules ---
const inWorkspace = (() => {
  for (let d = dirname(resolve(".")); d !== dirname(d); d = dirname(d)) {
    const p = join(d, "package.json");
    if (existsSync(p) && JSON.parse(readFileSync(p, "utf8")).workspaces) return true;
  }
  return false;
})();
if (inWorkspace) console.log("this project is in a workspace: node_modules is the workspace's and uses the local engine; not touched");
else if (noInstall) console.log("--no-install: run `npm install` to update node_modules");
else { say("npm install (updates node_modules)"); if (!dry) execSync("npm install", { stdio: "inherit" }); }

console.log(dry ? "dry run: nothing changed" : "done. Check the piece in `npm run preview` and `npm run build`, then commit package.json, package-lock.json and nbks/.");
