import { sleep } from "./timing.js";

// wraps each character of every spel in <span class="char"> (so toggleSpel can reveal a spel
// character by character) and makes the spel itself visible: the .char spans carry the opacity.
// Call it once the spels are in the DOM, when config.charFades is true.
function splitIntoChars(root, selector = ".spel") {
  for (const spel of root.querySelectorAll(selector)) {
    spel.innerHTML = [...spel.textContent].map(char => `<span class="char">${char}</span>`).join("");
    spel.style.opacity = 1;
  }
}

// toggles a class (default "visible") on each character in a spel one at a time, with a delay
// (config.charIntervalMs, times the duration scale) after each character that becomes visible
async function charToggle(spel, config, { effect = "visible", durationScale = 1 } = {}) {
  const chars = Array.from(spel.children);
  for (const char of chars) {
    char.classList.toggle(effect);
    await sleep(char.classList.contains(effect) && effect === "visible" ? config.charIntervalMs * durationScale : 0);
  }
}

// shows or hides a spel element, character by character if config.charFades.
// `effect` is the class toggled (default "visible"; a score's settings can name another, e.g. "glow")
// and `durationScale` multiplies the per-character delay (a score's own; see play.js). `slower` is accepted as its old name
async function toggleSpel(elem, config, { effect = "visible", durationScale, slower } = {}) {
  durationScale = durationScale ?? slower ?? 1;
  if (config.charFades) {
    await charToggle(elem, config, { effect, durationScale });
  } else {
    elem.classList.toggle(effect);
  }
}

export { toggleSpel, splitIntoChars };
