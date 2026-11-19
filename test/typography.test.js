// typeCss: the family names the bundled variable font first, then the plain name
import { test } from "node:test";
import assert from "node:assert/strict";
import { typeCss } from "../typography.js";

test("typeCss: font-family lists 'Name Variable' (fontsource) before 'Name' (Google Fonts), then serif", () => {
  assert.match(typeCss({}), /font-family: 'Source Serif 4 Variable', 'Source Serif 4', serif;/);
  assert.match(typeCss({ fontFamily: "Spline Sans Mono" }, "#field"), /#field \{\n  font-family: 'Spline Sans Mono Variable', 'Spline Sans Mono', serif;/);
});

test("typeCss: a family already named Variable is not doubled", () => {
  const css = typeCss({ fontFamily: "Inter Variable" });
  assert.match(css, /font-family: 'Inter Variable', serif;/);
});

test("typeCss: the rest is unchanged (size, weight, line height, ligatures, opsz, fade variables)", () => {
  const css = typeCss({ fontSizeVw: 2.3, fontWeight: 400, lineHeight: 1.5, opsz: null });
  assert.match(css, /font-size: 2.3vw;/);
  assert.match(css, /font-weight: 400;/);
  assert.match(css, /line-height: 1.5;/);
  assert.doesNotMatch(css, /opsz/);
  assert.match(css, /--fade-in: 1300ms;/);
  assert.match(css, /--fade-out: 1300ms;/);
});

test("typeCss: fadeInMs and fadeOutMs set the two variables; the old variables follow the fade-in; old key names are read", () => {
  const css = typeCss({ fadeMs: 800, fadeOutMs: 2500 });
  assert.match(css, /--fade-in: 800ms;/);
  assert.match(css, /--fade-out: 2500ms;/);
  assert.match(css, /--spel-fade: 800ms;/);
  assert.match(css, /--char-fade: 800ms;/);
  assert.match(typeCss({ charFades: false, spelFadeMs: 1500, charFadeMs: 700 }), /--fade-in: 1500ms;/);
  assert.match(typeCss({ charFadeMs: 700 }), /--fade-out: 700ms;/);
});
