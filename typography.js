// CSS for the type the spels are measured and shown in, from the config, so that the notebook that
// measures the text and the player that shows it cannot drift apart. Pure string functions: no
// browser needed, the engine applies nothing itself; the page puts the result in a <style>.
import { defaults } from "./config.js";

// typeCss(config, selector = ".set") -> CSS text: the type declarations for `selector` (the
// notebook's galley is ".set", the player's field "#field") and, on `:root`, the fade times as
// custom properties (--spel-fade, --char-fade, --field-fade) for the page's transitions:
//   .spel { transition: opacity var(--spel-fade, 1.5s) ease-in-out }
// A key missing from `config` takes the engine's default.
//
// The family is listed twice, "Name Variable" first: fontsource's variable fonts (what the pages'
// custom.tmpl bundles) register as "Name Variable", while the notebooks load plain "Name" from Google
// Fonts. Naming only "Name" would show a font the viewer happens to have installed, never the bundled one.
function typeCss(config, selector = ".set") {
  const c = { ...defaults, ...config };
  const family = /\sVariable$/.test(c.fontFamily) ? `'${c.fontFamily}'` : `'${c.fontFamily} Variable', '${c.fontFamily}'`;
  const opsz = c.opsz === null || c.opsz === undefined ? "" : `\n  font-variation-settings: "opsz" ${c.opsz};`;
  return `:root {
  --spel-fade: ${c.spelFadeMs}ms;
  --char-fade: ${c.charFadeMs}ms;
  --field-fade: ${c.fieldFadeMs}ms;
}
${selector} {
  font-family: ${family}, serif;
  font-size: ${c.fontSizeVw}vw;
  font-weight: ${c.fontWeight};
  line-height: ${c.lineHeight};
  font-variant-ligatures: ${c.ligatures};${opsz}
}`;
}

export { typeCss };
