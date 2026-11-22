// scripts/check-notebooks.mjs: finds drift between a scoring notebook and the template.
// Runs the script on copies of the real template (needs acorn, which notebook-kit brings).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const template = join(root, "nbks/scoring-template.html");
let haveAcorn = true;
try { createRequire(root + "x.js")("acorn"); } catch { haveAcorn = false; }

const original = readFileSync(template, "utf8");
const dir = mkdtempSync(join(tmpdir(), "check-notebooks-"));
const check = (name, html) => {
  const file = join(dir, name);
  writeFileSync(file, html);
  const run = spawnSync(process.execPath, [join(root, "scripts/check-notebooks.mjs"), file, "--template", template], { cwd: root, encoding: "utf8" });
  return { status: run.status, out: run.stdout + run.stderr };
};
const change = (html, from, to) => {
  assert.equal(html.split(from).length - 1, 1, `the template has exactly one: ${from}`);
  return html.replace(from, to);
};

test("check-notebooks: a copy of the template has no drift", { skip: !haveAcorn }, () => {
  const { status, out } = check("same.html", original);
  assert.equal(status, 0, out);
  assert.match(out, /0 differ/);
});

test("check-notebooks: a changed machinery cell is reported, by the names it declares", { skip: !haveAcorn }, () => {
  const { status, out } = check("drift.html", change(original, "Math.round(x * 1000) / 1000", "Math.round(x * 100) / 100"));
  assert.equal(status, 1);
  assert.match(out, /DRIFT\s+r3,slugify/);
});

test("check-notebooks: what belongs to a piece is not drift (config values, the export folder's name)", { skip: !haveAcorn }, () => {
  let html = change(original, "clmnRight: 48,", "clmnRight: 50,");
  html = change(html, 'const FOLDER_NAME = "data"', 'const FOLDER_NAME = "my-poem"');
  const { status, out } = check("piece.html", html);
  assert.equal(status, 0, out);
});

test("check-notebooks: a notebook behind the template's version fails; one synced to it passes", { skip: !haveAcorn }, () => {
  const behind = check("behind.html", original.replace("<title>", "<!-- (version 1.0.0) --><title>"));
  assert.equal(behind.status, 1);
  assert.match(behind.out, /BEHIND/);
  const version = original.match(/### Version (\d+\.\d+\.\d+)/)[1];
  const partial = check("partial.html", original.replace("<title>", `<!-- the cells it shares are synced to version ${version} --><title>`));
  assert.equal(partial.status, 0, partial.out);
});
