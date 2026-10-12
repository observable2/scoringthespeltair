import { sleep } from "./timing.js";

// toggles the visibility of each character in a spel one at a time,
// with a delay (config.charIntervalMs) after each character that becomes visible
async function charToggle(spel, config) {
  const chars = Array.from(spel.children);
  for (const char of chars) {
    char.classList.toggle("visible");
    await sleep(char.classList.contains("visible") ? config.charIntervalMs : 0);
  }
}

// shows or hides a spel element, character by character if config.charFades
async function toggleSpel(elem, config) {
  if (config.charFades) {
    await charToggle(elem, config);
  } else {
    elem.classList.toggle("visible");
  }
}

export { toggleSpel };
