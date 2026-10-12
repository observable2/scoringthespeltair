// RiTa-based reading-time estimate. Imports "rita", so it is NOT re-exported from index.js:
// import it directly from "scoringthespeltair/timetoread-rita.js"
import { RiTa } from "rita";

// Tuning constants. null = still to be supplied (calls throw until every one is set,
// either here or via overrides). All times are milliseconds (`base`, `punctPause`).
const defaults = Object.freeze({
  base: 33,
  timeFactor: 1, // divisor applied to the whole result
  vowelWeight: 1.5, // multiplier on `base` per vowel
  punctPause: 700, // added per punctuation token
  // structure of the model
  maxLengthUnits: 3, // extra `base` units for token length, capped here
  syllableWeight: 2, // multiplier on `base` per syllable
  whitespaceWeight: 2, // multiplier on `base` per unit of whitespace
  longTokenLength: 4, // tokens longer than this get vowelWeight per vowel, not once
  normalize: (token) => token.trim() // assumption: the original normalize() isn't in the repo
});

function timeToRead(rawToken, lengthOfWhiteSpace = 1, factor, overrides = {}) {
  const o = { ...defaults, ...overrides };
  if (factor !== undefined) o.timeFactor = factor;
  for (const k of ["timeFactor", "vowelWeight", "punctPause"]) {
    if (o[k] == null) throw new Error(`timeToRead: no value for "${k}" (set it in defaults or pass overrides)`);
  }
  const token = o.normalize(rawToken);
  const { base } = o;
  let ttr = base;
  // add up to maxLengthUnits extra base units for each unit of token length
  ttr += base * Math.min(Math.max(token.length - 1, 0), o.maxLengthUnits);
  const syls = RiTa.syllables(token).split("/");
  const vowels = token.match(/[aeiouy]/gi);
  const punc = RiTa.tokenize(token).filter((t) => RiTa.isPunct(t));
  ttr += syls.length * (base * o.syllableWeight);
  if (vowels) ttr += token.length > o.longTokenLength ? vowels.length * (base * o.vowelWeight) : base * o.vowelWeight;
  if (punc.length) ttr += punc.length * o.punctPause;
  ttr += lengthOfWhiteSpace * (base * o.whitespaceWeight);
  return Math.round(ttr / o.timeFactor);
}

// returns a timeToRead with a project's overrides baked in
function createTimeToRead(overrides = {}) {
  return (rawToken, lengthOfWhiteSpace = 1, factor) => timeToRead(rawToken, lengthOfWhiteSpace, factor, overrides);
}

export { timeToRead, createTimeToRead, defaults as timeToReadDefaults };
