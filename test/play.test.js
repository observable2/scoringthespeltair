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

test("play(): a score may name a generator (options.generators), made anew each time it comes round", { skip: !JSDOM }, async () => {
  const { play } = await import("../play.js");
  const { field, spels, paras } = setup();
  const seen = record();
  let made = 0;
  const generators = {
    ba: (ctx, first) => { made++; return [{ id: first, pause: 1 }, { id: "b", pause: 1 }, { id: first, pause: 1 }]; },
  };
  const scores = [[{ id: "c", pause: 1 }], { generator: "ba", args: ["a"] }];
  const config = { ...base, cycleScores: true };
  play(config, field, spels, paras, scores, { generators });
  await new Promise((r) => setTimeout(r, 150));
  config.running = false;
  assert.deepEqual(seen.slice(0, 5), ["c", "a", "b", "a", "c"]);
  assert.ok(made >= 1, "the generator was called");
});

test("scoreGap: the unit a score ends has its own gap; the score's settings come first; legacy configs keep interScoreMs", async () => {
  const { scoreGap, cycleGap } = await import("../score.js");
  const spels = new Map([["a", { ofld: "f1" }], ["b", { ofld: "f1" }], ["c", { ofld: "f2" }]]);
  const paras = [["a"], ["b"], ["c"]]; // a, b end paras within f1; b also ends f1; c is last
  const config = { interScoreMs: 5, interParaMs: 10, interFieldMs: 20, interCycleMs: 40 };
  const gap = (n, c = config, settings) => scoreGap(n, { config: c, settings, paras, spels });
  assert.equal(gap(0), 10); // ends a para
  assert.equal(gap(1), 20); // ends a para and a field: the field outranks
  assert.equal(gap(2), 10); // last para of the cycle: no field boundary (the cycle gap follows)
  assert.equal(gap(1, config, { interFieldMs: 7 }), 7); // the score overrides the field gap
  assert.equal(gap(0, config, { interParaMs: 3 }), 3);
  assert.equal(gap(0, config, { interScoreMs: 2 }), 2); // what the score says beats the config's unit gap
  assert.equal(gap(1, { interScoreMs: 5 }), 5); // legacy config: no unit gaps
  assert.equal(scoreGap(0, { config: { ...config, cycleScores: true }, paras, spels }), 5); // a score is not a para
  assert.equal(scoreGap(0, { config, paras, spels: new Map([["a", {}], ["b", {}], ["c", {}]]) }), 10); // no ofld recorded: no fields
  assert.equal(cycleGap({ config }), 40);
  assert.equal(cycleGap({ config, settings: { interCycleMs: 1 } }), 1);
});

test("centerField(): publishes the extent's left, width, top and height in vw", { skip: !JSDOM }, async () => {
  const { centerField } = await import("../center.js");
  const dom = new JSDOM(`<div id="field"><span class="spel" id="a"></span><span class="spel" id="b"></span></div>`);
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  Object.defineProperty(dom.window, "innerWidth", { value: 1000 }); // 1vw = 10px
  const rect = (left, top, right, bottom) => ({ left, top, right, bottom, width: right - left });
  const d = dom.window.document;
  d.getElementById("field").getBoundingClientRect = () => rect(100, 200, 100, 200);
  d.getElementById("a").getBoundingClientRect = () => rect(110, 210, 210, 264); // x 10..110, y 10..64
  d.getElementById("b").getBoundingClientRect = () => rect(100, 200, 160, 254); // x 0..60,  y 0..54
  centerField(d.getElementById("field"));
  const st = d.getElementById("field").style;
  assert.equal(st.getPropertyValue("--extent-x"), "0vw");
  assert.equal(st.getPropertyValue("--extent-w"), "11vw");
  assert.equal(st.getPropertyValue("--extent-y"), "0vw");
  assert.equal(st.getPropertyValue("--extent-h"), "6.4vw");
});
