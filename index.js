// public API for scoringthespeltair
export { play } from "./play.js";
export { createConfig, normalizeConfig, measuredWith, checkMeasuredWith, configSchema, configAliases, defaults, defaultConfig } from "./config.js";
export { typeCss } from "./typography.js";
export { mount } from "./mount.js";
export { sleep, msToTime } from "./timing.js";
export { mod, shuffle } from "./math.js";
export { createDevLog } from "./dev.js";
export { toggleSpel, splitIntoChars } from "./display.js";
export { centerField } from "./center.js";
export { sumPauses } from "./score.js";
export { timeToRead, wordTime, whitespaceTime, spelTime, timeToReadDefaults } from "./timetoread.js";
export { normalizeToken } from "./text.js";
