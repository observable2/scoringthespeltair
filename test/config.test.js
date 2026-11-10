// run with: npm test
// The regression guard for configuration. test/fixtures/legacy-configs.json holds what each
// consuming project's config resolved to BEFORE the 0.5.0 clean-up (startingPoint, numParas ...).
// Every project, old names or new, must still play the same: the values play() reads must be equal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createConfig, normalizeConfig, defaultConfig, defaults, measuredWith, checkMeasuredWith, configSchema } from "../config.js";
import { typeCss } from "../typography.js";

const legacy = JSON.parse(readFileSync(new URL("./fixtures/legacy-configs.json", import.meta.url)));
// the values play() reads, by their current names
const playKeys = Object.entries(configSchema).filter(([, d]) => d.scope === "play").map(([k]) => k);
const playValues = (c) => {
  const n = normalizeConfig(c);
  return Object.fromEntries(playKeys.filter((k) => n[k] !== undefined).map((k) => [k, n[k]]));
};

test("defaults come from the schema; the new defaults are the ones we recommend", () => {
  assert.equal(defaults.durationScale, 1);
  assert.equal(defaults.fontWeight, 300);
  assert.equal(defaults.startPara, 0);
  assert.equal(defaults.fontSizeVw, 3);
  assert.equal(Object.isFrozen(defaults), true);
});

test("defaultConfig (legacy) keeps its old values", () => {
  assert.equal(defaultConfig.slower, 1.3);
  assert.equal(defaultConfig.fontWeight, 400);
  assert.equal(defaultConfig.fadeWords, 5);
  assert.equal("startPara" in defaultConfig, false); // would beat a project's own startingPoint
});

test("aliases: startingPoint is startPara; the current name wins if both are given", () => {
  assert.equal(normalizeConfig({ startingPoint: 2 }).startPara, 2);
  assert.equal("startingPoint" in normalizeConfig({ startingPoint: 2 }), false);
  assert.equal(normalizeConfig({ startingPoint: 2, startPara: 1 }).startPara, 1);
  assert.equal(createConfig({ startingPoint: 2 }, { warn() {} }).startPara, 2);
});

test("aliases: slower is durationScale, at the top level and inside scoreSettings", () => {
  const n = normalizeConfig({ slower: 2, scoreSettings: [{ slower: 0.5, effect: "glow" }, {}, { durationScale: 3, slower: 9 }] });
  assert.equal(n.durationScale, 2);
  assert.equal("slower" in n, false);
  assert.deepEqual(n.scoreSettings[0], { durationScale: 0.5, effect: "glow" });
  assert.deepEqual(n.scoreSettings[1], {});
  assert.equal(n.scoreSettings[2].durationScale, 3); // the current name wins
  assert.equal(createConfig({ slower: 1.3 }, { warn() {} }).durationScale, 1.3);
});

test("createConfig warns about unknown, retired and legacy-unit keys, and keeps the project's own", () => {
  const warnings = [];
  const c = createConfig({ numParas: 3, charInterval: 8, charIntervalMS: 80, mine: 1 }, { warn: (m) => warnings.push(m) });
  assert.equal(warnings.length, 3);
  assert.match(warnings.join("\n"), /numParas/);
  assert.match(warnings.join("\n"), /charInterval is ignored/);
  assert.match(warnings.join("\n"), /charIntervalMS/);
  assert.equal(c.mine, 1);
  assert.equal("numParas" in c, false);
});

for (const [name, old] of Object.entries(legacy)) {
  test(`${name}: legacy config plays the same through normalizeConfig`, () => {
    if (typeof old === "string") return; // a config that could not be loaded when captured
    const { startingPoint, slower, scoreSettings, ...rest } = old;
    const n = normalizeConfig(old);
    assert.equal(n.startPara, startingPoint);
    if (slower !== undefined) assert.equal(n.durationScale, slower);
    if (scoreSettings) assert.deepEqual(n.scoreSettings.map((e) => e.durationScale), scoreSettings.map((e) => e.slower));
    for (const k of playKeys) if (k in rest) assert.deepEqual(n[k], rest[k], k);
  });
}

// the projects' configs as they are now (skipped if the sibling folders are absent, e.g. a fresh clone)
const projects = { reading: "reading/nbks/data/config.js", reunion: "reunion/nbks/data/config.js",
  "shi/treading-void": "shi/nbks/data/treading-void/config.js", "shi/river-snow": "shi/nbks/data/river-snow/config.js",
  "shi/maple-bridge": "shi/nbks/data/maple-bridge/config.js", player: "nbks/data/config.js" };
for (const [name, rel] of Object.entries(projects)) {
  const url = new URL(`../../${rel}`, import.meta.url);
  test(`${name}: the config as it is now plays the same as before`, async (t) => {
    if (!existsSync(url)) return t.skip("project folder not present");
    const { config } = await import(url.href);
    const old = legacy[name];
    // every value the project had before is unchanged; the legacy defaultConfig now also lists two keys the
    // engine always read (cycleScores, PRODUCTION), at the values that mean "as before"
    const now = playValues(config), before = playValues(old);
    const extra = Object.keys(now).filter((k) => !(k in before));
    assert.deepEqual(Object.fromEntries(Object.entries(now).filter(([k]) => k in before)), before, "play settings");
    assert.deepEqual(extra.filter((k) => now[k] !== false || !["cycleScores", "PRODUCTION"].includes(k)), [], "new keys, other than cycleScores/PRODUCTION false");
    assert.equal(config.fontWeight, old.fontWeight, "fontWeight");
  });
}

test("measuredWith and checkMeasuredWith", () => {
  const m = measuredWith({ fontWeight: 300 });
  assert.equal(m.fontSizeVw, 3);
  assert.deepEqual(checkMeasuredWith(m, { fontWeight: 300 }), []);
  assert.equal(checkMeasuredWith(m, { fontWeight: 400 }).length, 1);
  assert.deepEqual(checkMeasuredWith({ ...m, clmnRight: 48 }, { fontWeight: 300 }), []); // not checked
});

test("typeCss", () => {
  const css = typeCss({ fontWeight: 300 }, "#field");
  assert.match(css, /#field \{/);
  assert.match(css, /font-size: 3vw;/);
  assert.match(css, /font-weight: 300;/);
  assert.match(css, /"opsz" 14/);
  assert.match(css, /--spel-fade: 1500ms/);
  assert.doesNotMatch(typeCss({ opsz: null }), /opsz/);
});
