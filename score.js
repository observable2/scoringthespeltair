import { mod } from "./math.js";
import { spelTime } from "./timetoread.js";

// sums the pauses of the n score items following idx (wrapping around the score);
// with skipPauses, "PAUSE" items contribute nothing
function sumPauses(score, idx, n, { skipPauses = false } = {}) {
  let total = 0;
  for (let i = 0; i < n; ++i) {
    const item = score[mod(idx + i + 1, score.length)];
    if (!(skipPauses && item.id === "PAUSE")) total += item.pause;
  }
  return total;
}

// Reading times for fading out: for each item of a score, how long it takes to read, WITHOUT the
// end-of-unit time a score pause may carry (the whitespace after a line's last spel: a line break ...).
// Those pauses belong before the next unit is faded IN, not to when words fade OUT.
//  - A spel in the middle of a line (the next item is a spel on the same line, by `topvw`, para,
//    clmn and ofld) has no such whitespace: its pause IS its reading time, as scored or recorded.
//  - A spel that ends a line (or the score, or has no recorded position) is estimated (`spelTime` of
//    its string, no gap) and scaled by this score's pace: the sum of its mid-line pauses over the sum
//    of their estimates. A linear score (pauses from spelTime) has pace 1; a score timed from a
//    recording has the pace of that recording.
//  - "PAUSE" and "AUTOFADE" items are not spels and read in 0. A spel not in `spels` reads in its pause.
const fadeReadOptions = { whitespace: "respect" };
function readingTimes(score, spels) {
  const isSpel = (item) => item.id !== "PAUSE" && item.id !== "AUTOFADE";
  const info = (item) => (isSpel(item) ? spels?.get(item.id) : undefined);
  const estimate = (spel) => spelTime(spel.string, "", 1, fadeReadOptions);
  const sameLine = (a, b) => a && b && a.topvw !== undefined && b.topvw !== undefined
    && a.para === b.para && a.clmn === b.clmn && a.ofld === b.ofld
    && Math.abs(a.topvw - b.topvw) < 0.5 * (a.heightvw ?? 1);
  let recorded = 0, estimated = 0;
  const midLine = score.map((item, i) => {
    const here = info(item);
    const next = score[i + 1];
    const mid = here?.string !== undefined && item.pause > 0 && next && isSpel(next) && sameLine(here, info(next));
    if (mid) { recorded += item.pause; estimated += estimate(here); }
    return mid;
  });
  const pace = estimated > 0 ? recorded / estimated : 1;
  return score.map((item, i) => {
    if (!isSpel(item)) return 0;
    const here = info(item);
    if (here?.string === undefined) return item.pause;
    return midLine[i] ? item.pause : Math.round(estimate(here) * pace);
  });
}

// How long after a spel appears it fades out, when it fades n spels later (ms, before durationScale):
// the reading times (see readingTimes) of the spel and the n after it, wrapping around the score.
const fadeDelay = (times, idx, n) => {
  let total = times[idx];
  for (let i = 0; i < n; ++i) total += times[mod(idx + i + 1, times.length)];
  return total;
};

// A score item that shows nothing and waits `ms`: { id: "PAUSE", pause: ms }. A whole score may be
// one such item (a breath between two scores).
const pauseItem = (ms) => ({ id: "PAUSE", pause: ms });

// The same spels again, each with no pause. Played after (or as) a score, they toggle every one of
// those spels at once: the way to fade what a score has shown, or to show a whole verse in one go.
// `items` are score items; only their ids are used.
const toggleItems = (items) => items.map(({ id }) => ({ id, pause: 0 }));

