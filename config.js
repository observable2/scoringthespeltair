// generic engine defaults; project-specific values (startingPoint, numParas,
// paraFadeWords, etc.) belong in each project's own nbks/data/config.js
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
  slower: 1.3
}
export { defaultConfig };
