// Configuration for scoringthespeltair. Read the README, "Configuration", first.
//
// Two things are exported from here:
//
//   createConfig(overrides)  the current way: the engine's defaults (`configSchema`), your overrides,
//                            legacy names mapped to current ones, mistakes warned about.
//   defaultConfig            the LEGACY defaults, kept exactly as they were so that projects that
//                            spread it (`{ ...defaultConfig, ... }`) play exactly as before.
//                            New projects should use createConfig.
//
// All times are in milliseconds (keys end in Ms); lengths ending in Vw are in vw.

// --- the schema: the one place where every setting is defined -------------------------------------
// scope:  "measure"  changes the positions measured in the notebook, so the notebook and the player
//                    must agree (it is exported with the data as `measuredWith`, and the player checks it)
//         "play"     read by the engine while the piece plays
//         "page"     applied by the page (CSS/layout); the engine only carries the default
const configSchema = {
  // --- play: what the engine does
  running:        { default: true,  scope: "play", doc: "false stops play() (handy while debugging)" },
  startPara:      { default: 0,     scope: "play", doc: "index of the paragraph where each cycle starts (usually 0; higher while debugging)" },
  cycleScores:    { default: false, scope: "play", doc: "true: one cycle plays every score in order (see scoreSettings); false: one score per paragraph" },
  scoreSettings:  { default: undefined, scope: "play", doc: "array indexed by score number of { durationScale, interScoreMs, effect, shuffle }" },
  fadeWords:      { default: 5,     scope: "play", doc: "n > 0: each spel fades n spels later; 0: the paragraph is shown, then removed; -1: the scores do their own fading" },
  paraFadeWords:  { default: undefined, scope: "play", doc: "array, one fadeWords value per paragraph (overrides fadeWords)" },
  charFades:      { default: true,  scope: "play", doc: "true: spels are revealed character by character; false: whole spels fade" },
  charIntervalMs: { default: 80,    scope: "play", doc: "delay between characters when charFades" },
  durationScale:  { default: 1,     scope: "play", doc: "multiplier on every duration: pauses, fades, gaps, the per-character delay (2: everything lasts twice as long; 0: at once)" },
  interScoreMs:   { default: 3000,  scope: "play", doc: "gap after each score" },
  interCycleMs:   { default: 3000,  scope: "play", doc: "gap before the first score and at the end of each cycle" },
  creditsPauseMs: { default: 0,     scope: "play", doc: "how long #byline is shown at the end of each cycle (0: not shown)" },
  fieldFadeMs:    { default: 2500,  scope: "play", doc: "how long the whole field takes to fade (fadeWords 0); play() waits this long plus 250 ms. Also the field's CSS transition (typeCss)" },
  clearPauseMs:   { default: 500,   scope: "play", doc: "pause after the paragraph's spels are reset, with fadeWords 0" },
  PRODUCTION:     { default: false, scope: "play", doc: "true: no console logging from play()" },
  // --- page: applied by the pages through typeCss(config) and the CSS variables it sets
  spelFadeMs:     { default: 1500,  scope: "page", doc: "CSS transition of a .spel" },
  charFadeMs:     { default: 1300,  scope: "page", doc: "CSS transition of a .char" },
  // --- measure: the type the spels are measured in, and the layout the measurement bakes in
  fontFamily:     { default: "Source Serif 4", scope: "measure", doc: "family of the type (the notebook loads it from Google Fonts; the player must have the same file)" },
  fontWeight:     { default: 300,   scope: "measure", doc: "CSS font-weight, 100-900" },
  fontSizeVw:     { default: 3,     scope: "measure", doc: "font size of the galley and the field, in vw; spel positions scale with it" },
  lineHeight:     { default: 1.8,   scope: "measure", doc: "unitless line height" },
  opsz:           { default: 14,    scope: "measure", doc: "optical-size axis, fixed so that the type does not change with the window width; null leaves it to the browser" },
  ligatures:      { default: "no-common-ligatures", scope: "measure", doc: "CSS font-variant-ligatures" },
  clmnRight:      { default: 0,     scope: "measure", doc: "vw added to the left of every spel in a clmn named \"right\"" },
};

