import { mod } from "./math.js";

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

export { scoreGap, cycleGap, sumPauses, pauseItem, toggleItems, scoreFromTimings, resolveScore };
