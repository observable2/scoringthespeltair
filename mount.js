// The set-up every player page used to repeat, in one call. Browser only.
//
//   const { mount } = await import("scoringthespeltair");   // or the jsDelivr URL
//   mount(config, fieldElem, { spels, paras, scores, measuredWith });
//   if (config.running) play(config, fieldElem, spels, paras, scores);
//
// It (1) checks the type against what the spels were measured at, if `measuredWith` (from the
// notebook's export) is given, and warns about differences; (2) puts the spels in the field;
// (3) splits them into characters if config.charFades; (4) centres the field on the extent of its
// spels. `spels` is a Map of id -> spel, as the pages build it from spels.json. The page's CSS (or
// typeCss) must already set the type, and #field's font weight etc.
import { checkMeasuredWith } from "./config.js";
import { splitIntoChars } from "./display.js";
import { centerField } from "./center.js";

// pass `center: false` for a page that positions the field itself (e.g. shi's grid)
function mount(config, fieldElem, { spels, measuredWith, center = true } = {}) {
  if (measuredWith) {
    for (const d of checkMeasuredWith(measuredWith, config))
      console.warn(`scoringthespeltair: ${d}; spels will be misplaced`);
  }
  fieldElem.innerHTML = Array.from(spels.values(), (spel) => spel.html).join("");
  if (config.charFades) splitIntoChars(fieldElem);
  return center ? centerField(fieldElem) : undefined;
}

export { mount };
