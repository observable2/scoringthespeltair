#!/usr/bin/env node
// Checks that scoring notebooks (scoring-<name>.html) still carry the
// template's code. New affordances are built in a piece's notebook, then
// added to nbks/scoring-template.html and to every scoring-*.html: this
// finds the cells where a notebook has drifted from the template.
//
//   node scripts/check-notebooks.mjs [notebook.html ...] [options]
//
// With no notebook it checks nbks/scoring-*.html of the folder it is run
// in. Run it from a project, with the script of the engine next to it:
//   node ../scoringthespeltair/scripts/check-notebooks.mjs
//
//   --template <file|url>  the template (default: nbks/scoring-template.html
//                          of the engine this script is in)
//   --tag vX.Y.Z           the template of that release, from jsDelivr
//
// Cells are matched by the names they declare (a notebook saved by
// Observable Desktop has its cell ids renumbered). Only the code of
// module cells is compared: comments, whitespace and display(...) calls
// are ignored, and so is what belongs to a piece (the cell with
// createConfig, the export folder's name). It also compares the version
// stamps: the template's "### Version x.y.z" with the notebook's "(version
// x.y.z)" (see TEMPLATE-CHANGELOG.md). A partial copy, which shares only some
// cells, says so: "(version 1.0.0; the cells it shares ... are synced to
// version 1.2.0)", or "synced to 1.2.0": that one is the version compared.
// Exit status 1 if any shared cell differs or a notebook is behind. Needs acorn (notebook-kit
// brings it): run it where the project's node_modules is.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const [, value] = args.splice(i, 2);
  return value;
};
const templateArg = opt("--template");
const tag = opt("--tag");

const loadAcorn = () => {
  for (const base of [process.cwd() + "/", here + "/", path.join(here, "..", "..") + "/"]) {
    try { return createRequire(base + "x.js")("acorn"); } catch { /* try the next place */ }
  }
  console.error("check-notebooks: acorn not found. Run it in a project that has notebook-kit installed (npm install).");
  process.exit(2);
};
const acorn = loadAcorn();

