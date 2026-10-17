import { sleep, msToTime } from "./timing.js";
import { createDevLog } from "./dev.js";
import { toggleSpel } from "./display.js";
import { sumPauses } from "./score.js";
async function play(config, fieldElem, spels, paras, scores) {
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
    numParas = paras.length,
    paraNum = config.startingPoint,
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
 if (typeof config.paraFadeWords != "undefined") fadeWords = config.paraFadeWords[paraNum];
 while (config.running) { // stopped with false in config
    if (paraNum == config.startingPoint) cycStart = Date.now();
    // looping forever ...
    loopMsg = `loop: ${loopCount++}`;
    // TODO - ALLOW MULTIPLE SCORES PER PARA (scoreNum goes to 0 on paraNum change)
    devLog(scoreNum, paraNum);
    score = scores[scoreNum];
    // >>> (currently) unused mechanism for generating quasi-random scores on the fly (see 'Uchaf'):
    // if (typeof scores[scoreNum] === "string") {
    //   switch (scores[scoreNum]) {
    //     case "schorus":
    //       // score = schorus();
    //       break;
    //     default:
    //       throw new Error("unknown score-building function name");
    //   }
    //   prevScore = score;
    // } else {
    //   score = scores[scoreNum];
    // }
    // <<<
    // devLog(scoreSet, "scoreNum", scoreNum, scoreSet[scoreNum]); // DEBUG
    devLog("scores:",scores); // DEBUG
    devLog("score:", scoreNum, "score items:", score.length);
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
        devLog("In-score AUTOFADE of:", fadeWords, "at score:", scoreNum, "item:", idx);
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
        loopMsg + `, score: ${scoreNum}, item: ${idx}, paraNum: ${paraNum}, id: ${spelId}, `;
      yieldMsg += `string: '${str}', pause: ${score[idx].pause}`;
      // devLog(yieldMsg);
      // <<< (in other contexts:) yield yieldMsg;
      //
      // >>> these next lines do most of the WORK
      let elem;
      if (spelId !== "PAUSE") {
        // just pause and continue
        elem = document.getElementById(spelId);
        await toggleSpel(elem, config);
        // DEBUG devLog(elem.innerHTML);
      }
      // pause for both actual spels and PAUSE items
      await sleep(score[idx].pause * config.slower); // pauses usually taken from the temporal data
      if (spelId === "PAUSE") continue;
      // not a pause item, so check for fadeWords
      if (fadeWords > 0) {
        fadePause = sumPauses(score, idx, fadeWords, { skipPauses: true });
      }
      if (fadePause > 0) {
        // let ridx = mod(idx - fadeWords, score.length);
        // fadePause += score[idx].pause - score[ridx].pause;
        sleep(fadePause * config.slower).then(() => toggleSpel(elem, config));
      }
    } // end of loop thru current score
    // DEBUG devLog("fadePause", fadePause, "interScr", config.interScoreMs);
    await sleep((fadePause + config.interScoreMs) * config.slower); // pause between scores
    // >>> remove old paragraph:
    if (config.fadeWords === 0) {
      devLog(">>> remove old paragraph");
      fieldElem.style.opacity = 0;
      await sleep(2750 * config.slower);
      paras[paraNum].forEach(p => document.getElementById(p).classList.toggle("visible"));
      await sleep(500 * config.slower);
    }
    // <<<
    // bump paraNum if needed
    paraNum = ++paraNum % numParas;
    // can set a higher starting point in config, usually for debugging
    if (paraNum == 0) paraNum += config.startingPoint;
    //
    if (paraNum == config.startingPoint) {
      devLog("--- end of cycle --- Duration:", msToTime(Date.now() - cycStart)); // DEBUG
      await sleep(config.interCycleMs * config.slower); // end of cycle pause
      if (config.creditsPauseMs > 0) {
        let bl = document.getElementById("byline");
        bl.style.opacity = 1;
        await sleep(config.creditsPauseMs * config.slower); // credits pause
        bl.style.opacity = 0;
        await sleep(config.interCycleMs * config.slower); // end of cycle pause
      }
    }
    // bump scoreNum
    scoreNum = ++scoreNum % scores.length;
  } // end of (endless) while loop
}
export { play }
