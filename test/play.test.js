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
  const scores = [[{ id: "a", duration: 1 }, { id: "b", duration: 1 }], [{ id: "c", duration: 1 }]];
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
    ba: (ctx, first) => { made++; return [{ id: first, duration: 1 }, { id: "b", duration: 1 }, { id: first, duration: 1 }]; },
  };
  const scores = [[{ id: "c", duration: 1 }], { generator: "ba", args: ["a"] }];
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
  assert.equal(gap(2), 20); // last para of the cycle: it ends its field too (the cycle gap follows)
  assert.equal(gap(1, config, { interFieldMs: 7 }), 7); // the score overrides the field gap
  assert.equal(gap(0, config, { interParaMs: 3 }), 3);
  assert.equal(gap(0, config, { interScoreMs: 2 }), 2); // what the score says beats the config's unit gap
  assert.equal(gap(1, { interScoreMs: 5 }), 5); // legacy config: no unit gaps
  assert.equal(scoreGap(0, { config: { ...config, cycleScores: true }, paras, spels }), 5); // a score is not a para
  assert.equal(scoreGap(0, { config, paras, spels: new Map([["a", {}], ["b", {}], ["c", {}]]) }), 10); // no ofld recorded: no fields
  assert.equal(scoreGap(2, { config, paras, spels: new Map([["a", {}], ["b", {}], ["c", {}]]) }), 10); // ... not even at the end
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

// --- fading out: fadeOut / fadeStyle (and the legacy fadeWords 0 wipe), with charFades on ----------
// Plays one cycle of a, b, c, d (a, b, c are in ofld 0, d in ofld 1) and returns the successive sets of
// spels that have a visible character (consecutive repeats dropped). Times are scaled by 0.1.
const fadeStates = async (extra, { settings, scores: scoresIn, paras: parasIn, runMs = 330, during = [] } = {}) => {
  const { play } = await import("../play.js");
  const { splitIntoChars } = await import("../display.js");
  const ids = ["a", "b", "c", "d"];
  const dom = new JSDOM(`<div id="field">${ids.map((id) => `<span id="${id}" class="spel">${id}${id}</span>`).join("")}</div>`);
  globalThis.document = dom.window.document;
  const field = document.getElementById("field");
  splitIntoChars(field);
  const spels = new Map(ids.map((id) => [id, { string: id + id, ofld: id === "d" ? 1 : 0 }]));
  const paras = parasIn ?? ids.map((id) => [id]);
  const scores = scoresIn ?? ids.map((id) => [{ id, duration: 200 }]);
  const states = [];
  states.times = [];
  states.field = field;
  const t0 = Date.now();
  const snap = () => {
    const s = ids.filter((id) => document.getElementById(id).querySelector(".char.visible")).join("");
    if (states[states.length - 1] !== s) { states.push(s); states.times.push(Date.now() - t0); }
  };
  new dom.window.MutationObserver(snap).observe(document.body, { attributes: true, subtree: true, attributeFilter: ["class"] });
  const config = { running: true, PRODUCTION: true, charFades: true, charIntervalMs: 1, durationScale: 0.1, interCycleMs: 50,
    interScoreMs: 0, interParaMs: 0, interFieldMs: 0, clearPauseMs: 0, fieldFadeMs: 1, creditsPauseMs: 0, ...extra };
  if (settings) config.scoreSettings = settings;
  play(config, field, spels, paras, scores);
  for (const [ms, fn] of during) setTimeout(() => fn(config), ms);
  await new Promise((r) => setTimeout(r, runMs));
  config.running = false;
  await new Promise((r) => setTimeout(r, 120)); // let the loop finish (it holds the global document)
  return states;
};

test("play(): fadeOut \"score\" fades each score's spels away; nothing is left showing under the next one", { skip: !JSDOM }, async () => {
  const states = await fadeStates({ fadeOut: "score", fadeWords: 5 });
  assert.deepEqual(states.slice(0, 6), ["a", "", "b", "", "c", ""]);
});

test("play(): fadeOut \"ofld\" keeps an ofld's spels until the score that ends it, then fades them together", { skip: !JSDOM }, async () => {
  const states = await fadeStates({ fadeOut: "ofld" });
  assert.deepEqual(states.slice(0, 6), ["a", "ab", "abc", "", "d", ""]);
});