// Old names for current keys: createConfig() and play() accept both. Move to the new names when
// you next touch a project's config; the old ones will keep working through 1.x.
const configAliases = {
  startingPoint: "startPara",
  slower: "durationScale", // (also inside each scoreSettings entry)
};
// Keys that did nothing: still accepted, but warned about, and dropped.
const configRetired = {
  numParas: "was never read by the engine (the number of paragraphs is paras.length)",
  scoredPauseMs: "was never read by the engine",
};
const legacyTimeKeys = ["charInterval", "interCycle", "interScore", "scoredPause", "creditsPause"];

// the defaults, from the schema
const defaults = Object.freeze(Object.fromEntries(
  Object.entries(configSchema).filter(([, d]) => d.default !== undefined).map(([k, d]) => [k, d.default])));

// Maps legacy names to current ones, leaving everything else alone (no defaults are added). A key
// given under both names keeps the current one. play() applies this itself, so a config that was
// never passed through createConfig still works.
function normalizeConfig(config) {
  const out = { ...config };
  for (const [old, now] of Object.entries(configAliases)) {
    if (old in out) {
      if (!(now in out)) out[now] = out[old];
      delete out[old];
    }
  }
  for (const k of Object.keys(configRetired)) delete out[k];
  // the aliases apply inside each score's settings too
  if (Array.isArray(out.scoreSettings))
    out.scoreSettings = out.scoreSettings.map((e) => {
      if (!e || !("slower" in e)) return e;
      const { slower, ...rest } = e;
      return { durationScale: slower, ...rest };
    });
  return out;
}

// createConfig(overrides, { warn }) -> a new, plain object: the defaults, then the overrides.
// Warns (console.warn, or options.warn) about retired keys, legacy time keys and keys it does not
// know (a typo would otherwise be ignored silently). Keys it does not know are kept, so a project
// may carry its own.
function createConfig(overrides = {}, { warn = console.warn } = {}) {
  for (const [k, why] of Object.entries(configRetired))
    if (k in overrides) warn(`scoringthespeltair: config key ${k} ${why}; remove it`);
  for (const k of legacyTimeKeys)
    if (k in overrides) warn(`scoringthespeltair: config key ${k} is ignored; times are milliseconds with an Ms suffix (e.g. interCycleMs)`);
  const known = new Set([...Object.keys(configSchema), ...Object.keys(configAliases), ...Object.keys(configRetired), ...legacyTimeKeys]);
  const unknown = Object.keys(overrides).filter((k) => !known.has(k));
  if (unknown.length) warn(`scoringthespeltair: unknown config key${unknown.length > 1 ? "s" : ""} ${unknown.join(", ")} (a typo? the project's own keys are kept)`);
  return { ...defaults, ...normalizeConfig(overrides) };
}

// The settings that decide the measured positions, for exporting with the spel data and checking
// against the player's: { fontFamily, fontWeight, fontSizeVw, lineHeight, opsz, ligatures, clmnRight }.
function measuredWith(config) {
  const c = { ...defaults, ...config };
  return Object.fromEntries(Object.entries(configSchema).filter(([, d]) => d.scope === "measure").map(([k]) => [k, c[k]]));
}

// Returns a list of differences (strings), empty if `measured` (as exported) matches `config`.
// clmnRight is left out: it is baked into the spels' leftvw, and the player does not use it.
function checkMeasuredWith(measured, config) {
  const mine = measuredWith(config);
  return Object.keys(mine)
    .filter((k) => k !== "clmnRight" && k in measured && measured[k] !== mine[k])
    .map((k) => `${k}: the spels were measured at ${measured[k]}, this page uses ${mine[k]}`);
}

// --- legacy -----------------------------------------------------------------------------------------
// Kept exactly as it was (plus the keys the engine read but did not list) so that a project that
// spreads it plays exactly as before. New projects: createConfig.
const defaultConfig = {
  running: true,
  charFades: true,
  charIntervalMs: 80,
  fadeWords: 5, // zero for no autoFade; -1 for scores do fading
  // all times are in milliseconds (keys end in Ms)
  creditsPauseMs: 0, // zero for no credits
  interCycleMs: 3000,
  interScoreMs: 3000,
  scoredPauseMs: 1000, // not read by the engine (retired)
  slower: 1.3,
  // set by the pages, not by the engine: the weight of the type the spels are measured and shown in
  fontWeight: 400,
  // listed because the engine reads them. (No startPara here: a project that sets the old
  // startingPoint on top of this would then lose to it; play() falls back to 0 itself.)
  cycleScores: false,
  PRODUCTION: false
};
export { createConfig, normalizeConfig, measuredWith, checkMeasuredWith, configSchema, configAliases, defaults, defaultConfig };
