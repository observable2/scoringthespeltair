import { mod } from "./math.js";
import { spelTime } from "./timetoread.js";

// The duration of a score item, in ms: the time it holds before the next item. A score item is
// { id, duration }. Scores made before the rename call it `pause`, which is still read, so they play
// unchanged (scripts/migrate-scores-to-duration.js renames it in a scores.json).
const durationOf = (item) => item.duration ?? item.pause;

// sums the durations of the n score items following idx (wrapping around the score);
// with skipPauses, "PAUSE" items contribute nothing
function sumDurations(score, idx, n, { skipPauses = false } = {}) {
  let total = 0;
  for (let i = 0; i < n; ++i) {
    const item = score[mod(idx + i + 1, score.length)];
    if (!(skipPauses && item.id === "PAUSE")) total += durationOf(item);
  }
  return total;
}
const sumPauses = sumDurations; // the former name

// Reading times for fading out: for each item of a score, how long it takes to read, WITHOUT the
// end-of-unit time a score item's duration may carry (the whitespace after a line's last spel: a line break ...).
// Those durations belong before the next unit is faded IN, not to when words fade OUT.
//  - A spel in the middle of a line (the next item is a spel on the same line, by `topvw`, para,
//    clmn and ofld) has no such whitespace: its duration IS its reading time, as scored or recorded.
//  - A spel that ends a line (or the score, or has no recorded position) is estimated (`spelTime` of
//    its string, no gap) and scaled by this score's pace: the sum of its mid-line durations over the sum
//    of their estimates. A linear score (durations from spelTime) has pace 1; a score timed from a
//    recording has the pace of that recording.
//  - "PAUSE" and "AUTOFADE" items are not spels and read in 0. A spel not in `spels` reads in its duration.
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
    const mid = here?.string !== undefined && durationOf(item) > 0 && next && isSpel(next) && sameLine(here, info(next));
    if (mid) { recorded += durationOf(item); estimated += estimate(here); }
    return mid;
  });
  const pace = estimated > 0 ? recorded / estimated : 1;
  return score.map((item, i) => {
    if (!isSpel(item)) return 0;
    const here = info(item);
    if (here?.string === undefined) return durationOf(item);
    return midLine[i] ? durationOf(item) : Math.round(estimate(here) * pace);
  });
}

// How long after a spel appears it fades out, when it fades n spels later (ms, before durationScale):
// the reading times (see readingTimes) of the spel and the n after it, wrapping around the score.
const fadeDelay = (times, idx, n) => {
  let total = times[idx];
  for (let i = 0; i < n; ++i) total += times[mod(idx + i + 1, times.length)];
  return total;
};

// A score item that shows nothing and waits `ms`: { id: "PAUSE", duration: ms }. A whole score may be
// one such item (a breath between two scores).
const pauseItem = (ms) => ({ id: "PAUSE", duration: ms });

// The same spels again, each with no duration. Played after (or as) a score, they toggle every one of
// those spels at once: the way to fade what a score has shown, or to show a whole verse in one go.
// `items` are score items; only their ids are used.
const toggleItems = (items) => items.map(({ id }) => ({ id, duration: 0 }));

// A score from recorded timings: one item per spel, its duration the time from the start of that word
// to the start of the next (the last word: its own length), plus `extraMs` to every duration.
//   timings  [{ start, end, word? }, ...] in SECONDS, as a forced aligner or a hand-timed reading
//            gives them; the conversion to milliseconds is made here, at the boundary
//   ids      the spel ids, in the same order (without them each timing's `word` is the id)
//   extraMs  added to every duration (default 0): a reader who is slower than the recording
// (This is what `alignedSpels` did in the Framework notebooks, and what reading's timings are.)
function scoreFromTimings(timings, { ids, extraMs = 0 } = {}) {
  if (ids && ids.length !== timings.length)
    throw new Error(`scoringthespeltair: scoreFromTimings has ${timings.length} timings but ${ids.length} ids`);
  return timings.map((t, i) => {
    const id = ids ? ids[i] : t.word;
    if (id === undefined) throw new Error(`scoringthespeltair: scoreFromTimings: timing ${i} has no id (give ids, or a word in each timing)`);
    const next = timings[i + 1];
    const seconds = next ? next.start - t.start : t.end - t.start;
    return { id, duration: Math.round(seconds * 1000) + extraMs };
  });
}

// A score of scores.json is an array of { id, duration } items. It may instead NAME a generator, so that
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

