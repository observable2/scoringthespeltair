// score.js helpers: scoreFromTimings, toggleItems, pauseItem, resolveScore
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreFromTimings, toggleItems, pauseItem, resolveScore, sumDurations, sumPauses, durationOf, readingTimes } from "../score.js";

test("scoreFromTimings: start-to-next-start in ms, the last word its own length, plus extraMs", () => {
  const timings = [
    { start: 2.5, end: 2.93, word: "low" },
    { start: 3.0, end: 3.63, word: "cloud" },
    { start: 4.73, end: 5.44, word: "nameless" },
  ];
  assert.deepEqual(scoreFromTimings(timings), [
    { id: "low", duration: 500 }, { id: "cloud", duration: 1730 }, { id: "nameless", duration: 710 },
  ]);
  assert.deepEqual(scoreFromTimings(timings, { ids: ["a", "b", "c"], extraMs: 200 }), [
    { id: "a", duration: 700 }, { id: "b", duration: 1930 }, { id: "c", duration: 910 },
  ]);
});

test("scoreFromTimings: mistakes are named", () => {
  assert.throws(() => scoreFromTimings([{ start: 0, end: 1 }], { ids: ["a", "b"] }), /1 timings but 2 ids/);
  assert.throws(() => scoreFromTimings([{ start: 0, end: 1 }]), /no id/);
});

test("toggleItems and pauseItem", () => {
  assert.deepEqual(toggleItems([{ id: "a", duration: 300 }, { id: "b", duration: 50 }]), [{ id: "a", duration: 0 }, { id: "b", duration: 0 }]);
  assert.deepEqual(pauseItem(100), { id: "PAUSE", duration: 100 });
  assert.equal(sumDurations([pauseItem(5), { id: "a", duration: 7 }], 1, 1, { skipPauses: true }), 0); // wraps to the PAUSE
});

test("resolveScore: an array is returned as it is; a name or { generator, args } is generated", () => {
  const arr = [{ id: "a", duration: 1 }];
  assert.equal(resolveScore(arr), arr);
  const seen = [];
  const generators = {
    g: (ctx, ...args) => { seen.push({ ctx, args }); return [{ id: ctx.spels.get("x").string, duration: 2 }]; },
  };
  const context = { spels: new Map([["x", { string: "x" }]]), scoreNum: 4 };
  assert.deepEqual(resolveScore("g", context, generators), [{ id: "x", duration: 2 }]);
  assert.deepEqual(resolveScore({ generator: "g", args: [1, true] }, context, generators), [{ id: "x", duration: 2 }]);
  assert.deepEqual(seen[0].args, []);
  assert.deepEqual(seen[1].args, [1, true]);
  assert.deepEqual(seen[1].ctx.args, [1, true]);
  assert.equal(seen[1].ctx.scoreNum, 4);
});

test("resolveScore: unknown generators and bad results are named", () => {
  assert.throws(() => resolveScore("nope", { scoreNum: 3 }, {}), /score 3 names the generator "nope"/);
  assert.throws(() => resolveScore(42, { scoreNum: 1 }), /neither an array of items nor a generator name/);
  assert.throws(() => resolveScore("g", {}, { g: () => "not a score" }), /must return an array/);
});

test("readingTimes / fadeDelay: fade-outs run on reading time, not on the line breaks in pauses, at the score's own pace", async () => {
  const { readingTimes, fadeDelay } = await import("../score.js");
  const { spelTime } = await import("../timetoread.js");
  const read = spelTime("aa", "", 1, { whitespace: "respect" });
  const at = (id, topvw) => [id, { string: id + id, para: "p", clmn: "l", ofld: "o", topvw, heightvw: 5 }];
  const spels = new Map([at("a", 0), at("b", 0), at("c", 5), at("d", 5)]); // a b / c d: b ends line 1, d ends the score
  // linear score: b's pause carries a 1000 ms line break
  const linear = [{ id: "a", duration: read }, { id: "b", duration: read + 1000 }, { id: "c", duration: read }, { id: "d", duration: read }];
  assert.deepEqual(readingTimes(linear, spels), [read, read, read, read]);
  assert.equal(fadeDelay(readingTimes(linear, spels), 0, 2), 3 * read);
  // recorded at half the estimated pace: mid-line pauses are used as they are, line ends are scaled
  const slow = [{ id: "a", duration: 2 * read }, { id: "b", duration: 3000 }, { id: "c", duration: 2 * read }, { id: "d", duration: 9999 }];
  assert.deepEqual(readingTimes(slow, spels), [2 * read, 2 * read, 2 * read, 2 * read]);
  const withPause = [linear[0], pauseItem(500), ...linear.slice(1)];
  assert.equal(readingTimes(withPause, spels)[1], 0);
  assert.equal(fadeDelay(readingTimes(linear, spels), 3, 1), 2 * read); // wraps
  assert.deepEqual(readingTimes([{ id: "x", duration: 70 }], spels), [70]); // unknown spel: its pause
});

test("a score item's `pause` (the former name) is read as its duration", () => {
  assert.equal(durationOf({ id: "a", pause: 7 }), 7);
  assert.equal(durationOf({ id: "a", duration: 9 }), 9);
  assert.equal(durationOf({ id: "a", duration: 0, pause: 5 }), 0); // duration wins, even at 0
  assert.equal(sumDurations([{ id: "a", pause: 3 }, { id: "b", duration: 4 }], 0, 2), 7);
  assert.equal(sumPauses, sumDurations);
  const spels = new Map([["a", { string: "a" }]]);
  assert.deepEqual(readingTimes([{ id: "x", pause: 70 }], spels), [70]);
  assert.deepEqual(readingTimes([{ id: "x", duration: 70 }], spels), [70]);
});

test("resolveFade: fadeOut and fadeStyle, the score's first; without fadeOut it is read from fadeWords as before", async () => {
  const { resolveFade, endsOfld } = await import("../score.js");
  assert.deepEqual(resolveFade({ fadeOut: "ofld" }), { out: "ofld", style: "together", legacy: false });
  assert.deepEqual(resolveFade({ fadeOut: "ofld", fadeStyle: "sequence" }, { fadeOut: "score", fadeStyle: "together" }), { out: "score", style: "together", legacy: false });
  assert.deepEqual(resolveFade({ fadeWords: 5 }), { out: "window", style: "together", legacy: true });
  assert.equal(resolveFade({ fadeWords: 0 }).out, "field");
  assert.equal(resolveFade({ fadeWords: -1 }).out, "scored");
  assert.equal(resolveFade({}).out, "window"); // a config with no fadeWords at all fades nothing, as before
  const spels = new Map([["a", { ofld: 0 }], ["b", { ofld: 0 }], ["c", { ofld: 1 }], ["x", {}]]);
  const paras = [["a"], ["b"], ["c"]];
  assert.deepEqual([0, 1, 2].map((n) => endsOfld(n, { paras, spels })), [false, true, true]);
  assert.equal(endsOfld(0, { paras: [["x"], ["x"]], spels }), true, "spels without an ofld: every score ends one");
});

test("fadeOptions: the score's settings first, then the config, then the defaults", async () => {
  const { fadeOptions } = await import("../score.js");
  assert.deepEqual(fadeOptions({}), { order: "shown", staggerMs: undefined, holdMs: 0, overlapMs: undefined, reveal: "sequence" });
  assert.deepEqual(fadeOptions({ fadeOrder: "reverse", holdMs: 100, overlapMs: 0 }, { holdMs: 5, revealStyle: "together", fadeStaggerMs: 30 }),
    { order: "reverse", staggerMs: 30, holdMs: 5, overlapMs: 0, reveal: "together" });
});
