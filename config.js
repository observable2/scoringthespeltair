// generic engine defaults; project-specific values (startingPoint, numParas,
// paraFadeWords, etc.) belong in each project's own nbks/data/config.js
const defaultConfig = {
  running: true,
  charFades: true,
  charInterval: 8,
  fadeWords: 5, // zero for no autoFade; -1 for scores do fading
  // these times are all in hundredths of seconds
  creditsPause: 0, // zero for no credits
  interCycle: 300,
  interScore: 300,
  scoredPause: 100,
  slower: 1.3
}
export { defaultConfig };