// The settings that refine a fade-out of a whole score / ofld / cycle, the score's own first, then the
// config (see the README, "Fading out"). Times are ms, before durationScale:
//   fadeOrder     "shown" (the order they appeared), "reverse", "random": the order of a "sequence" fade
//   fadeStaggerMs a fixed step between spels of a "sequence" fade, in place of each item's duration
//   holdMs        the least time the whole unit stays showing, from when its last spel appeared, before it fades
//   overlapMs     the next score starts this long after the fade begins, whatever is left of it fading on
//                 (undefined: the fade is over, plus clearPauseMs, before the next score starts)
//   revealStyle   "sequence" (the default: the items appear one by one) or "together" (all the score's spels at once, then
//                 its durations are waited out)
function fadeOptions(config, settings = {}) {
  const pick = (k, d) => settings[k] ?? config[k] ?? d;
  return { order: pick("fadeOrder", "shown"), staggerMs: pick("fadeStaggerMs"), holdMs: pick("holdMs", 0),
    overlapMs: pick("overlapMs"), reveal: pick("revealStyle", "sequence") };
}

// Does the score sNum end a field (an ofld)? Yes if the next paragraph's first spel is in another
// ofld; spels without an `ofld` (data from before it was recorded) never end one (see scoreGap).
const endsField = (sNum, { paras, spels }) => {
  const ofldOf = (para) => spels?.get(para?.[0])?.ofld;
  const here = ofldOf(paras?.[sNum]), next = ofldOf(paras?.[sNum + 1]);
  return here !== undefined && next !== undefined && here !== next;
};

// Does the score sNum end the ofld it is in, for fading it out? Like endsField, but a score also ends
// its ofld when the spels carry no ofld (nothing says otherwise) or when no paragraph follows it.
const endsOfld = (sNum, { paras, spels }) => {
  const ofldOf = (para) => spels?.get(para?.[0])?.ofld;
  const here = ofldOf(paras?.[sNum]), next = ofldOf(paras?.[sNum + 1]);
  return here === undefined || next === undefined || here !== next;
};

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
  if (endsField(sNum, { paras, spels })) return settings.interFieldMs ?? settings.interScoreMs ?? config.interFieldMs ?? config.interScoreMs;
  return settings.interParaMs ?? settings.interScoreMs ?? config.interParaMs ?? config.interScoreMs;
}

// What fades the spels out, and how (see the README, "Fading"). The score's own settings come first,
// then the config:
//   fadeOut   "window"  each spel fades fadeWords spels after it (n = config.fadeWords)
//             "scored"  the engine never fades: the score's own items do (toggleItems)
//             "score"   the spels of a score fade after its last item and its gap (interScoreMs ...)
//             "ofld"    the spels of an ofld fade after the score that ends it and its gap (interFieldMs)
//             "cycle"   the spels of the whole cycle fade after its last score and its gap
//   fadeStyle "together" (default) all at once; "sequence": in the order shown, each after its item's duration
// (fadeOptions, below, has the settings that refine "score" / "ofld" / "cycle".)
// A config without fadeOut is read as before, from fadeWords: n > 0 "window"; 0 "field", the old
// wipe of the whole #field after each score (kept for old projects); -1 "scored" (any other value
// is "window", which fades nothing without a positive fadeWords). `legacy` is true then.
const FADE_OUTS = ["window", "scored", "score", "ofld", "cycle"];
function resolveFade(config, settings = {}) {
  const style = settings.fadeStyle ?? config.fadeStyle ?? "together";
  const out = settings.fadeOut ?? config.fadeOut;
  if (FADE_OUTS.includes(out)) return { out, style, legacy: false };
  if (out !== undefined) console.warn(`scoringthespeltair: fadeOut "${out}" is not one of ${FADE_OUTS.join(", ")}; reading fadeWords instead`);
  const n = config.fadeWords;
  return { out: n === 0 ? "field" : n === -1 ? "scored" : "window", style, legacy: true };
}

// The gap at the end of a cycle (before durationScale): the last score of the cycle may override it.
// It comes after the score's own gap, as it always has.
const cycleGap = ({ config, settings = {} }) => settings.interCycleMs ?? config.interCycleMs;

export { scoreGap, endsField, endsOfld, resolveFade, fadeOptions, cycleGap, durationOf, sumDurations, sumPauses, fadeDelay, readingTimes, pauseItem, toggleItems, scoreFromTimings, resolveScore };
