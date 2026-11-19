import { sleep, msToTime } from "./timing.js";
import { createDevLog } from "./dev.js";
import { toggleSpel, hideSpel } from "./display.js";
import { durationOf, sumDurations, fadeDelay, readingTimes, resolveScore, resolveFade, fadeOptions, endsOfld, scoreGap, cycleGap } from "./score.js";
import { shuffle } from "./math.js";
import { defaults, fadeTimes } from "./config.js";
// options.generators: { name: (context, ...args) => score }, for scores that are generated each time
// they come round (see resolveScore in score.js, and the README, "Generated scores")
async function play(config, fieldElem, spels, paras, scores, options = {}) {
  const generators = options.generators ?? {};
  // `config` is read live (a page can set config.running = false to stop the piece), so it is not
  // copied. The legacy name startingPoint is accepted for startPara, and a config that did not
  // come from createConfig plays as it always did (missing keys take no new defaults)
  const startPara = config.startPara ?? config.startingPoint ?? 0;
  // slower is the legacy name of durationScale (a config spreading the legacy defaultConfig has it)
  const durationScale = config.durationScale ?? config.slower ?? defaults.durationScale;
  const fieldFadeMs = config.fieldFadeMs ?? defaults.fieldFadeMs;
  // (a config without it, such as one spreading the legacy defaultConfig, keeps the 500 it always had; createConfig's default is 800)
  const clearPauseMs = config.clearPauseMs ?? 500;
  const devLog = createDevLog(config);
  // sleep that also honours the live flags config.paused (hold here) and config.skip (cut this wait short),
  // once they exist in the config (see bindKeys in controls.js); without them it is a plain sleep
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
    fadeUnit = { shown: [], lastAt: 0 }, // the spels shown since the last fade-out of a whole score / ofld / cycle, and when the last appeared
    fadeEnd = 0, // when (Date.now) the last scheduled fade-out of the score is due
    autoFade = false,
    fadePause = 0,
    fadeWords = config.fadeWords,
    idx,
    lastSettings = {},
    loopCount = 0,
    loopMsg,
    // with config.cycleScores a pass plays every score in turn, so there is one "paragraph" to the cycle
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
   // >>> show whatever is currently visible in the field element
  if (resolveFade(config).out !== "window" || config.fadeWords < 1) {
    devLog(">>> show whatever is currently visible in the field element");
    fieldElem.style.opacity = 1;
  }
  // <<<
  await sleep(config.interCycleMs); // pause before starting
  //
  // allows you to set a different fadeWords value for each paragraph
 while (config.running) { // stopped with false in config
    // a fadeWords for each paragraph, if config.paraFadeWords is given (looked up on every pass)
    if (config.paraFadeWords) fadeWords = config.paraFadeWords[paraNum] ?? config.fadeWords;
    if (paraNum == startPara) cycStart = Date.now();
    // looping forever ...
    loopMsg = `loop: ${loopCount++}`;
    // one score per paragraph pass, or (config.cycleScores) every score, in order
    const passScores = config.cycleScores ? scores.map((_, i) => i) : [scoreNum];
    for (const sNum of passScores) {
    if (!config.running) break;
    // what fades the spels out, and how (fadeOut, fadeStyle: the config's or this score's; see resolveFade)
    const fade = resolveFade(config, config.scoreSettings?.[sNum] ?? {});
    const fopt = fadeOptions(config, config.scoreSettings?.[sNum] ?? {});
    const unitFade = fade.out === "score" || fade.out === "ofld" || fade.out === "cycle"; // the engine fades whole units
    if ("skip" in config) config.skip = false; // (a skip asked for during the last gap is not carried into this score)
    // the old wipe (fadeWords 0) faded the whole field out after the previous paragraph: bring it back
    if (fade.out === "field") fieldElem.style.opacity = 1;
    // per-score overrides, from config.scoreSettings[sNum] (see README, "Per-score settings"):
    // durationScale and interScoreMs replace the config's for this score (slower is the old name); effect is the class toggled
    // (default "visible"); shuffle plays the score's items in a new random order each time
    const settings = config.scoreSettings?.[sNum] ?? {};
    const scale = settings.durationScale ?? settings.slower ?? durationScale;
    const interScoreMs = scoreGap(sNum, { config, settings, paras, spels }); // the unit it ends may have its own gap
    lastSettings = settings;
    // a score's own fadeMs / fadeInMs / fadeOutMs (CSS transition times of that score's spels, in and out; pages use them
    // through --fade-in / --fade-out, see typeCss; not scaled by durationScale). What a score does not say is left to the config's
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
    // TODO - ALLOW MULTIPLE SCORES PER PARA (scoreNum goes to 0 on paraNum change)
    devLog(sNum, paraNum);
    // a score is an array of items, or the name of one of options.generators (made anew every time)
    score = resolveScore(scores[sNum], { spels, paras, scores, config, scoreNum: sNum }, generators);
    if (settings.shuffle) score = shuffle(score);
    // devLog(scoreSet, "scoreNum", sNum, scoreSet[sNum]); // DEBUG
    devLog("scores:",scores); // DEBUG
    devLog("score:", sNum, "score items:", score.length);
    //
    // This is where we inner-loop through each item in the current score and
    // display the string of its spel for the length of time in its duration property.
    const readTimes = readingTimes(score, spels); // for the fade-outs
    // fadeOut "score" / "ofld": what this score shows, in order, with the time it holds (ms) until the next
    // one: the unit is faded out together, or in sequence, once it is over (see below)
    const unitShown = fadeUnit.shown;
    // revealStyle "together": all this score's spels appear at once (at its first spel), then its durations are waited out
    const revealTogether = fopt.reveal === "together" && unitFade;
    let revealed = false;
    for (idx = 0; idx < score.length; idx++) {
      while (config.paused && config.running) await sleep(50); // (holds here while paused)
      if (!config.running || config.skip) break;
      let spelId = score[idx].id;
      // an 'AUTOFADE' score item can override the config.fadeWords default
      if (spelId === "AUTOFADE") {
        devLog("autoFade");
        // calculate autofade pause based on number of fadeWords
        autoFade = true; // an explicit request in the score: window fading, whatever fadeOut says
        fadeWords = score[idx].pause; // repurposing the pause property for AUTOFADE spels (a word count, not a duration)
        fadePause = sumDurations(score, idx, fadeWords);
        devLog("In-score AUTOFADE of:", fadeWords, "at score:", sNum, "item:", idx);
        continue;
      }
      // >>> provide some info:
      let str = "[pause]";
      if (spelId !== "PAUSE") {
        str = spels.get(spelId);
        if (str !== undefined) str = str.string;
        // str contain the spel's html string
      }
      yieldMsg =
        loopMsg + `, score: ${sNum}, item: ${idx}, paraNum: ${paraNum}, id: ${spelId}, `;
      yieldMsg += `string: '${str}', duration: ${durationOf(score[idx])}`;
      // devLog(yieldMsg);
      // <<< (in other contexts:) yield yieldMsg;
      //
      // >>> these next lines do most of the WORK
      let elem;
      if (spelId !== "PAUSE") {
        // just pause and continue
        elem = document.getElementById(spelId);
        if (revealTogether) {
          if (!revealed) {
            revealed = true;
            const first = new Map(); // each spel once, with the duration of its first item
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
        // DEBUG devLog(elem.innerHTML);
        // The fade-out is timed from now, by the reading time of this spel and the next fadeWords
        // (fadeDelay), not by their score durations where those carry end-of-unit whitespace (line
        // breaks ...): that delays what is faded IN next, never what is faded OUT.
        const windowFades = fade.out === "window" || fade.legacy || autoFade; // (legacy: fadeWords alone decided)
        if (windowFades && fadeWords > 0) fadePause = fadeDelay(readTimes, idx, fadeWords);
        else if (!windowFades) fadePause = 0;
        if (fadePause > 0) {
          fadeEnd = Math.max(fadeEnd, Date.now() + fadePause * scale);
          sleep(fadePause * scale).then(() => toggleSpel(elem, config, toggleOpts));
        }
      }
      // pause for both actual spels and PAUSE items
      await nap(durationOf(score[idx]) * scale); // durations usually taken from the temporal data
    } // end of loop thru current score
    // pause between scores: wait for the last fade-out (scored: durationScale, the score's), then the
    // gap (not scored). The fade-outs run on their own clock, so they may already be done.
    await nap(Math.max(0, fadeEnd - Date.now()) + interScoreMs * durationScale);
    fadeEnd = 0;
    // >>> fade out the unit: the whole field after each score (the old fadeWords 0), or the score's
    // spels (fadeOut "score"), or the ofld's, once the score that ends it is over (fadeOut "ofld")
    if (fade.out === "field") {
      devLog(">>> remove old paragraph");
      fieldElem.style.opacity = 0;
      await sleep((fieldFadeMs + 250) * durationScale);
      paras[paraNum].forEach(p => hideSpel(document.getElementById(p), config, toggleOpts));
      await sleep((settings.clearPauseMs ?? clearPauseMs) * durationScale);
    } else if (unitFade) {
      // the unit is over after each score ("score"), after the one that ends its ofld ("ofld", which an ofld-less
      // score does too), or after the cycle's last score ("cycle"); with cycleScores no ofld ends before that
      const lastOfCycle = sNum === scores.length - 1;
      const unitOver = fade.out === "score" || lastOfCycle || (fade.out === "ofld" && !config.cycleScores && endsOfld(sNum, { paras, spels }));
      if (unitOver && config.running) {
        // the whole unit has shown for at least holdMs (counted from its last spel)
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
          await nap((settings.clearPauseMs ?? clearPauseMs) * scale); // before the next score starts (the score's own, if it has one)
        } else {
          fadeThem(); // goes on while the next score starts
          await nap(fopt.overlapMs * scale);
        }
      }
    }
    if ("skip" in config) config.skip = false; // (the skip, if any, is spent)
    // <<<
    } // end of loop thru this pass's scores
    // bump paraNum if needed
    paraNum = ++paraNum % numParas;
    // can set a higher starting point in config, usually for debugging
    if (paraNum == 0) paraNum += startPara;
    //
    if (paraNum == startPara) {
      devLog("--- end of cycle --- Duration:", msToTime(Date.now() - cycStart)); // DEBUG
      await sleep(cycleGap({ config, settings: lastSettings }) * durationScale); // end of cycle pause
      if (config.creditsPauseMs > 0) {
        const bl = document.getElementById("byline"); // optional element
        if (bl) bl.style.opacity = 1;
        await sleep(config.creditsPauseMs * durationScale); // credits pause
        if (bl) bl.style.opacity = 0;
        await sleep(cycleGap({ config, settings: lastSettings }) * durationScale); // end of cycle pause
      }
    }
    // bump scoreNum
    scoreNum = ++scoreNum % scores.length;
  } // end of (endless) while loop
}
export { play }
