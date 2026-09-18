import { mod, sleep, msToTime } from "./utils.js";
async function play(config, displayElem, spels, paras, scores) {
  console.log("entered play()", scores);
  let cycStart,
    fadePause = 0,
    fadeWords = config.fadeWords,
    idx,
    loopCount = 0,
    loopMsg,
    paraNum = config.startingPoint,
    numParas = paras.length,
    prevScore,
    rdnScore,
    score,
    scoreName,
    scoreNum = 0,
    toggle = true,
    yieldMsg;
   // >>> show whatever is currently visible in the display element
  if (config.fadeWords < 1 ) {
    console.log(">>> show whatever is currently visible in the display element");
    displayElem.style.opacity = 1;
  }
  // <<<
  await sleep(config.interCycle); // pause before starting
  //
  // allows you to set a different fadeWords value for each paragraph
 if (typeof config.paraFadeWords != "undefined") fadeWords = config.paraFadeWords[paraNum];
 while (config.running) { // stopped with false in config
    if (paraNum == config.startingPoint) cycStart = Date.now();
    // looping forever ...
    loopMsg = `loop: ${loopCount++}`;
    // TODO - ALLOW MULTIPLE SCORES PER PARA (scoreNum goes to 0 on paraNum change)
    console.log(scoreNum, paraNum);
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
    // console.log(scoreSet, "scoreNum", scoreNum, scoreSet[scoreNum]); // DEBUG
    console.log("scores:",scores); // DEBUG
    console.log("score:", scoreNum, "score items:", score.length);
    //
    // This is where we inner-loop through each item in the current score and
    // display the string of its spel for the length of time in its pause property.
    for (idx = 0; idx < score.length; idx++) {
      if (!config.running) break;
      let spelId = score[idx].id;
      // an 'AUTOFADE' score item can override the config.fadeWords default
      if (spelId === "AUTOFADE") { 
        console.log("autoFade");
        // calculate autofade pause based on number of fadeWords
        fadePause = 0;
        fadeWords = score[idx].pause; // repurposing the pause property for AUTOFADE spels
        for (let fi = 0; fi < fadeWords; ++fi) {
          let fidx = (idx + fi + 1) % score.length;
          fadePause += score[fidx].pause;
        }
        console.log("In-score AUTOFADE of:", fadeWords, "at score:", scoreNum, "item:", idx);
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
      // console.log(yieldMsg);
      // <<< (in other contexts:) yield yieldMsg;
      //
      // >>> this defines a function that toggles the visibility of each character in a spel
      // one at a time, with a delay between each one
      // called below if config.charFades is true
      const charToggle = async (spel) => {
        const chars = Array.from(spel.children);
        for (const char of chars) {
          char.classList.toggle("visible");
          // DEBUG console.log(letter.textContent);
          await sleep(char.classList.contains("visible") ? config.charInterval : 0);
        }
      }
      // <<<
      // >>> these next lines most of the WORK
      let elem;
      if (spelId !== "PAUSE") {
        // just pause and continue
        elem = document.getElementById(spelId);
        if (config.charFades) {
          await charToggle(elem);
        } else {
          elem.classList.toggle("visible");
        }
        // DEBUG console.log(elem.innerHTML);
      }
      // pause for both actual spels and PAUSE items
      await sleep(score[idx].pause * config.slower); // pauses usually taken from the temporal data
      if (spelId === "PAUSE") continue;
      // not a pause item, so check for fadeWords
      if (fadeWords > 0) {
        fadePause = 0;
        for (let fi = 0; fi < fadeWords; ++fi) {
          let fidx = mod((fi + idx + 1), score.length);
          fadePause += score[fidx].id != "PAUSE" ? score[fidx].pause : 0;
        }
      }
      if (fadePause > 0) {
        // let ridx = mod(idx - fadeWords, score.length);
        // fadePause += score[idx].pause - score[ridx].pause;
        sleep(fadePause * config.slower).then(async () => {
          if (config.charFades) {
            await charToggle(elem);
          } else {
            elem.classList.toggle("visible");
          }
        });
      }
    } // end of loop thru current score
    // DEBUG console.log("fadePause", fadePause, "interScr", config.interScore);
    await sleep((fadePause + config.interScore) * config.slower); // pause between scores
    // >>> remove old paragraph:
    if (config.fadeWords === 0) {
      console.log(">>> remove old paragraph");
      displayElem.style.opacity = 0;
      await sleep(275 * config.slower);
      paras[paraNum].forEach(p => document.getElementById(p).classList.toggle("visible"));
      await sleep(50 * config.slower);
    }
    // <<<
    // bump paraNum if needed
    paraNum = ++paraNum % numParas;
    // can set a higher starting point in config, usually for debugging
    if (paraNum == 0) paraNum += config.startingPoint;
    //
    if (paraNum == config.startingPoint) {
      console.log("--- end of cycle --- Duration:", msToTime(Date.now() - cycStart)); // DEBUG
      await sleep(config.interCycle * config.slower); // end of cycle pause
      if (config.creditsPause > 0) {
        let bl = document.getElementById("byline");
        bl.style.opacity = 1;
        await sleep(config.creditsPause * config.slower); // credits pause
        bl.style.opacity = 0;
        await sleep(config.interCycle * config.slower); // end of cycle pause
      }
    }
    // bump scoreNum
    scoreNum = ++scoreNum % scores.length;
  } // end of (endless) while loop
}
export { play }
