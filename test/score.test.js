// score.js helpers: scoreFromTimings, toggleItems, pauseItem, resolveScore
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreFromTimings, toggleItems, pauseItem, resolveScore, sumPauses } from "../score.js";

test("scoreFromTimings: start-to-next-start in ms, the last word its own length, plus extraMs", () => {
  const timings = [
    { start: 2.5, end: 2.93, word: "low" },
    { start: 3.0, end: 3.63, word: "cloud" },
    { start: 4.73, end: 5.44, word: "nameless" },
  ];
  assert.deepEqual(scoreFromTimings(timings), [
    { id: "low", pause: 500 }, { id: "cloud", pause: 1730 }, { id: "nameless", pause: 710 },
  ]);
  assert.deepEqual(scoreFromTimings(timings, { ids: ["a", "b", "c"], extraMs: 200 }), [
    { id: "a", pause: 700 }, { id: "b", pause: 1930 }, { id: "c", pause: 910 },
  ]);
});

test("scoreFromTimings: mistakes are named", () => {
  assert.throws(() => scoreFromTimings([{ start: 0, end: 1 }], { ids: ["a", "b"] }), /1 timings but 2 ids/);
  assert.throws(() => scoreFromTimings([{ start: 0, end: 1 }]), /no id/);
});

test("toggleItems and pauseItem", () => {
  assert.deepEqual(toggleItems([{ id: "a", pause: 300 }, { id: "b", pause: 50 }]), [{ id: "a", pause: 0 }, { id: "b", pause: 0 }]);
  assert.deepEqual(pauseItem(100), { id: "PAUSE", pause: 100 });
  assert.equal(sumPauses([pauseItem(5), { id: "a", pause: 7 }], 1, 1, { skipPauses: true }), 0); // wraps to the PAUSE
});

test("resolveScore: an array is returned as it is; a name or { generator, args } is generated", () => {
  const arr = [{ id: "a", pause: 1 }];
  assert.equal(resolveScore(arr), arr);
  const seen = [];
  const generators = {
    g: (ctx, ...args) => { seen.push({ ctx, args }); return [{ id: ctx.spels.get("x").string, pause: 2 }]; },
  };
  const context = { spels: new Map([["x", { string: "x" }]]), scoreNum: 4 };
  assert.deepEqual(resolveScore("g", context, generators), [{ id: "x", pause: 2 }]);
  assert.deepEqual(resolveScore({ generator: "g", args: [1, true] }, context, generators), [{ id: "x", pause: 2 }]);
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
