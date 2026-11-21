# scoringthespeltair

Shared playback engine for Observable notebook-kit "spel" poem projects
(originally factored out of the `reading` project). Provides the timed
show/hide animation loop that plays a sequence of "spels" according to a
score, plus small utility helpers.

## Exports

Everything below except `timetoread-rita.js` is re-exported from the
package root, so `import { play, createConfig, sleep } from
"scoringthespeltair"` works; or import the individual files:

- `play.js`: `play(config, fieldElem, spels, paras, scores, { generators })`
  (the last argument is optional)
- `config.js`: `createConfig`, `expandScoreSettings`, `normalizeConfig`,
  `fadeTimes`, `configSchema`, `configAliases`, `defaults`, `measuredWith`,
  `checkMeasuredWith`, and the legacy `defaultConfig`
- `controls.js`: `bindKeys`
- `display.js`: `toggleSpel`, `hideSpel`, `splitIntoChars` (wraps each
  character of every spel in a `.char` span, for `charFades`)
- `score.js`: `durationOf`, `sumDurations` (once `sumPauses`), `pauseItem`,
  `toggleItems`, `scoreFromTimings`, `resolveScore`, and the helpers
  `play()` is built from: `scoreGap`, `cycleGap`, `endsField`, `endsOfld`,
  `resolveFade`, `fadeOptions`, `readingTimes`, `fadeDelay`
- `typography.js`: `typeCss(config, selector)`, the type CSS and the
  fade-time variables, from the config (no browser needed)
- `mount.js`: `mount(config, fieldElem, { spels, measuredWith, center })`
  (browser only): puts the spels in the field, splits them into characters
  if `charFades`, centres the field
- `center.js`: `centerField` (browser only)
- `text.js`: `normalizeToken` (the default `normalize` of the RiTa estimator)
- `timetoread.js`: `timeToRead`, `wordTime`, `whitespaceTime`, `spelTime`,
  `timeToReadDefaults` (no dependencies)
- `timetoread-rita.js`: `timeToReadRita`, `createTimeToReadRita`,
  `timeToReadRitaDefaults` (needs `rita`; not in the root export)
- `timing.js`: `sleep`, `msToTime`; `math.js`: `mod`, `shuffle`;
  `dev.js`: `createDevLog`

## Usage

Each consuming project keeps its own content (`spels.json`, `paras.json`,
`scores.json`) and a config made with `createConfig`:

```js
import { createConfig } from "scoringthespeltair/config.js";

export const config = createConfig({
  fadeOut: "ofld", // only what differs from the engine's defaults
});
```

```js
const { play } = await import("scoringthespeltair/play.js");
play(config, fieldElem, spels, paras, scores);
```

A project made from the scoring template (`nbks/scoring-template.html`)
has the notebook **export** `config.json` with the data, and the player
reads it:

```js
import { createConfig, typeCss, mount, play } from "scoringthespeltair";
// (or the jsDelivr URL, see Releases)
const config = createConfig(await FileAttachment("./data/config.json").json(),
  { /* player-only overrides */ });
// in a <style>: ${typeCss(config, "#field")} gives the field the type the
// notebook measured
const spels = new Map(await FileAttachment("./data/spels.json").json());
mount(config, fieldElem, { spels });
if (config.running) play(config, fieldElem, spels,
  await FileAttachment("./data/paras.json").json(),
  await FileAttachment("./data/scores.json").json());
```

## Configuration

`configSchema` in `config.js` defines every setting once: default, scope
and a line of documentation (the notebook shows it as a table; read that
for the keys and defaults). `createConfig(overrides)` is the defaults plus
your overrides, with legacy names mapped to current ones and a console
warning for a key it does not know (a typo would otherwise be ignored) or
that is retired. Keys of your own are kept.

Each setting has one of three scopes:

| Scope | What it is | Who must agree |
|---|---|---|
| `measure` | type and layout the spels are measured in | notebook, player |
| `play` | read by `play()` | the player |
| `page` | applied by the page's CSS | the pages |

The spel data depends on the `measure` keys: `typeCss` writes them as CSS
for both notebook and player, `measuredWith(config)` is exported as
`measured.json`, and `mount()` warns if a page's type differs. `typeCss`
writes the `page` keys (`fadeMs`, `fadeInMs`, `fadeOutMs`) as `--fade-in`
and `--fade-out`, and `fieldFadeMs` as `--field-fade`.

