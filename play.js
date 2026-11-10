import { sleep, msToTime } from "./timing.js";
import { createDevLog } from "./dev.js";
import { toggleSpel } from "./display.js";
import { sumPauses } from "./score.js";
import { shuffle } from "./math.js";
import { defaults } from "./config.js";
async function play(config, fieldElem, spels, paras, scores) {
  // `config` is read live (a page can set config.running = false to stop the piece), so it is not
  // copied. The legacy name startingPoint is accepted for startPara, and a config that did not
  // come from createConfig plays as it always did (missing keys take no new defaults)
  const startPara = config.startPara ?? config.startingPoint ?? 0;
  // slower is the legacy name of durationScale (a config spreading the legacy defaultConfig has it)
  const durationScale = config.durationScale ?? config.slower ?? defaults.durationScale;
  const fieldFadeMs = config.fieldFadeMs ?? defaults.fieldFadeMs;
  const clearPauseMs = config.clearPauseMs ?? defaults.clearPauseMs;
  const devLog = createDevLog(config);
  const legacyKeys = ["charInterval", "interCycle", "interScore", "scoredPause", "creditsPause"].filter(k => k in config);
  if (legacyKeys.length) console.warn(`scoringthespeltair: config keys ${legacyKeys.join(", ")} are ignored; times are now milliseconds with an Ms suffix (e.g. interCycleMs)`);
  devLog("entered play()", scores);
  let cycStart,
    fadePause = 0,
    fadeWords = config.fadeWords,
    idx,
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
  if (config.fadeWords < 1 ) {
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
    // with fadeWords 0 the field was faded out after the previous paragraph: bring it back
    if (config.fadeWords === 0) fieldElem.style.opacity = 1;
    // per-score overrides, from config.scoreSettings[sNum] (see README, "Per-score settings"):
    // durationScale and interScoreMs replace the config's for this score (slower is the old name); effect is the class toggled
    // (default "visible"); shuffle plays the score's items in a new random order each time
    const settings = config.scoreSettings?.[sNum] ?? {};
    const scale = settings.durationScale ?? settings.slower ?? durationScale;
    const interScoreMs = settings.interScoreMs ?? config.interScoreMs;
    const toggleOpts = { effect: settings.effect, durationScale: settings.durationScale ?? settings.slower };
    // TODO - ALLOW MULTIPLE SCORES PER PARA (scoreNum goes to 0 on paraNum change)
    devLog(sNum, paraNum);
    score = scores[sNum];
    if (settings.shuffle) score = shuffle(score);
    // >>> (currently) unused mechanism for generating quasi-random scores on the fly (see 'Uchaf'):
    // if (typeof scores[sNum] === "string") {
    //   switch (scores[sNum]) {
    //     case "schorus":
    //       // score = schorus();
    //       break;
    //     default:
    //       throw new Error("unknown score-building function name");
    //   }
    //   prevScore = score;
    // } else {
    //   score = scores[sNum];
    // }
    // <<<
    // devLog(scoreSet, "scoreNum", sNum, scoreSet[sNum]); // DEBUG
    devLog("scores:",scores); // DEBUG
    devLog("score:", sNum, "score items:", score.length);
    //
    // This is where we inner-loop through each item in the current score and
    // display the string of its spel for the length of time in its pause property.
    for (idx = 0; idx < score.length; idx++) {
      if (!config.running) break;
      let spelId = score[idx].id;
      // an 'AUTOFADE' score item can override the config.fadeWords default
      if (spelId === "AUTOFADE") {
        devLog("autoFade");
        // calculate autofade pause based on number of fadeWords
        fadeWords = score[idx].pause; // repurposing the pause property for AUTOFADE spels
        fadePause = sumPauses(score, idx, fadeWords);
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
      yieldMsg += `string: '${str}', pause: ${score[idx].pause}`;
      // devLog(yieldMsg);
      // <<< (in other contexts:) yield yieldMsg;
      //
      // >>> these next lines do most of the WORK
      let elem;
      if (spelId !== "PAUSE") {
        // just pause and continue
        elem = document.getElementById(spelId);
        await toggleSpel(elem, config, toggleOpts);
        // DEBUG devLog(elem.innerHTML);
      }
      // pause for both actual spels and PAUSE items
      await sleep(score[idx].pause * scale); // pauses usually taken from the temporal data
      if (spelId === "PAUSE") continue;
      // not a pause item, so check for fadeWords
      if (fadeWords > 0) {
        fadePause = sumPauses(score, idx, fadeWords, { skipPauses: true });
      }
      if (fadePause > 0) {
        // let ridx = mod(idx - fadeWords, score.length);
        // fadePause += score[idx].pause - score[ridx].pause;
        sleep(fadePause * scale).then(() => toggleSpel(elem, config, toggleOpts));
      }
    } // end of loop thru current score
    // DEBUG devLog("fadePause", fadePause, "interScr", interScoreMs);
    // pause between scores: the fade-out is scored (durationScale, the score's), the gap is not
    await sleep(fadePause * scale + interScoreMs * durationScale);
    // >>> remove old paragraph:
    if (config.fadeWords === 0) {
      devLog(">>> remove old paragraph");
      fieldElem.style.opacity = 0;
      await sleep((fieldFadeMs + 250) * durationScale);
      paras[paraNum].forEach(p => document.getElementById(p).classList.toggle("visible"));
      await sleep(clearPauseMs * durationScale);
    }
    // <<<
    } // end of loop thru this pass's scores
    // bump paraNum if needed
    paraNum = ++paraNum % numParas;
    // can set a higher starting point in config, usually for debugging
    if (paraNum == 0) paraNum += startPara;
    //
    if (paraNum == startPara) {
      devLog("--- end of cycle --- Duration:", msToTime(Date.now() - cycStart)); // DEBUG
      await sleep(config.interCycleMs * durationScale); // end of cycle pause
      if (config.creditsPauseMs > 0) {
        const bl = document.getElementById("byline"); // optional element
        if (bl) bl.style.opacity = 1;
        await sleep(config.creditsPauseMs * durationScale); // credits pause
        if (bl) bl.style.opacity = 0;
        await sleep(config.interCycleMs * durationScale); // end of cycle pause
      }
    }
    // bump scoreNum
    scoreNum = ++scoreNum % scores.length;
  } // end of (endless) while loop
}
export { play }
