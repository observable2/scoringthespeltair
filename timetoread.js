// Dependency-free reading-time estimates, in milliseconds. See timetoread-rita.js for the
// RiTa-based model. Calibrated against timestamped readings (see README "Calibration").
//
// Characters are written as \u escapes so an editor can't silently change them.
// word time   = (base + perLetter * letters + clausePause * clause marks
//                + sentencePause * sentence marks) / factor
// whitespace  = (perSpace * spaces + perNewline * line breaks) / factor
// `factor` > 1 reads faster, < 1 slower. Strip HTML from a token before measuring it.
const defaults = Object.freeze({
  base: 0,
  perLetter: 112, // ordinary spacing between words is already inside this figure
  clausePause: 150, // per , ; : and dashes, closing curly quote and ) (not yet calibrated: no data)
  sentencePause: 150, // per . ? ! and ellipsis (not yet calibrated: no data)
  perSpace: 0, // extra per space character, for text where extra spaces mean a pause
  perNewline: 1000 // per line break; measured at about +1000 ms in reunion
});

const count = (s, re) => (s.match(re) || []).length;

// reading time of one word, not including the whitespace that follows it
function wordTime(word, factor = 1, overrides = {}) {
  const o = { ...defaults, ...overrides };
  const ms =
    o.base +
    o.perLetter * count(word, /\p{L}/gu) +
    o.clausePause * count(word, /[,;:\u2014\u2013\u201d)]/g) +
    o.sentencePause * count(word, /[.?!\u2026]/g);
  return Math.round(ms / factor);
}

// extra pause for the whitespace between two words
function whitespaceTime(spaces, factor = 1, overrides = {}) {
  const o = { ...defaults, ...overrides };
  const breaks = count(spaces, /\r\n|\n|\r/g); // "\r\n" counts as one break
  const others = spaces.replace(/\r\n|\n|\r/g, "").length;
  return Math.round((o.perSpace * others + o.perNewline * breaks) / factor);
}

// legacy signature: returns the word's time and adds the whitespace before it to the
// previous item of `pauses`
function timeToRead(word, idx, spaces, pauses, factor = 1, overrides = {}) {
  if (idx > 0) pauses[idx - 1] += whitespaceTime(spaces, factor, overrides);
  return wordTime(word, factor, overrides);
}

export { timeToRead, wordTime, whitespaceTime, defaults as timeToReadDefaults };