Two notes: `running` is read live, so a page can stop the piece by
setting it; with `cycleScores` off the first score played is still
`scores[0]` whatever `startPara` is. `durationScale` scales everything but
the CSS fade times.

**Adding a setting:** add it to `configSchema` (default, scope, doc); if
the pages apply it, to `typeCss` too. If `play()` reads it, a `config.x ??
defaults.x` fallback keeps a config not made by `createConfig` working.

### Old names

Old names still work (through 1.x) and are mapped by `createConfig` and
`play()`. Use the new ones in new work.

| Old | Now |
|---|---|
| `startingPoint` | `startPara` (wins if both are given) |
| `slower` | `durationScale` |
| `spelFadeMs`, `charFadeMs` | `fadeMs` |
| item `pause` | item `duration` |
| `fadeWords` 0, -1 | `fadeOut` |
| `numParas`, `scoredPauseMs` | (retired) |

- `durationScale` and `fadeMs` also work inside `scoreSettings` entries;
  `durationScale` is `toggleSpel`'s option too. `charFadeMs` counts as
  `fadeMs` with `charFades`, else `spelFadeMs`.
- `durationOf` reads either `duration` or `pause`; `AUTOFADE` items keep
  `pause` (a word count).
- `numParas`, `scoredPauseMs` are never read; `createConfig` warns.

