// play() smoke test: runs the real loop on a tiny fake document (jsdom, if available) with 1 ms
// pauses, with the legacy key name startingPoint and the current startPara, and with fadeWords 0.
import { test } from "node:test";
import assert from "node:assert/strict";

let JSDOM;
try { ({ JSDOM } = await import("jsdom")); } catch { /* jsdom is a notebook-kit dependency; skip without it */ }

const setup = () => {
  const dom = new JSDOM(`<div id="field"><span id="a" class="spel">a</span><span id="b" class="spel">b</span><span id="c" class="spel">c</span></div>`);
  globalThis.document = dom.window.document;
  const spels = new Map(["a", "b", "c"].map((id) => [id, { string: id }]));
  const paras = [["a", "b"], ["c"]];
  const scores = [[{ id: "a", pause: 1 }, { id: "b", pause: 1 }], [{ id: "c", pause: 1 }]];
  return { field: dom.window.document.getElementById("field"), spels, paras, scores };
};
const base = { running: true, PRODUCTION: true, charFades: false, fadeWords: -1, durationScale: 1, interCycleMs: 1, interScoreMs: 1, creditsPauseMs: 0 };

// records the ids that become visible, in order
const record = () => {
  const seen = [];
  new globalThis.document.defaultView.MutationObserver((ms) => ms.forEach((m) => {
    if (m.target.classList.contains("visible")) seen.push(m.target.id);
  })).observe(globalThis.document.body, { attributes: true, subtree: true, attributeFilter: ["class"] });
  return seen;
};

// NB: with cycleScores off, scoreNum starts at 0 whatever the start paragraph (the TODO in play.js:
// "allow multiple scores per para"); startPara only chooses which paragraph's spels fadeWords 0 clears.
const run = async (extra) => {
  const { play } = await import("../play.js");
  const { field, spels, paras, scores } = setup();
  const seen = record();
  const config = { ...base, ...extra };
  play(config, field, spels, paras, scores);
  await new Promise((r) => setTimeout(r, 120));
  config.running = false; // live: play() reads the caller's object
  const n = seen.length;
  await new Promise((r) => setTimeout(r, 40));
  return { seen: seen.slice(0, 6), stoppedAt: n, after: seen.length };
};

test("play(): startPara and the legacy startingPoint behave identically; running = false stops it", { skip: !JSDOM }, async () => {
  const a = await run({ startPara: 1 });
  const b = await run({ startingPoint: 1 });
  assert.ok(a.seen.length >= 3, "it played");
  assert.deepEqual(a.seen, b.seen);
  assert.ok(a.after - a.stoppedAt <= 3, "stopped within a spel or two");
});

test("play(): a config with neither start key starts at 0 (no NaN)", { skip: !JSDOM }, async () => {
  const r = await run({});
  assert.deepEqual(r.seen.slice(0, 3), ["a", "b", "c"]);
});

test("mount(): puts the spels in the field, splits them into chars, warns on a measured mismatch", { skip: !JSDOM }, async () => {
  const { mount } = await import("../mount.js");
  const dom = new JSDOM(`<div id="field"></div>`);
  globalThis.document = dom.window.document;
  const field = dom.window.document.getElementById("field");
  const spels = new Map([["ab", { html: `<span id="ab" class="spel">ab</span>` }]]);
  const warnings = [];
  const warn = console.warn; console.warn = (m) => warnings.push(m);
  try {
    mount({ charFades: true, fontWeight: 400 }, field, { spels, measuredWith: { fontWeight: 300 }, center: false });
  } finally { console.warn = warn; }
  assert.equal(field.querySelectorAll(".char").length, 2);
  assert.match(warnings.join(), /fontWeight: the spels were measured at 300, this page uses 400/);
});

test("play(): durationScale (and its old name slower) scales the time", { skip: !JSDOM }, async () => {
  const count = async (extra) => { const r = await run({ interScoreMs: 1, interCycleMs: 1, ...extra }); return r.stoppedAt; };
  const normal = await count({ durationScale: 1 });
  const slow = await count({ durationScale: 40 }); // every pause (1 ms) becomes 40 ms
  const oldName = await count({ durationScale: undefined, slower: 40 });
  assert.ok(slow < normal / 3, `slow ${slow} vs normal ${normal}`);
  assert.ok(Math.abs(oldName - slow) <= 2, `old name ${oldName} vs ${slow}`);
});