// --- reading a notebook ----------------------------------------------------------------------------
const readText = async (where) => {
  if (/^https?:\/\//.test(where)) {
    const response = await fetch(where);
    if (!response.ok) throw new Error(`${where}: HTTP ${response.status}`);
    return response.text();
  }
  return fs.readFileSync(where, "utf8");
};
const cellsOf = (html) => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
  .map((m) => ({ type: (m[1].match(/type="([^"]*)"/) ?? [, "module"])[1], body: m[2] }))
  .filter((c) => /module|javascript/.test(c.type));

// code without what does not count: display(md`...`) headings, display(...) calls
const clean = (body) => body
  .replace(/^\s*display\(md`(?:\\.|[^`\\])*`\)\s*$/gm, "")
  .replace(/^\s*display\(.*\)\s*$/gm, "");

// the tokens of a cell's code (comments are not tokens), with the piece's own strings masked
const tokensOf = (body) => {
  let list;
  try {
    list = [...acorn.tokenizer(clean(body), { ecmaVersion: "latest", sourceType: "module", allowAwaitOutsideFunction: true })];
  } catch {
    return null;
  }
  const out = [];
  list.forEach((t, i) => {
    let value = t.value ?? "";
    const text = typeof value === "string" ? value : "";
    const afterFolderName = list[i - 1]?.type.label === "=" && list[i - 2]?.value === "FOLDER_NAME";
    if ((t.type.label === "string" || t.type.label === "template") && (afterFolderName || /nbks\/data|this (piece|poem)'s/.test(text))) value = "<piece>";
    out.push(`${t.type.label}:${value}`);
  });
  return out;
};

// the names a cell declares at its top level: the key that matches it in another notebook
const keyOf = (body) => {
  const code = clean(body);
  const names = [...code.matchAll(/^ {4}(?:const|let|var|function|async function)\s+(\{[^}]*\}|\w+)/gm)].map((m) => m[1].replace(/\s+/g, ""));
  return names.length ? names.join(",") : "(" + code.trim().slice(0, 40).replace(/\s+/g, " ") + ")";
};
const isPieceCell = (body) => body.includes("const config = createConfig(");

const indexCells = (html) => new Map(cellsOf(html).map((c) => [keyOf(c.body), c]));
const versionOf = (html, pattern) => (html.match(pattern) ?? [])[1] ?? null;
const compareVersions = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
};

// --- main ------------------------------------------------------------------------------------------
const templateWhere = templateArg
  ?? (tag ? `https://cdn.jsdelivr.net/gh/observable2/scoringthespeltair@${tag}/nbks/scoring-template.html`
    : path.join(here, "..", "nbks", "scoring-template.html"));
const templateHtml = await readText(templateWhere);
const templateVersion = versionOf(templateHtml, /### Version (\d+\.\d+\.\d+)/);
const template = indexCells(templateHtml);

let notebooks = args.filter((a) => !a.startsWith("--"));
if (!notebooks.length) {
  const dir = path.join(process.cwd(), "nbks");
  if (fs.existsSync(dir)) notebooks = fs.readdirSync(dir).filter((f) => /^scoring-.*\.html$/.test(f) && f !== "scoring-template.html").map((f) => path.join("nbks", f));
}
if (!notebooks.length) {
  console.log("check-notebooks: no notebook to check (name one, or run in a folder with nbks/scoring-<name>.html).");
  process.exit(0);
}

console.log(`Template ${templateWhere}${templateVersion ? ` (version ${templateVersion})` : ""}`);
let failed = false;
// the changelog's newest entry must be the template's version: they are bumped together
if (!/^https?:/.test(templateWhere)) {
  const log = path.join(path.dirname(templateWhere), "..", "TEMPLATE-CHANGELOG.md");
  if (fs.existsSync(log)) {
    const newest = (fs.readFileSync(log, "utf8").match(/^## (\d+\.\d+\.\d+)/m) ?? [])[1];
    if (newest !== templateVersion) {
      console.log(`CHANGELOG  TEMPLATE-CHANGELOG.md's newest entry is ${newest ?? "missing"}, the template says ${templateVersion}: bump both together.`);
      failed = true;
    }
  }
}
for (const file of notebooks) {
  const html = fs.readFileSync(file, "utf8");
  const mine = indexCells(html);
  const version = versionOf(html, /synced to\s+version (\d+\.\d+\.\d+)/) ?? versionOf(html, /synced to (\d+\.\d+\.\d+)/)
    ?? versionOf(html, /\(version (\d+\.\d+\.\d+)/);
  const differ = [], missing = [];
  let compared = 0;
  for (const [key, cell] of template) {
    if (isPieceCell(cell.body)) continue;
    if (!mine.has(key)) { missing.push(key); continue; }
    compared++;
    const [a, b] = [tokensOf(cell.body), tokensOf(mine.get(key).body)];
    if (!a || !b || a.join(" ") !== b.join(" ")) {
      let i = 0;
      while (a && b && i < a.length && a[i] === b[i]) i++;
      const show = (tokens) => (tokens ? tokens.slice(Math.max(0, i - 1), i + 5).join(" ").slice(0, 90) : "(does not parse)");
      differ.push({ key, template: show(a), notebook: show(b) });
    }
  }
  const behind = version && templateVersion && compareVersions(version, templateVersion) < 0;
  const unstamped = !version && templateVersion;
  console.log(`\n${file}: ${version ? `at template version ${version}` : "no version stamp"}${behind ? ` (BEHIND: the template is ${templateVersion}; see TEMPLATE-CHANGELOG.md)` : ""}`);
  console.log(`  ${compared} shared cells compared, ${differ.length} differ`);
  for (const d of differ) console.log(`  DRIFT  ${d.key.slice(0, 70)}\n         template: ${d.template}\n         notebook: ${d.notebook}`);
  if (missing.length) console.log(`  not in this notebook (a partial copy?): ${missing.length} template cell(s), e.g. ${missing.slice(0, 3).map((k) => k.slice(0, 40)).join(" | ")}`);
  if (differ.length || behind) failed = true;
  if (unstamped) console.log("  (no \"(version x.y.z)\" stamp in its header: cannot tell how old it is)");
}
console.log(failed ? "\nDrift found: backport the difference, one way or the other (TEMPLATE-CHANGELOG.md)." : "\nNo drift.");
process.exit(failed ? 1 : 0);
