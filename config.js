// generic engine defaults; project-specific values (startingPoint, numParas,
// paraFadeWords, etc.) belong in each project's own nbks/data/config.js
//
// The pattern: every setting has its default here, and a scoring project overrides only what it
// needs, by spreading defaultConfig (see README, "Configuration"). Some settings are used by the
// engine (the timings, fadeWords, charFades ...) and some only by the pages that show the piece
// (fontWeight): the engine never applies those, it just carries the default so that the
// notebook that measures the text and the player that shows it read the same value.
const defaultConfig = {
  running: true,
  charFades: true,
  charIntervalMs: 80,
  fadeWords: 5, // zero for no autoFade; -1 for scores do fading
  // all times are in milliseconds (keys end in Ms)
  creditsPauseMs: 0, // zero for no credits
  interCycleMs: 3000,
  interScoreMs: 3000,
  scoredPauseMs: 1000,
  slower: 1.3,
  // set by the pages, not by the engine (see above): the weight (CSS font-weight, 100-900) of the
  // type the spels are measured and shown in. The spel data holds positions measured at this
  // weight, so the notebook and the player must use the same one.
  fontWeight: 400
}
export { defaultConfig };
