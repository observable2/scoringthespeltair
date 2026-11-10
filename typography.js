// CSS for the type the spels are measured and shown in, from the config, so that the notebook that
// measures the text and the player that shows it cannot drift apart. Pure string functions: no
// browser needed, the engine applies nothing itself; the page puts the result in a <style>.
import { defaults } from "./config.js";

// typeCss(config, selector = ".set") -> CSS text: the type declarations for `selector` (the
// notebook's galley is ".set", the player's field "#field") and, on `:root`, the fade times as
// custom properties (--spel-fade, --char-fade, --field-fade) for the page's transitions:
//   .spel { transition: opacity var(--spel-fade, 1.5s) ease-in-out }
// A key missing from `config` takes the engine's default.
function typeCss(config, selector = ".set") {
  const c = { ...defaults, ...config };
  const opsz = c.opsz === null || c.opsz === undefined ? "" : `\n  font-variation-settings: "opsz" ${c.opsz};`;
  return `:root {
  --spel-fade: ${c.spelFadeMs}ms;
  --char-fade: ${c.charFadeMs}ms;
  --field-fade: ${c.fieldFadeMs}ms;
}
${selector} {
  font-family: '${c.fontFamily}', serif;
  font-size: ${c.fontSizeVw}vw;
  font-weight: ${c.fontWeight};
  line-height: ${c.lineHeight};
  font-variant-ligatures: ${c.ligatures};${opsz}
}`;
}

export { typeCss };