`scripts/migrate-scores-to-duration.js` renames `pause` to `duration` in a
`scores.json` (`--write` to overwrite; otherwise it prints). Timing keys
without the `Ms` suffix (`interCycle`, `charInterval` ...) are ignored with
a warning: see [Units](#units-milliseconds-everywhere).

### Legacy: `defaultConfig`

The 0.x object, kept as it was (plus `cycleScores` and `PRODUCTION`) so
that a project that spreads it plays exactly as before: `reunion`, `shi`
and `reading` do. Its values differ from the new defaults: `slower` 1.3
(now `durationScale`; reading relies on it, so moving over means
`durationScale: 1.3`), `fontWeight` 400, and no `clearPauseMs` (`play()`
then uses 500), `interParaMs`, `interFieldMs` or `startPara`. A config
without the gap keys gets `interScoreMs` throughout. New projects use
`createConfig`.

### `ofld`, `sctn`, `chpt`

An **`ofld` (open field) is a screen**: the scene, of any length, on
display at one time. The notebook measures every spel from the top of its
ofld, and the player is free to show one ofld after another at the same
origin. The engine does not yet play an ofld as a unit: it plays `paras`
in order, and uses the ofld only to decide where a field ends
(`interFieldMs`, `fadeOut: "ofld"`). `sctn` and `chpt` are **measurement
only**: every spel records its section and chapter, nothing uses them.

## Per-score settings

A piece that is one poem played through several scores (a read-in, a
pulse, an erasure ...) may need each score to behave differently. Two
config keys, both optional:

- `cycleScores: true`: one cycle plays **every** score in `scores.json`, in
  order (the default is one score per paragraph, `paras[i]` with
  `scores[i]`). There is then a single "paragraph" to the cycle.
- `scoreSettings`: an array indexed by score number; each entry may hold
  - `durationScale`: replaces the config's for this score: its durations,
    fade timings and per-character delay. `0` plays the score at once.
  - `interScoreMs`, `interParaMs`, `interFieldMs`, `interCycleMs`: the
    gaps after this score (see [Gaps](#gaps-between-units)); they are
    scaled by the *config's* `durationScale`, not the score's.
  - `effect`: the class toggled on the spel (or its characters), default
    `"visible"`. Another name (e.g. `"glow"`) gives a highlight on text
    already visible; the page's CSS defines it, and only `"visible"` gets
    the `charIntervalMs` delay between characters.
  - `shuffle: true`: the score's items are played in a new random order
    each time.
  - the fading keys: `fadeOut`, `fadeStyle`, `fadeOrder`, `fadeStaggerMs`,
    `holdMs`, `overlapMs`, `revealStyle`, `clearPauseMs`, `fadeMs`,
    `fadeInMs`, `fadeOutMs` (see [Fading out](#fading-out-fadeout-and-fadestyle)).

A score with no entry (or no `scoreSettings`) takes the config's values;
an entry may be `null`. See `shi/nbks/data/maple-bridge/config.js`.

**Writing only the scores that differ.** `expandScoreSettings(perScore, n)`
(`config.js`, exported) builds the array from an object naming only those
scores, once you know `n` (the notebook's export cell does; its config
cell cannot):

```js
const perScore = { 0: { interFieldMs: 3500 },
  last: { interFieldMs: 3500, interCycleMs: 8000 } };
const config = createConfig({ ...,
  scoreSettings: expandScoreSettings(perScore, scores.length) });
```

The keys, from the least to the most specific (settings of several keys
naming one score are merged, the more specific winning): `"all"`,
`"first"`, `"last"`, and a score number (from 0; negative numbers count
from the end, so `-1` is the last). A score none of them names gets `null`
(`play()` skips it, so the array can go into JSON). An unknown key, or a
number outside the scores, throws.

## Fading out: `fadeOut` and `fadeStyle`

`fadeOut` says **what** fades the spels; `fadeStyle` says **how** (a score
may override either in `scoreSettings`):

- `"window"`: each spel fades `fadeWords` spels after it appears (see
  [When spels fade out](#when-spels-fade-out-fadeout-window)).
- `"scored"`: the engine never fades; the score does, with `toggleItems`
  or items with `duration: 0`, item by item.
- `"score"`: items only show (their durations are display times); after
  the last item and its gap the score's spels fade.
- `"ofld"`: as `"score"`, but the spels stay while the field (ofld) goes
  on: after the score that ends the ofld, and its gap, the whole ofld
  fades. The cycle's last score ends it too (with `cycleScores` nothing
  else does). Spels without a recorded `ofld` count as ending one at
  every score.
- `"cycle"`: nothing fades until the cycle's last score and its gap are
  over, then everything fades: a piece that builds up.

`fadeStyle` (with `"score"`, `"ofld"`, `"cycle"`): `"together"` (the
default) fades the spels all at once; `"sequence"` fades them in the order
shown, each after the item's own `duration` (times `durationScale`). Then
`clearPauseMs` passes before the next score starts.

Refinements of a `"score"` / `"ofld"` / `"cycle"` fade (times in ms,
scaled by the score's `durationScale`; each can be set per score):

| Key | Default | Meaning |
|---|---|---|
| `fadeOrder` | `"shown"` | `"sequence"` order: `"reverse"`, `"random"` |
| `fadeStaggerMs` | none | fixed step, in place of item durations |
| `clearPauseMs` | 1300 | dark time after the fade |
| `holdMs` | 0 | least time the unit stays showing |
| `overlapMs` | none | start the next score during the fade |
| `revealStyle` | `"sequence"` | how a score's spels appear |
| `fadeMs`, `fadeInMs`, `fadeOutMs` | config's | CSS fade times |

- `clearPauseMs`: the dark time after the fade, before the next score
  starts. A score's own is the dark time after *that* score's unit (add
  the gap before the fade for time shown and time dark). The legacy
  `fadeWords: 0` wipe uses it too. A config without the key (the legacy
  `defaultConfig`) gets 500.
- `holdMs`: counted from when the unit's last spel appeared (for a short
  last item, or an implicit paragraph to be read whole).
- `overlapMs`: the next score starts this long after the fade begins,
  however much of the fade is left: a cross-fade (`0`: at once). Without
  it the fade is over, and `clearPauseMs` has passed, first.
- `revealStyle`: `"together"` shows all the score's spels at once (at its
  first item), then waits out the item durations: for implicit paragraphs
  of several spels that should appear whole. Only with `fadeOut` `"score"`,
  `"ofld"` or `"cycle"` (a score that toggles spels itself needs
  `"sequence"`).
- The CSS fade times are not scaled by `durationScale`; see below.

Example, a poem whose lines (ofld) build up and fade in the reverse order,
a cross-fade into the next line, the last line left longer:

```js
createConfig({ fadeOut: "ofld", fadeStyle: "sequence",
  fadeOrder: "reverse", fadeStaggerMs: 300, overlapMs: 0,
  scoreSettings: [ /* ... */ { holdMs: 4000, fadeOutMs: 3000 } ] });
```

### Fade times (`fadeMs`, `fadeInMs`, `fadeOutMs`)

`fadeMs` (1300) is the CSS fade time of whatever fades: a character when
`charFades` is on, a whole spel when it is off. `fadeInMs` and `fadeOutMs`
override it for appearing and disappearing, so a quick reveal can have a
slow fade out; a score may set its own. `typeCss` turns them into
`--fade-in` and `--fade-out` on `:root` (and still sets `--spel-fade` /
`--char-fade`, to the fade-in time, for a page not yet updated); `play()`
sets them on `#field` for a score that has its own. The page's CSS needs
one rule for each direction, because a transition counts for the state it
moves *to*:

```css
/* going hidden: the fade out */
.char { opacity: 0; transition: all var(--fade-out, 1.3s) ease-in-out }
/* going visible: the fade in */
.char.visible {
  opacity: 1; transition: all var(--fade-in, 1.3s) ease-in-out }
/* the same for .spel */
```

The engine does not wait for a fade to finish: `clearPauseMs` counts from
the start of the fade-out, so with the same `fadeOutMs` the next unit
begins just as the last one has gone.

### Fading without `fadeOut`

Without `fadeOut` the old `fadeWords` values are read: `n > 0` is
`"window"`; `-1` is `"scored"`; `0` wipes the whole `#field` after each
score (`fieldFadeMs` + 250 ms, then `clearPauseMs`; the characters are
hidden too). Prefer `fadeOut` in new work; the special values will go at
1.0.

## When spels fade out (`fadeOut: "window"`)

A spel fades `fadeWords` spels after it appears (`fadeWords` > 0; with
`paraFadeWords`, an array, it may differ by paragraph), timed from the
moment it appears by the **reading time** of itself and the `fadeWords`
spels after it (`readingTimes`, `fadeDelay` in `score.js`). A score item's
duration can carry the whitespace after a line's last spel; that
end-of-unit time delays what is faded **in** next, never what is faded
**out**. So:

- a spel in the middle of a line reads in its **duration**, as scored or
  recorded;
- a spel that ends a line or the score reads in its `spelTime` estimate
  (no gap), scaled by the score's **pace**: the sum of its mid-line
  durations over the sum of their estimates. A linear score has pace 1;
  one timed from a recording has the recording's pace. Spels without a
  recorded position (`topvw`) count as line ends;
- `PAUSE` and `AUTOFADE` items add nothing.

An item `{ "id": "AUTOFADE", "pause": n }` in a score turns on window
fading from there on, with `fadeWords` set to the word count `n`, whatever
`fadeOut` says. The wait after a score's last spel still lasts until the
last fade-out, then the gap.

## Gaps between units

After a score's last item the engine waits for its last scheduled fade-out,
then the gap. The gap is `interScoreMs`, unless the score ends a unit with
a gap of its own, which then replaces it (`cycleScores` off, where score
*i* plays `paras[i]`):

- `interFieldMs` after a score that ends a field: the next paragraph's
  first spel is in another `ofld`, or it is the last paragraph. The field
  outranks the paragraph.
- `interParaMs` after any other score that ends a paragraph (with
  `cycleScores` off, every other score; spels without a recorded `ofld`
  never end a field).

With `cycleScores` on only `interScoreMs` applies after a score.
`interCycleMs` is waited once before the first score (the config's) and
again after the cycle's last score and its gap (that score's own
`interCycleMs` first). If `creditsPauseMs` is above 0, `#byline` is shown
for that long after the first end-of-cycle wait, hidden, and the wait is
repeated.

A score's own `scoreSettings` entry comes first (its `interFieldMs`,
`interParaMs`, `interCycleMs`, or `interScoreMs`, which beats the config's
unit gaps), then the config's. All gaps use the config's `durationScale`.
Scores should not carry the duration for the end of a unit (the whitespace
after a paragraph's or field's last spel): that is what these gaps are for.

## Pause, resume and skip

`play()` reads two live flags on the config, `paused` and `skip`.
`bindKeys(config)` (`controls.js`) creates and sets them from the
keyboard: space or `p` pauses and resumes; the right arrow or `n` skips to
the next score. `bindKeys(config, { pause: ["k"], skip: ["j"] })` chooses
the keys; it returns a function that unbinds them. A page may set
`config.paused` / `config.skip` itself. Pausing holds the piece at its next
item or gap (a fade-out already scheduled still happens); skipping ends the
current score at once: its gap is skipped, and what was due to fade fades
without waiting. A page that never binds keys plays as before.

## Generated scores and timed scores

**A score that is made anew each time it comes round.** A score in
`scores.json` is an array of `{ id, duration }` items (`duration` in ms;
the id `"PAUSE"` is an item that shows nothing). It may instead *name a
generator*, so that a piece can play a different, quasi-random score on
every pass (shuffled pairs, a chorus with a randomly chosen word ...). JSON
cannot hold code, so the generators are the player page's own, handed to
`play()`:

```js
// scores.json:
//   [ [ ...items... ], "chorus",
//     { "generator": "shuffled", "args": [1, true] } ]
import { generators } from "./data/generators.js";
play(config, fieldElem, spels, paras, scores, { generators });
```

A generator is `(context, ...args) => score`, with `context` `{ spels,
paras, scores, config, scoreNum, args }` (the objects `play()` has, so a
generator can read other scores' durations). It must return an array of
items, built from the engine's `shuffle` and the item helpers below. A
name `play()` was not given, or a result that is not an array, throws with
the score number. `scoreSettings` still applies to a generated score.

**Item helpers** (`score.js`):

- `pauseItem(ms)` gives `{ id: "PAUSE", duration: ms }`.
- `toggleItems(items)` gives the same spels again with `duration: 0`:
  played after a score (or as one) they toggle all of them at once, to
  fade what a score showed or to show a whole verse in one go.
- `scoreFromTimings(timings, { ids, extraMs })` makes a score from
  recorded timings, `[{ start, end, word? }]` in **seconds**: each
  duration is the time from the start of a word to the start of the next
  (the last word: its own length), in whole milliseconds, plus `extraMs`
  on every duration. `ids` gives the spel ids in order (otherwise each
  timing's `word` is the id); a length mismatch throws.

## Centring on the extent

`centerField(field, { items = ".spel" })` does what poetry typesetters call
"centring on the longest line", generalised: the field is positioned so
that the horizontal extent of its items (leftmost left edge to rightmost
right edge) is centred in the viewport, the items keeping their relative
positions. It measures the extent relative to the field's left edge, in
`vw` (so it does not depend on where the field is), and publishes it as CSS
custom properties on the field: `--extent-x` and `--extent-w` (offset and
width), `--extent-y` and `--extent-h` (top offset and height: the tallest
ofld's, as oflds are drawn one over another). CSS then centres, with no JS
involved:

```css
#field {
  position: absolute;
  left: calc((100% - var(--extent-w, 0vw)) / 2 - var(--extent-x, 0vw));
}
```

The field has no height of its own (its items are absolutely positioned),
so place its top instead, e.g. the extent's middle 1em above the
viewport's middle: `top: calc(50vh - var(--extent-h, 1.8em) / 2 -
var(--extent-y, 0vw) - 1em);`

```js
import { centerField } from "scoringthespeltair";
const measure = centerField(fieldElem); // after the spels are in the DOM
```

It re-measures when fonts finish loading and on `resize` (which matters
only if type is not sized in `vw`). `items` may be a selector, a NodeList
or an array: pass a subset to centre on, say, only the current paragraph,
and call the returned `measure()` whenever it changes. The default
measures all spels, visible or not; items with zero width are ignored. The
items must be laid out inside the field, with no transform on it that
scales or shifts horizontally. Browser only: the module touches
`document`/`window` only when `centerField` is called.

## Units: milliseconds everywhere

Every time value in this library (`sleep`, `msToTime`, config keys, score
`duration` values, reading-time estimates) is in **milliseconds**. Config
keys end in `Ms`; lengths ending in `Vw` are in vw; `durationScale` and
`fadeWords` are unitless. Convert at the boundary (e.g. recorded word
timings in seconds `* 1000`), not inside the library.

**Migrating from 0.0.x (hundredths of a second).** Rename overridden
timing keys to the `Ms` names and multiply their values by 10 (old keys are
ignored; `createConfig` and `play()` warn). Convert each `scores.json` once
with `scripts/migrate-scores-to-ms.js` (`--write` to overwrite; otherwise
it prints; `AUTOFADE` items hold a word count and are left alone). An
unmigrated scores file plays 10x too fast, undetectably. Project code
calling `sleep()` with hundredths needs the same x10.

## Releases

The engine is released by **tagging** (`v0.15.0`, ...; semver). A consuming
project names a tag, never a branch, so what it plays only changes when you
change the tag. It names the engine in two places, both with the same tag:

1. `package.json` (and so `package-lock.json`):
   `"scoringthespeltair": "github:observable2/scoringthespeltair#v0.15.0"`
2. each jsDelivr URL in the notebooks and players
   (`cdn.jsdelivr.net/gh/observable2/scoringthespeltair@v0.15.0/...`). The
   scoring template keeps its one in the first cell (`const engine = ...`).

**To release** (in this repo): finish the work, `npm test`, set `version`
in `package.json`, commit, then `git tag v0.15.1 && git push && git push
--tags`.

**To move a project to a release**, in the project's folder:

```
node node_modules/scoringthespeltair/scripts/bump.js v0.15.1
```

It (1) sets the dependency in `package.json` to the tag, (2) regenerates
`package-lock.json` in a temporary folder and copies it back, checking that
it pins the tag (npm run *inside* a workspace updates `package.json` but
not a project's own lockfile, which GitHub Pages builds from), (3) rewrites
the tag in every jsDelivr URL under `nbks/` (a project that imports the
engine from npm has none, and says so), and (4) outside a workspace, runs
`npm install` (`--no-install` skips it; in a workspace `node_modules` is
the shared one and uses the local engine). `--dry` shows what it would do;
a tag that is not pushed fails and leaves the lockfile alone. Then try
`npm run preview` and `npm run build`, and commit `package.json`,
`package-lock.json` and `nbks/`. GitHub Pages builds with `npm ci`, so it
uses exactly the tag in the lockfile. (If the installed engine predates
the script, run the one in the engine's folder: `node
../scoringthespeltair/scripts/bump.js v0.15.1`.)

Do not use `@main` in a project you deploy: a push to the engine would
change the piece, and jsDelivr caches `@main` so it can also lag. It is
fine in a notebook you are experimenting in.

When a release changes how a config must be written, [Old names](#old-names)
says so; old names keep working through 1.x.

## Design notes

### Dependencies: keep the core dependency-free

A top-level `import ... from "rita"` in a file reachable from `index.js`
(or from `play.js`, which imports `timing.js`) would make every consumer
load RiTa, even one that only wants `sleep`. So core files (`play.js`,
`timing.js`, `math.js`, `dev.js`, `display.js`, `score.js`, `config.js`)
import nothing outside this repo, and anything needing an external package
lives in its own file, is published only as a subpath export (e.g.
`scoringthespeltair/timetoread-rita.js`) and is **not** re-exported from
`index.js`. The package is an optional `peerDependency`
(`peerDependenciesMeta: { rita: { optional: true } }`), so projects that
don't use it never install it.

### Reading-time estimators

Two models, in separate files. All times are ms; `factor` (default 1)
and `options` are optional.

| | `timetoread.js` | `timetoread-rita.js` |
|---|---|---|
| Dependencies | none (default) | `rita` (optional) |
| Input | text of any length | one token |
| Markup | HTML and Markdown read | not handled |
| `factor` | divides every term | divides the result |

`timetoread.js` has `timeToRead`, `wordTime`, `whitespaceTime` and
`spelTime`. A word costs `perLetter` (112) per Unicode letter, plus
`clausePause` or `sentencePause` (150) for each punctuation mark in a
fixed set; digits cost nothing yet. Whitespace costs by line breaks
(`perNewline` 1000), extra spaces (`perSpace` 75) and tabs (`perTab` 300).
`timeToReadDefaults` (frozen) lists every option. The model and its
options are described at the top of `timetoread.js`;
`timetoread-rita.js` (length, RiTa syllables, vowels, punctuation,
whitespace) is for comparison.

How `timeToRead(text)` reads a text:

1. **Markup is removed, not read**: HTML tags (also `<script>`, `<style>`,
   comments), entities and Markdown (links keep their text; images, list
   numerals and heading marks vanish). A pragmatic subset;
   `html: false` / `markdown: false` switch either off.
2. **Structure becomes line breaks.** Block tags, Markdown paragraph
   breaks, headings, list items and rules each end a line. A run of them
   between two words is one break (`perNewline`).
3. **Whitespace** is `"collapse"` by default: a run costs nothing.
   `"respect"` (for `white-space: pre` text) counts every newline, space
   and tab, except the ordinary space between two words.
4. **The end of the text counts as a line ending**: `endBreaks` (1)
   breaks, or `endBreaksMultiline` (2) if the text has another. A real
   break at the very end coincides with it, so `"foo"`, `"foo "` and
   `"foo\n"` cost the same.

`timeToRead(text)` is exactly the sum of `wordTime` per token,
`whitespaceTime` per gap, and the end-of-text break, so per-token
estimates can be compared with recorded timings.

`spelTime(spel, gap, factor, options)` is a spel in its context: its own
time (whitespace inside a multi-word spel counts), plus the `gap` that
follows it up to the next spel (`""` if none), and no end-of-text break
unless `options.end` is true (the last spel of a paragraph). Spel markup
(`<!--@ spel -->`) is HTML comments, so it is not read.

### Reading Chinese

The notebooks make each Han character a spel of its own (see the
template's markup notes), and `timeToRead` has to say how long one takes.
A character is one *letter* to the model (112 ms): a five-character line
would be read in 0.56 s, which is far too fast. What a reader says is a
syllable, so the engine takes an optional `romanize` function (a run of
Han characters in, its romanization out) and counts the *letters of the
romanization* instead: 空 `kong` is 4 letters, 人 `ren` is 3. A line of
five characters then takes about 1.8 to 2 s (about 450 ms a syllable).

```js
spelTime("空", "", 1, { romanize: (han) => "kong" })  // 4 letters
```

The engine has no dictionary (it stays dependency-free). A page supplies
one; the scoring notebooks (`scoring-luzhai`, `scoring-noreaster`, the
template) load [tiny-pinyin](https://github.com/creeperyang/pinyin)
(10 KB, MIT) from jsDelivr, only when the galley contains Han characters,
and pass `(run) => convertToPinyin(run, " ", true)` as `romanize`. If the
import fails, a character counts as one letter, as without the option.
`uchaf` does not use `spelTime`. The option is in the engine from 0.16.0;
an older engine ignores it.

**Limits, for when this is revisited:**

- **One reading per character.** tiny-pinyin has no word dictionary, so
  `行` is always `xing` (`银行` becomes `yin xing`, not `yin hang`) and
  `了` is always `le`. The model counts letters and most readings of a
  character have the same number (`hang` and `xing`, `chang` and
  `zhang`), but a few differ (`le`, `liao`; `le`, `yue`).
  [pinyin-pro](https://github.com/zh-lx/pinyin-pro) (MIT, about 950 KB)
  reads in context (`银行` is `yin hang`, `长大` is `zhang da`); it fits the
  same `romanize` slot as `(run) => pinyin(run, { toneType: "none" })`.
- **Letters are a rough proxy.** `perLetter` (112 ms) was fitted to
  English letters. Pinyin letters per syllable run from 2 (`bu`) to 5
  (`shang`), and a syllable is not read in time proportional to its
  letters. A per-syllable constant, or a figure fitted to a recording
  of Chinese, would be better; the notebook's alignment gives the
  timestamps to fit it. Nothing here is calibrated.
- **Tones, neutral tones and erhua** are not modelled.
- **Traditional characters** are covered by tiny-pinyin's table only
  where they match a simplified one.
- **Punctuation** is counted as for roman text: `，、；：）」』` are clause
  pauses and `。？！` sentence pauses (150 ms each, uncalibrated).

### Calibration of the estimators

Timestamped readings exist for three texts (`reading`, `reunion`, and
`crawlitsimage` of the Framework project, 4,458 words). `local-data/`
(gitignored, so absent on a fresh clone) holds them consolidated as ms
data with `build-timestamps.mjs`, which rebuilds it. A project's own
`scores.json` can be hundredths or hand-estimated: use the timestamps.

Findings (start-to-start interval, fit on half of crawlitsimage, tested
on the rest):

- Letters predict word time better than vowel letters (held-out r 0.59 to
  0.68, mean error 276 to 201 ms). Best fit about 112 ms per letter, no
  base; syllables, a length cap and step terms added nothing. RiTa is not
  needed for accuracy (one small sample).
- A line break adds about 1000 ms (reunion: +970 median, +1060 mean).
- Punctuation is **not calibrated**: two of the texts have none, and
  `reading`'s few marks show pauses well over a second, against the 150 ms
  default (RiTa's is 700). Also uncalibrated: `perSpace`, `perTab`,
  `endBreaksMultiline`, and `perNewline` for prose paragraph breaks (it
  was measured on poem lines). A punctuated recording is needed.
- Chinese is not calibrated at all (see Reading Chinese).
- Pace differs by recording (mean interval about 560 ms crawlitsimage, 520
  reunion, 370 reading): that is what `factor` is for. The figures above
  are one reader's pace.