// A score from recorded timings: one item per spel, its pause the time from the start of that word
// to the start of the next (the last word: its own length), plus `extraMs` to every pause.
//   timings  [{ start, end, word? }, ...] in SECONDS, as a forced aligner or a hand-timed reading
//            gives them; the conversion to milliseconds is made here, at the boundary
//   ids      the spel ids, in the same order (without them each timing's `word` is the id)
//   extraMs  added to every pause (default 0): a reader who is slower than the recording
// (This is what `alignedSpels` did in the Framework notebooks, and what reading's timings are.)
function scoreFromTimings(timings, { ids, extraMs = 0 } = {}) {
  if (ids && ids.length !== timings.length)
    throw new Error(`scoringthespeltair: scoreFromTimings has ${timings.length} timings but ${ids.length} ids`);
  return timings.map((t, i) => {
    const id = ids ? ids[i] : t.word;
    if (id === undefined) throw new Error(`scoringthespeltair: scoreFromTimings: timing ${i} has no id (give ids, or a word in each timing)`);
    const next = timings[i + 1];
    const seconds = next ? next.start - t.start : t.end - t.start;
    return { id, pause: Math.round(seconds * 1000) + extraMs };
  });
}

// A score of scores.json is an array of { id, pause } items. It may instead NAME a generator, so that
// a piece can make a new, quasi-random score each time it comes round (a score is JSON; code is not):
//   "name"                          the generator called `name`
//   { generator: "name", args: [] } the same, with arguments
// `generators` is the page's own { name: function } (play's `options.generators`). A generator is
// called as generator(context, ...args), with context { spels, paras, scores, config, scoreNum, args },
// and returns a score (an array of items). An array is returned as it is.
function resolveScore(entry, context = {}, generators = {}) {
  if (Array.isArray(entry)) return entry;
  const isName = typeof entry === "string";
  const name = isName ? entry : entry?.generator;
  const args = isName ? [] : entry?.args ?? [];
  if (typeof name !== "string")
    throw new Error(`scoringthespeltair: score ${context.scoreNum ?? "?"} is neither an array of items nor a generator name`);
  const generate = generators[name];
  if (typeof generate !== "function")
    throw new Error(`scoringthespeltair: score ${context.scoreNum ?? "?"} names the generator "${name}", which play() was not given (options.generators)`);
  const score = generate({ ...context, args }, ...args);
  if (!Array.isArray(score))
    throw new Error(`scoringthespeltair: the generator "${name}" must return an array of score items`);
  return score;
}

// The gap after a score, in ms (before durationScale). A score that ends a unit with its own gap
// uses that gap in place of interScoreMs: the end of a field (interFieldMs) outranks the end of a
// paragraph (interParaMs). The score's own settings come first, then the config:
//   settings.interFieldMs ?? settings.interScoreMs ?? config.interFieldMs ?? config.interScoreMs
// (a config without interFieldMs/interParaMs, such as a legacy one, therefore gives interScoreMs as always).
// With cycleScores a score is not a paragraph, so no unit ends (only the cycle's end, see cycleGap).
// A score ends a field if the next paragraph's first spel is in another ofld; spels without an
// `ofld` (data from before it was recorded) never end one.
function scoreGap(sNum, { config, settings = {}, paras, spels }) {
  if (config.cycleScores || !paras?.[sNum]) return settings.interScoreMs ?? config.interScoreMs;
  const ofldOf = (para) => spels?.get(para?.[0])?.ofld;
  const here = ofldOf(paras[sNum]), next = ofldOf(paras[sNum + 1]);
  const endsField = here !== undefined && next !== undefined && here !== next;
  if (endsField) return settings.interFieldMs ?? settings.interScoreMs ?? config.interFieldMs ?? config.interScoreMs;
  return settings.interParaMs ?? settings.interScoreMs ?? config.interParaMs ?? config.interScoreMs;
}

// The gap at the end of a cycle (before durationScale): the last score of the cycle may override it.
// It comes after the score's own gap, as it always has.
const cycleGap = ({ config, settings = {} }) => settings.interCycleMs ?? config.interCycleMs;

export { scoreGap, cycleGap, sumPauses, fadeDelay, readingTimes, pauseItem, toggleItems, scoreFromTimings, resolveScore };