test("play(): fadeStyle \"sequence\" fades an ofld's spels in the order shown", { skip: !JSDOM }, async () => {
  const states = await fadeStates({ fadeOut: "ofld", fadeStyle: "sequence" });
  assert.deepEqual(states.slice(0, 7), ["a", "ab", "abc", "bc", "c", "", "d"]);
});

test("play(): fadeOut \"scored\" never fades (the scores do), whatever fadeWords is", { skip: !JSDOM }, async () => {
  const states = await fadeStates({ fadeOut: "scored", fadeWords: 5 });
  assert.deepEqual(states.slice(0, 4), ["a", "ab", "abc", "abcd"]);
});

test("play(): a score's settings override fadeOut and fadeStyle", { skip: !JSDOM }, async () => {
  const states = await fadeStates({ fadeOut: "ofld" }, { settings: [{ fadeOut: "score" }] });
  assert.deepEqual(states.slice(0, 4), ["a", "", "b", "bc"]);
});

test("play(): legacy fadeWords 0 (no fadeOut) still wipes the field after each score, and now hides the chars", { skip: !JSDOM }, async () => {
  const states = await fadeStates({ fadeWords: 0 });
  assert.deepEqual(states.slice(0, 4), ["a", "", "b", ""]);
});

test("play(): legacy fadeWords -1 (no fadeOut) fades nothing; fadeWords 1 fades one spel later", { skip: !JSDOM }, async () => {
  assert.deepEqual((await fadeStates({ fadeWords: -1 })).slice(0, 4), ["a", "ab", "abc", "abcd"]);
  const w = await fadeStates({ fadeWords: 1 });
  assert.ok(w.includes("b") || w.includes("ab"), `window fades ran: ${w}`);
});

test("play(): fadeOut \"cycle\" keeps everything until the cycle's last score is over", { skip: !JSDOM }, async () => {
  const states = await fadeStates({ fadeOut: "cycle" });
  assert.deepEqual(states.slice(0, 5), ["a", "ab", "abc", "abcd", ""]);
});

test("play(): fadeOrder reverse fades the last shown first; fadeStaggerMs sets the step of a sequence", { skip: !JSDOM }, async () => {
  const rev = await fadeStates({ fadeOut: "ofld", fadeStyle: "sequence", fadeOrder: "reverse" });
  assert.deepEqual(rev.slice(0, 7), ["a", "ab", "abc", "ab", "a", "", "d"]);
  const span = (st) => st.times[st.indexOf("")] - st.times[st.indexOf("abc")];
  const slow = await fadeStates({ fadeOut: "ofld", fadeStyle: "sequence" }); // each after its item's duration (20 ms)
  const quick = await fadeStates({ fadeOut: "ofld", fadeStyle: "sequence", fadeStaggerMs: 0 });
  assert.ok(span(slow) >= 50, `durations: ${span(slow)} ms`);
  assert.ok(span(quick) < 40, `stagger 0: ${span(quick)} ms`);
});

test("play(): revealStyle together shows a score's spels at once, and fades them at its end", { skip: !JSDOM }, async () => {
  const scores = [[{ id: "a", duration: 200 }, { id: "b", duration: 200 }], [{ id: "c", duration: 200 }], [{ id: "d", duration: 200 }]];
  const states = await fadeStates({ fadeOut: "score", revealStyle: "together" }, { scores, paras: [["a", "b"], ["c"], ["d"]] });
  assert.deepEqual(states.slice(0, 5), ["ab", "", "c", "", "d"]);
});

test("play(): holdMs keeps the whole unit showing at least that long from its last spel", { skip: !JSDOM }, async () => {
  const shown = (st) => st.times[st.indexOf("")] - st.times[st.indexOf("a")];
  const plain = await fadeStates({ fadeOut: "score" }, { runMs: 400 });
  const held = await fadeStates({ fadeOut: "score", holdMs: 1500 }, { runMs: 400 }); // 150 ms scaled
  assert.ok(shown(held) >= 140, `held ${shown(held)} ms`);
  assert.ok(shown(plain) < 80, `plain ${shown(plain)} ms`);
});

