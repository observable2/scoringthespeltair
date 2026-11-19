import { sleep, msToTime } from "./timing.js";
import { createDevLog } from "./dev.js";
import { toggleSpel, hideSpel } from "./display.js";
import { durationOf, sumDurations, fadeDelay, readingTimes, resolveScore, resolveFade, fadeOptions, endsOfld, scoreGap, cycleGap } from "./score.js";
import { shuffle } from "./math.js";
import { defaults, fadeTimes } from "./config.js";
// options.generators: { name: (context, ...args) => score }, for scores
// made anew each time they come round (see resolveScore in score.js and
// the README, "Generated scores")
async function play(config, fieldElem, spels, paras, scores, options = {}) {
  const generators = options.generators ?? {};
  // `config` is read live (a page can set config.running = false to
  // stop the piece), so it is not copied. startingPoint is accepted for
  // startPara, and a config that did not come from createConfig plays
  // as it always did (missing keys take no new defaults).
  const startPara = config.startPara ?? config.startingPoint ?? 0;
  // slower is the legacy name of durationScale (the legacy
  // defaultConfig has it)
  const durationScale = config.durationScale ?? config.slower ?? defaults.durationScale;
  const fieldFadeMs = config.fieldFadeMs ?? defaults.fieldFadeMs;
  // A config without clearPauseMs (such as one spreading the legacy
  // defaultConfig) keeps the 500 it always had; createConfig: 1300.
  const clearPauseMs = config.clearPauseMs ?? 500;
  const devLog = createDevLog(config);
  // sleep that also honours the live flags config.paused (hold here)
  // and config.skip (cut this wait short), once they exist in the
  // config (see bindKeys in controls.js); without them, a plain sleep
  const nap = async (ms) => {
    if (!("paused" in config) && !("skip" in config)) return sleep(ms);
    let left = Math.max(0, ms);
    while (config.running) {
      if (config.paused) { await sleep(50); continue; }
      if (config.skip || left <= 0) return;
      const step = Math.min(left, 50);
      await sleep(step);
      left -= step;
    }
  };
  const legacyKeys = ["charInterval", "interCycle", "interScore", "scoredPause", "creditsPause"].filter(k => k in config);
  if (legacyKeys.length) console.warn(`scoringthespeltair: config keys ${legacyKeys.join(", ")} are ignored; times are now milliseconds with an Ms suffix (e.g. interCycleMs)`);
  devLog("entered play()", scores);
  let cycStart,
    // the spels shown since the last fade-out of a whole score / ofld /
    // cycle, and when the last appeared
    fadeUnit = { shown: [], lastAt: 0 },
    // when (Date.now) the last scheduled fade-out of the score is due
    fadeEnd = 0,
    autoFade = false,
    fadePause = 0,
    fadeWords = config.fadeWords,
    idx,
    lastSettings = {},
    loopCount = 0,
    loopMsg,
    // with cycleScores a pass plays every score in turn: one
    // "paragraph" to the cycle
    numParas = config.cycleScores ? 1 : paras.length,
    paraNum = startPara,
    score,
    scoreNum = 0,
    yieldMsg,
    // currently unused variables
    scoreName,
    prevScore,
    rdnScore,
    toggle = true;
  // show whatever is currently visible in the field element
  if (resolveFade(config).out !== "window" || config.fadeWords < 1) {
    devLog(">>> show whatever is currently visible in the field element");
    fieldElem.style.opacity = 1;
  }
  await sleep(config.interCycleMs); // pause before starting
 while (config.running) { // stopped with false in config
    // fadeWords per paragraph, if config.paraFadeWords is given
    if (config.paraFadeWords) fadeWords = config.paraFadeWords[paraNum] ?? config.fadeWords;
    if (paraNum == startPara) cycStart = Date.now();
    // looping forever ...
    loopMsg = `loop: ${loopCount++}`;
    // one score per pass, or (cycleScores) every score, in order
    const passScores = config.cycleScores ? scores.map((_, i) => i) : [scoreNum];
    for (const sNum of passScores) {
    if (!config.running) break;
    // what fades the spels out, and how (the config's or this score's
    // fadeOut and fadeStyle; see resolveFade)
    const fade = resolveFade(config, config.scoreSettings?.[sNum] ?? {});
    const fopt = fadeOptions(config, config.scoreSettings?.[sNum] ?? {});
    // the engine fades whole units
    const unitFade = fade.out === "score" || fade.out === "ofld" || fade.out === "cycle";
    // a skip asked for in the last gap does not carry into this score
    if ("skip" in config) config.skip = false;
    // the legacy wipe (fadeWords 0) faded the whole field out after the
    // previous score: bring it back
    if (fade.out === "field") fieldElem.style.opacity = 1;
    // per-score overrides, from config.scoreSettings[sNum] (README,
    // "Per-score settings"): durationScale and the gaps replace the
    // config's for this score (slower: old name of durationScale);
    // effect is the class toggled (default "visible"); shuffle plays
    // the score's items in a new random order each time
    const settings = config.scoreSettings?.[sNum] ?? {};
    const scale = settings.durationScale ?? settings.slower ?? durationScale;
    // the gap after this score (the unit it ends may have its own)
    const interScoreMs = scoreGap(sNum, { config, settings, paras, spels });
    lastSettings = settings;
    // a score's own fadeMs / fadeInMs / fadeOutMs: CSS transition times
    // of its spels, in and out (pages use --fade-in / --fade-out, see
    // typeCss). Not scaled by durationScale. What a score does not say
    // is left to the config's.
    const charFades = config.charFades ?? true;
    if (config.scoreSettings?.some(st => st && Object.values(fadeTimes(st, charFades)).some(v => v !== undefined))) {
      const t = fadeTimes(settings, charFades);
      for (const [v, props] of [[t.inMs, ["--fade-in", "--spel-fade", "--char-fade"]], [t.outMs, ["--fade-out"]]])
        for (const prop of props) {
          if (v !== undefined) fieldElem.style.setProperty(prop, `${v}ms`);
          else fieldElem.style.removeProperty(prop);
        }
    }
    const toggleOpts = { effect: settings.effect, durationScale: settings.durationScale ?? settings.slower };
    // TODO: scores are not tied to paragraphs (scoreNum starts at 0)
    devLog(sNum, paraNum);
    // a score is an array of items, or the name of one of
    // options.generators (made anew every time)
    score = resolveScore(scores[sNum], { spels, paras, scores, config, scoreNum: sNum }, generators);
    if (settings.shuffle) score = shuffle(score);
    devLog("scores:",scores); // DEBUG
    devLog("score:", sNum, "score items:", score.length);
    // play each item of the score: show its spel for its duration
    const readTimes = readingTimes(score, spels); // for the fade-outs
    // fadeOut "score" / "ofld" / "cycle": what this score shows, in
    // order, with the time each holds (ms); the unit is faded out
    // together or in sequence once it is over (see below)
    const unitShown = fadeUnit.shown;
    // revealStyle "together": all the score's spels appear at once (at
    // its first spel), then its durations are waited out
    const revealTogether = fopt.reveal === "together" && unitFade;
    let revealed = false;
    for (idx = 0; idx < score.length; idx++) {
      // hold here while paused
      while (config.paused && config.running) await sleep(50);
      if (!config.running || config.skip) break;
      let spelId = score[idx].id;
      // an 'AUTOFADE' item can override the config.fadeWords default
      if (spelId === "AUTOFADE") {
        devLog("autoFade");
        // an explicit request in the score: window fading, whatever
        // fadeOut says
        autoFade = true;
        // AUTOFADE items keep a word count in `pause`, not a duration
        fadeWords = score[idx].pause;
        fadePause = sumDurations(score, idx, fadeWords);
        devLog("In-score AUTOFADE of:", fadeWords, "at score:", sNum, "item:", idx);
        continue;
      }
      // for the log
      let str = "[pause]";
      if (spelId !== "PAUSE") {
        str = spels.get(spelId);
        if (str !== undefined) str = str.string;
      }
      yieldMsg =
        loopMsg + `, score: ${sNum}, item: ${idx}, paraNum: ${paraNum}, id: ${spelId}, `;
      yieldMsg += `string: '${str}', duration: ${durationOf(score[idx])}`;
      //
      // show the spel and schedule its fade-out
      let elem;
      if (spelId !== "PAUSE") {
        elem = document.getElementById(spelId);
        if (revealTogether) {
          if (!revealed) {
            revealed = true;
            // each spel once, with the duration of its first item
            const first = new Map();
            for (const it of score) if (it.id !== "PAUSE" && it.id !== "AUTOFADE" && !first.has(it.id)) first.set(it.id, durationOf(it) * scale);
            await Promise.all([...first].map(([id, ms]) => {
              const e = document.getElementById(id);
              unitShown.push({ elem: e, ms });
              return toggleSpel(e, config, toggleOpts);
            }));
            fadeUnit.lastAt = Date.now();
          }
        } else {
          await toggleSpel(elem, config, toggleOpts);
          if (unitFade) { unitShown.push({ elem, ms: durationOf(score[idx]) * scale }); fadeUnit.lastAt = Date.now(); }
        }
        // The fade-out is timed from now, by the reading time of this
        // spel and the next fadeWords (fadeDelay), not by their score
        // durations, which may carry end-of-unit whitespace (line
        // breaks ...): that delays what is faded IN next, never what is
        // faded OUT.
        // (legacy: fadeWords alone decided)
        const windowFades = fade.out === "window" || fade.legacy || autoFade;
        if (windowFades && fadeWords > 0) fadePause = fadeDelay(readTimes, idx, fadeWords);
        else if (!windowFades) fadePause = 0;
        if (fadePause > 0) {
          fadeEnd = Math.max(fadeEnd, Date.now() + fadePause * scale);
          sleep(fadePause * scale).then(() => toggleSpel(elem, config, toggleOpts));
        }
      }
      // pause for both actual spels and PAUSE items
      // durations usually come from the temporal data
      await nap(durationOf(score[idx]) * scale);
    } // end of loop thru current score
    // between scores: wait for the last fade-out (scaled by this
    // score's durationScale), then the gap (scaled by the config's).
    // The fade-outs run on their own clock, so may already be done.
    await nap(Math.max(0, fadeEnd - Date.now()) + interScoreMs * durationScale);
    fadeEnd = 0;
    // fade out the unit: the whole field after each score (the legacy
    // fadeWords 0), or the score's / ofld's / cycle's spels, once the
    // unit is over
    if (fade.out === "field") {
      devLog(">>> remove old paragraph");
      fieldElem.style.opacity = 0;
      await sleep((fieldFadeMs + 250) * durationScale);
      paras[paraNum].forEach(p => hideSpel(document.getElementById(p), config, toggleOpts));
      await sleep((settings.clearPauseMs ?? clearPauseMs) * durationScale);
    } else if (unitFade) {
      // the unit is over after each score ("score"), after the one that
      // ends its ofld ("ofld"; an ofld-less score ends it too), or
      // after the cycle's last score ("cycle"); with cycleScores no
      // ofld ends before that
      const lastOfCycle = sNum === scores.length - 1;
      const unitOver = fade.out === "score" || lastOfCycle || (fade.out === "ofld" && !config.cycleScores && endsOfld(sNum, { paras, spels }));
      if (unitOver && config.running) {
        // the whole unit shows for at least holdMs (from its last spel)
        if (fopt.holdMs > 0) await nap(fopt.holdMs * scale - (Date.now() - fadeUnit.lastAt));
        devLog(">>> fade out the", fade.out, fade.style);
        let items = unitShown.splice(0);
        if (fopt.order === "reverse") items.reverse();
        else if (fopt.order === "random") items = shuffle(items);
        const fadeThem = async () => {
          if (fade.style === "sequence") {
            for (let i = 0; i < items.length && config.running; i++) {
              hideSpel(items[i].elem, config, toggleOpts);
              if (i < items.length - 1) await nap(fopt.staggerMs !== undefined ? fopt.staggerMs * scale : items[i].ms);
            }
          } else items.forEach(it => hideSpel(it.elem, config, toggleOpts));
        };
        if (fopt.overlapMs === undefined) {
          await fadeThem();
          // before the next score (the score's own, if it has one)
          await nap((settings.clearPauseMs ?? clearPauseMs) * scale);
        } else {
          fadeThem(); // goes on while the next score starts
          await nap(fopt.overlapMs * scale);
        }
      }
    }
    // the skip, if any, is spent
    if ("skip" in config) config.skip = false;
    } // end of loop thru this pass's scores
    // bump paraNum if needed
    paraNum = ++paraNum % numParas;
    // can set a higher starting point in config, usually for debugging
    if (paraNum == 0) paraNum += startPara;
    //
    if (paraNum == startPara) {
      devLog("--- end of cycle --- Duration:", msToTime(Date.now() - cycStart));
      // end of cycle pause
      await sleep(cycleGap({ config, settings: lastSettings }) * durationScale);
      if (config.creditsPauseMs > 0) {
        // #byline is optional
        const bl = document.getElementById("byline");
        if (bl) bl.style.opacity = 1;
        await sleep(config.creditsPauseMs * durationScale);
        if (bl) bl.style.opacity = 0;
        await sleep(cycleGap({ config, settings: lastSettings }) * durationScale);
      }
    }
    // bump scoreNum
    scoreNum = ++scoreNum % scores.length;
  } // end of (endless) while loop
}
export { play }
