// public API for scoringthespeltair
export { play } from "./play.js";
export { createConfig, normalizeConfig, measuredWith, checkMeasuredWith, configSchema, configAliases, defaults, defaultConfig } from "./config.js";
export { typeCss } from "./typography.js";
export { mount } from "./mount.js";
export { sleep, msToTime } from "./timing.js";
export { mod, shuffle } from "./math.js";
export { createDevLog } from "./dev.js";
export { toggleSpel, hideSpel, splitIntoChars } from "./display.js";
export { centerField } from "./center.js";
export { bindKeys } from "./controls.js";
export { scoreGap, endsField, endsOfld, resolveFade, fadeOptions, cycleGap, durationOf, sumDurations, sumPauses, fadeDelay, readingTimes, pauseItem, toggleItems, scoreFromTimings, resolveScore } from "./score.js";
export { timeToRead, wordTime, whitespaceTime, spelTime, timeToReadDefaults } from "./timetoread.js";
export { normalizeToken } from "./text.js";