test("play(): overlapMs starts the next score while the fade goes on", { skip: !JSDOM }, async () => {
  const mixed = (st) => st.some((x) => /d/.test(x) && /[abc]/.test(x));
  assert.ok(!mixed(await fadeStates({ fadeOut: "ofld", fadeStyle: "sequence" })), "no overlap by default");
  assert.ok(mixed(await fadeStates({ fadeOut: "ofld", fadeStyle: "sequence", overlapMs: 0 })), "overlapMs 0");
});

test("play(): a score's fadeMs / fadeInMs / fadeOutMs set the field's --fade-in / --fade-out for it (and the old names work)", { skip: !JSDOM }, async () => {
  const all = (o) => ["a", "b", "c", "d"].map(() => o);
  const a = await fadeStates({ fadeOut: "score" }, { settings: all({ fadeMs: 7, fadeOutMs: 9 }) });
  assert.equal(a.field.style.getPropertyValue("--fade-in"), "7ms");
  assert.equal(a.field.style.getPropertyValue("--fade-out"), "9ms");
  assert.equal(a.field.style.getPropertyValue("--char-fade"), "7ms", "the former variables follow the fade-in");
  const old = await fadeStates({ fadeOut: "score" }, { settings: all({ charFadeMs: 11 }) }); // charFades is on here
  assert.equal(old.field.style.getPropertyValue("--fade-in"), "11ms");
  assert.equal(old.field.style.getPropertyValue("--fade-out"), "11ms");
  const b = await fadeStates({ fadeOut: "score" }, { settings: [{ fadeMs: 7 }], runMs: 150 }); // later scores have none
  assert.equal(b.field.style.getPropertyValue("--fade-in"), "");
  assert.equal(b.field.style.getPropertyValue("--fade-out"), "");
});

test("play(): config.paused holds the piece; config.skip ends the score at once; bindKeys sets them from the keyboard", { skip: !JSDOM }, async () => {
  const { bindKeys } = await import("../controls.js");
  let handler; const target = { addEventListener: (_, h) => { handler = h; }, removeEventListener: () => {} };
  const probe = {};
  bindKeys(probe, {}, target);
  assert.deepEqual([probe.paused, probe.skip], [false, false]);
  handler({ key: " " });
  assert.equal(probe.paused, true);
  handler({ key: " " });
  assert.equal(probe.paused, false);
  handler({ key: "ArrowRight" });
  assert.equal(probe.skip, true);
  // held: nothing shows while paused, and it plays on when resumed
  const held = await fadeStates({ fadeOut: "score", paused: true, skip: false }, { runMs: 120, during: [[80, (c) => { c.paused = false; }]] });
  assert.ok(held.times[0] >= 70, `first spel at ${held.times[0]} ms`);
  // skipped: scores of 2 s (200 ms scaled) go by at once when asked
  const long = ["a", "b", "c", "d"].map((id) => [{ id, duration: 2000 }]);
  const skipped = await fadeStates({ fadeOut: "score", paused: false, skip: false }, { scores: long, runMs: 200, during: [[90, (c) => { c.skip = true; }]] });
  assert.ok(skipped.some((x) => x === "b"), `skipped to b: ${skipped}`);
});

test("play(): a score's own clearPauseMs is the dark time after its unit fades", { skip: !JSDOM }, async () => {
  const dark = (st, from) => st.times[st.indexOf("", from) + 1] - st.times[st.indexOf("", from)]; // "" to the next spel
  const states = await fadeStates({ fadeOut: "score" }, { settings: [{ clearPauseMs: 1500 }], runMs: 500 }); // 150 ms scaled, for score 0
  assert.deepEqual(states.slice(0, 4), ["a", "", "b", ""]);
  assert.ok(dark(states, 0) >= 140, `score 0: ${dark(states, 0)} ms`);
  // the other scores use the config's clearPauseMs (0 here)
  const second = states.times[states.indexOf("", 2) + 1] - states.times[states.indexOf("", 2)];
  assert.ok(second < 60, `score 1: ${second} ms`);
});
