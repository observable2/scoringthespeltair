// CSS for the type the spels are measured and shown in, from the config, so that the notebook that
// measures the text and the player that shows it cannot drift apart. Pure string functions: no
// browser needed, the engine applies nothing itself; the page puts the result in a <style>.
import { defaults, fadeTimes } from "./config.js";

// typeCss(config, selector = ".set") -> CSS text: the type declarations for `selector` (the
// notebook's galley is ".set", the player's field "#field") and, on `:root`, the fade times as
// custom properties for the page's transitions (see fadeMs, fadeInMs, fadeOutMs): --fade-in (a spel or
// character appearing), --fade-out (disappearing) and --field-fade. The page's CSS has one rule for each
// direction, since a transition counts for the state it moves to:
//   .char         { opacity: 0; transition: opacity var(--fade-out, 1.3s) ease-in-out }
//   .char.visible { opacity: 1; transition: opacity var(--fade-in, 1.3s) ease-in-out }
// (--spel-fade and --char-fade, the former names, are still set, to the fade-in time, for pages that use them)
// A key missing from `config` takes the engine's default.
//
// The family is listed twice, "Name Variable" first: fontsource's variable fonts (what the pages'
// custom.tmpl bundles) register as "Name Variable", while the notebooks load plain "Name" from Google
// Fonts. Naming only "Name" would show a font the viewer happens to have installed, never the bundled one.
function typeCss(config, selector = ".set") {
  const c = { ...defaults, ...config };
  const t = fadeTimes(config, c.charFades); // fadeMs, or its old names spelFadeMs / charFadeMs, if the config has them
  const fadeIn = t.inMs ?? defaults.fadeMs, fadeOut = t.outMs ?? defaults.fadeMs;
  const family = /\sVariable$/.test(c.fontFamily) ? `'${c.fontFamily}'` : `'${c.fontFamily} Variable', '${c.fontFamily}'`;
  const opsz = c.opsz === null || c.opsz === undefined ? "" : `\n  font-variation-settings: "opsz" ${c.opsz};`;
  return `:root {
  --fade-in: ${fadeIn}ms;
  --fade-out: ${fadeOut}ms;
  --spel-fade: ${fadeIn}ms;
  --char-fade: ${fadeIn}ms;
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
