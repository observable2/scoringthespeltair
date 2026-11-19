# scoringthespeltair

Shared playback engine for Observable notebook-kit "spel" poem projects (originally
factored out of the `reading` project). Provides the timed show/hide animation loop
that plays a sequence of "spels" according to a score, plus small utility helpers.

## Exports

Everything is re-exported from the package root (`import { play, defaultConfig, sleep } from "scoringthespeltair"`),
or import individual files:

- `scoringthespeltair/play.js` → `play(config, fieldElem, spels, paras, scores, { generators })` (the last argument is optional)
- `scoringthespeltair/display.js` → `toggleSpel`, `splitIntoChars` (wraps each character of every spel in a `.char` span, for `charFades`)
- `scoringthespeltair/center.js` → `centerField` (browser only; see [Centring on the extent](#centring-on-the-extent))
- `scoringthespeltair/score.js` → `sumDurations`, `durationOf`, `pauseItem`, `toggleItems`, `scoreFromTimings`, `resolveScore` (see [Generated scores](#generated-scores-and-timed-scores))
- `scoringthespeltair/text.js` → `normalizeToken` (markdown-aware token cleanup; default `normalize` for the RiTa estimator)
- `scoringthespeltair/timetoread.js` → `timeToRead`, `wordTime`, `whitespaceTime`, `spelTime`, `timeToReadDefaults` (no dependencies; markup handling is in the internal `markup.js`)
- `scoringthespeltair/timetoread-rita.js` → `timeToReadRita`, `createTimeToReadRita`, `timeToReadRitaDefaults` (needs `rita`; not in the root export)
- `scoringthespeltair/timing.js` → `sleep`, `msToTime`
- `scoringthespeltair/math.js` → `mod`, `shuffle`
- `scoringthespeltair/dev.js` → `createDevLog`
- `scoringthespeltair/config.js` → `createConfig`, `configSchema`, `defaults`, `normalizeConfig`, `measuredWith`, `checkMeasuredWith`, and the legacy `defaultConfig` (see [Configuration](#configuration))
- `scoringthespeltair/typography.js` → `typeCss(config, selector)`: the type CSS and fade-time variables, from the config
- `scoringthespeltair/mount.js` → `mount(config, fieldElem, { spels, measuredWith, center })` (browser only): put the spels in the field, split into characters if `charFades`, centre

## Usage

Each consuming project keeps its own content (`spels.json`, `paras.json`, `scores.json`) and a
config, made with `createConfig`:

```js
import { createConfig } from "scoringthespeltair/config.js";

const config = createConfig({
  fadeWords: 0, // only what differs from the engine's defaults
});
export { config };
```

```js
const { play } = await import("scoringthespeltair/play.js");
play(config, fieldElem, spels, paras, scores);
```

A project made from the scoring template (`nbks/scoring-template.html`) does not write that config
by hand: the notebook **exports** `config.json` with the data, and the player reads it:

```js
import { createConfig, typeCss, mount, play } from "scoringthespeltair";   // or the jsDelivr URL, see Releases
const config = createConfig(await FileAttachment("./data/config.json").json(), { /* player-only overrides */ });
// in a <style>: ${typeCss(config, "#field")} gives the field the type the notebook measured
const spels = new Map(await FileAttachment("./data/spels.json").json());
mount(config, fieldElem, { spels });
if (config.running) play(config, fieldElem, spels, await FileAttachment("./data/paras.json").json(), await FileAttachment("./data/scores.json").json());
```

## Configuration

**One definition, three scopes.** `configSchema` in `config.js` defines every setting once: its default,
its scope and a line of documentation. The notebook shows it as a table. `createConfig(overrides)` is
the defaults plus your overrides, with legacy names mapped to current ones, and a console warning for a key
it does not know (a typo would otherwise be ignored) or that is retired. Keys of your own are kept.

| Scope | What it is | Who must agree |
|---|---|---|
| `measure` | the type and layout the spels are measured in: `fontFamily`, `fontWeight`, `fontSizeVw`, `lineHeight`, `opsz`, `ligatures`, `clmnRight` | notebook and player: the spel data depends on them. `typeCss` writes them as CSS for both. `measuredWith(config)` is exported as `measured.json`; `mount()` warns if a page's type differs |
| `play` | read by `play()`: `running`, `startPara`, `cycleScores`, `scoreSettings`, `fadeWords`, `paraFadeWords`, `charFades`, `charIntervalMs`, `durationScale`, `interScoreMs`, `interCycleMs`, `creditsPauseMs`, `fieldFadeMs`, `clearPauseMs`, `PRODUCTION` | the player |
| `page` | applied by the page's CSS: `spelFadeMs`, `charFadeMs` (as `--spel-fade`, `--char-fade`, `--field-fade`) | the pages |

**The defaults** (`createConfig`): `durationScale` 1, `fontWeight` 300, `fontSizeVw` 3, `lineHeight` 1.8, `opsz` 14,
`ligatures` "no-common-ligatures", `fadeWords` 5, `charFades` true, `charIntervalMs` 80,
`interScoreMs` 3000, `interCycleMs` 3000, `creditsPauseMs` 0, `startPara` 0, `fieldFadeMs` 2500,
`clearPauseMs` 500, `spelFadeMs` 1500, `charFadeMs` 1300. The table in the notebook has them all.

**Adding a setting:** add it to `configSchema` (default, scope, doc). If the pages apply it, add it to
`typeCss` or have the page read it from the config. If `play()` reads it, a `config.x ?? defaults.x`
fallback keeps a config that was not made by `createConfig` working.

**Legacy: `defaultConfig`.** The 0.x object, kept exactly as it was (plus `cycleScores` and `PRODUCTION`)
so that a project that spreads it plays exactly as before. Its values differ from the new defaults
(`slower` 1.3 (now `durationScale`), `fontWeight` 400). A project can stay on it for ever; new projects use `createConfig`.
Moving over means writing down the old values you relied on (reading relies on `slower: 1.3`, which is `durationScale: 1.3`).

### Names that changed in 0.5.0

| Old | Now | Notes |
|---|---|---|
| `startingPoint` | `startPara` | the old name still works (`play()` and `createConfig` accept both; if both are given `startPara` wins). Renamed in reading, reunion, shi and the reference player |
| `slower` | `durationScale` | multiplies every duration (above 1 lasts longer), so it is named for what it scales. The old name still works, as a config key and inside each `scoreSettings` entry; `toggleSpel`'s option takes either. Renamed in reunion and the three shi poems |
| `numParas` | (retired) | never read by the engine: the number of paragraphs is `paras.length`. Removed from reading and the reference player; `createConfig` warns if it is given |
| `scoredPauseMs` | (retired) | never read by the engine |
| (hard-coded `2750`, `500` in `play()`) | `fieldFadeMs` + 250, `clearPauseMs` | with `fadeWords: 0`; defaults give the same times as before |

Also fixed: `paraFadeWords` is now looked up on every pass; before, only for the first paragraph.

Known and unchanged: with `cycleScores` off, the score for a pass is `scores[scoreNum]` where `scoreNum`
always starts at 0, so `startPara` chooses the paragraph, not the first score (the TODO in `play.js`).

### `ofld`, `sctn`, `chpt`

An **`ofld` (open field) is a screen**: the scene, of any length, on display at one time. The notebook
measures every spel from the top of its ofld, and the player is free to show one ofld after another at
the same origin. Playing an ofld as a unit (clearing it, moving to the next) is not yet done by the engine:
today it plays `paras` in order, as before. `sctn` and `chpt` are **measurement only**: every spel records
its section and chapter, nothing uses them.

## Releases

The engine is released by **tagging** (`v0.5.0`, `v0.5.1`, ...). A consuming project names a tag, never
a branch, so what a project plays only changes when you change the tag.

A project names the engine in two places, and both name the same tag:

1. `package.json` (and so `package-lock.json`): `"scoringthespeltair": "github:observable2/scoringthespeltair#v0.5.0"`
2. each jsDelivr URL in the notebooks and players (`cdn.jsdelivr.net/gh/observable2/scoringthespeltair@v0.5.0/...`).
   The scoring template keeps its one in the first cell (`const engine = ...`).

**To release** (in this repo): finish the work, `npm test`, set `version` in `package.json`, commit, then
`git tag v0.5.1 && git push && git push --tag`.

**To move a project to a release**, in the project's folder:

```
node node_modules/scoringthespeltair/scripts/bump.js v0.5.1
```

It (1) sets the dependency in `package.json` to the tag, (2) regenerates `package-lock.json` in a temporary
folder and copies it back, then checks that it now pins the tag (npm run *inside* a workspace updates
`package.json` but not a project's own lockfile, which is the one GitHub Pages builds from, so the script does
not use npm there), (3) rewrites the tag in every jsDelivr URL under `nbks/` (a project that imports the engine
from npm has none, and says so), and (4) outside a workspace, runs `npm install` to update `node_modules`
(in a workspace, `node_modules` is the shared one and uses the local engine). Add `--dry` to see what it
would do first. A tag that is not pushed fails with a message and leaves the lockfile alone. Then look at the
piece in `npm run preview` and `npm run build`, and commit `package.json`, `package-lock.json` and `nbks/`.
That is the whole procedure; GitHub Pages builds with `npm ci`, so it uses exactly the tag in the lockfile.
(The first bump to a tag cannot use the script in `node_modules` if the installed engine predates it: run
the one in the engine's folder instead, `node ../scoringthespeltair/scripts/bump.js v0.5.1`.)

Do not use `@main` in a project you deploy: a push to the engine would change the piece, and jsDelivr
caches `@main` so it can also lag. It is fine in a notebook you are experimenting in.

When a release changes how a config must be written, the section "Names that changed" above says so;
old names keep working through 1.x.

## Per-score settings

A piece that is one poem played through several different scores (a read-in, a pulse, an erasure ...)
needs each score to behave differently. Two config keys, both optional:

- `cycleScores: true`: one cycle plays **every** score in `scores.json`, in order (the default is one
  score per paragraph, `paras[i]` with `scores[i]`). There is then a single "paragraph" to the cycle.
- `scoreSettings`: an array indexed by score number; each entry may hold any of
  - `durationScale`: replaces `config.durationScale` for this score: its durations, its scored fade-outs and (with `charFades`)
    the per-character delay. `0` plays the score at once.
  - `interScoreMs`: replaces `config.interScoreMs`, the gap after this score. It is scaled by the *config's*
    `durationScale`, not the score's.
  - `interParaMs`, `interFieldMs`, `interCycleMs`: replace the config's for this score, when its end is the end of
    that unit (see "Gaps between units" below).
  - `effect`: the class toggled on the spel (or its characters), default `"visible"`. Another name (e.g.
    `"glow"`) gives a highlight effect on text that is already visible; the page's CSS defines it, and
    only `"visible"` gets the `charIntervalMs` delay between characters.
  - `shuffle: true`: the score's items are played in a new random order each time.

A score with no entry (or no `scoreSettings`) behaves exactly as before. See `shi/nbks/data/maple-bridge/config.js`.

## Generated scores and timed scores

Added for *uchaf*, usable by any piece.

**A score that is made anew each time it comes round.** A score in `scores.json` is an array of
`{ id, duration }` items (`duration` in ms; scores made before it was renamed from `pause` still play: the engine reads either, `durationOf` in `score.js`, and `scripts/migrate-scores-to-duration.js` renames it in a `scores.json`; `AUTOFADE` items keep `pause`, which holds a word count). It may instead *name a generator*, so that a piece can play a different,
quasi-random score on every pass (shuffled pairs, a chorus with a randomly chosen word ...). JSON cannot hold code,
so the generators are the player page's own, handed to `play()`:

```js
// scores.json:  [ [ ...items... ], "chorus", { "generator": "shuffled", "args": [1, true] } ]
import { generators } from "./data/generators.js";
play(config, fieldElem, spels, paras, scores, { generators });
```

A generator is `(context, ...args) => score`. `context` is `{ spels, paras, scores, config, scoreNum, args }`
(the same objects `play()` has, so a generator can read the durations of other scores, e.g. the timed read-in).
It must return an array of items; the engine's `shuffle` and the item helpers below are what generators are made of.
A name `play()` was not given, or a result that is not an array, throws with the score number in the message.
`scoreSettings` still applies to a generated score (`shuffle`, `effect`, `durationScale`, `interScoreMs`).
Scores that are plain arrays play exactly as before; `options` can be left out.

**Item helpers** (`score.js`):

- `pauseItem(ms)` → `{ id: "PAUSE", duration: ms }`.
- `toggleItems(items)` → the same spels again with `duration: 0`: played after a score (or as one) they toggle all of them at once.
  This is how to fade what a score showed, or to show a whole verse in one go.
- `scoreFromTimings(timings, { ids, extraMs })` → a score from recorded timings, `timings` being
  `[{ start, end, word? }]` in **seconds**: each duration is the time from the start of a word to the start of the next
  (the last word: its own length), in whole milliseconds, plus `extraMs` on every duration. `ids` gives the spel ids in order
  (otherwise each timing's `word` is the id) and a mismatch in length throws.

## When spels fade out (`fadeWords` > 0)

A spel fades `fadeWords` spels after it appears: timed from the moment it appears, by the **reading time** of
itself and of the `fadeWords` spels after it (`readingTimes` and `fadeDelay` in `score.js`). A score item's duration can carry
the whitespace after a line's last spel (a line break ...); that end-of-unit time delays what is faded **in** next,
never what is faded **out**. So:

- a spel in the middle of a line (the next item is a spel on the same line) reads in its **duration**, as scored or recorded;
- a spel that ends a line or the score reads in its `spelTime` estimate (no gap), scaled by the score's **pace**: the
  sum of its mid-line durations over the sum of their estimates. A linear score has pace 1; one timed from a recording has the
  recording's pace. Spels without a recorded position (`topvw`) count as line ends;
- `PAUSE` and `AUTOFADE` items add nothing.

The wait after a score's last spel still lasts until the last fade-out, then `interScoreMs`.

## Gaps between units

The gap after a score is `interScoreMs`, unless the score ends a unit that has a gap of its own, which then
replaces it: `interParaMs` after a score that ends a paragraph (`cycleScores` off, where score *i* plays `paras[i]`),
`interFieldMs` after one that ends a field (the next paragraph's first spel is in another `ofld`; the field outranks
the paragraph). `interCycleMs` still follows the cycle's last score, after its own gap. In every case the score's
own `scoreSettings` entry comes first (`interFieldMs`, `interParaMs`, `interCycleMs`, or its `interScoreMs`, which
beats the config's unit gaps), then the config's, so no override means the config's value. A config that lacks
`interParaMs`/`interFieldMs` (the legacy `defaultConfig`) gives `interScoreMs` throughout, as before; spels without
a recorded `ofld` never end a field. The scores should not themselves carry the duration for the end of a unit
(the whitespace after a paragraph's or field's last spel): that is what these gaps are for.

## Centring on the extent

`centerField(field, { items = ".spel" })` does what poetry typesetters call "centring on
the longest line", generalised: the field is positioned so that the horizontal extent of
its items (leftmost left edge to rightmost right edge) is centred in the viewport, while
the items keep their own relative positions (a straight left margin for most lines).

It works in three steps:

1. **Measure** the items' extent relative to the field's own left edge, in `vw`. That makes
   it independent of where the field currently is and, when type and spel offsets are sized
   in `vw`, of the viewport width.
2. **Publish** it as CSS custom properties on the field: `--extent-x` (leftmost edge's
   offset from the field's left edge), `--extent-w` (width of the extent), and, vertically,
   `--extent-y` (top-most edge's offset from the field's top) and `--extent-h` (height of the extent:
   the tallest ofld's, as oflds are drawn one over another). The field has no height of its own (its
   items are absolutely positioned), so it cannot be centred vertically with a translate; place its
   top instead, e.g. the extent's middle 1em above the viewport's middle:
   `top: calc(50vh - var(--extent-h, 1.8em) / 2 - var(--extent-y, 0vw) - 1em);`
3. **Let CSS centre**, so it stays responsive with no JS involved:

```css
#field {
  position: absolute;
  left: calc((100% - var(--extent-w, 0vw)) / 2 - var(--extent-x, 0vw));
}
```

```js
import { centerField } from "scoringthespeltair";
const measure = centerField(fieldElem); // after the spels are in the DOM
```

JS re-measures only when glyph widths can change: when fonts finish loading
(`document.fonts`) and on `resize` (which matters only if type is not sized in `vw`).

- `items` may be a selector (default `".spel"`), a NodeList or an array. Pass a subset to
  centre on, say, only the current paragraph, and call the returned `measure()` whenever
  that set changes. Items with zero width (empty, `display: none`) are ignored.
- The default measures all spels, visible or not (`opacity: 0` items still have layout).
- The field needs a `left` that depends on the variables as above, and the items must be
  laid out inside the field, with no transform on it that scales or shifts horizontally.
- Browser only. The module touches `document`/`window` only when `centerField` is called.

## Units: milliseconds everywhere

Every time value in this library (`sleep`, `msToTime`, config keys, score `duration`
values, reading-time estimates) is in **milliseconds**. Config keys end in `Ms`
(`interCycleMs`, `interScoreMs`, `creditsPauseMs`, `charIntervalMs`, `scoredPauseMs`);
`durationScale` and `fadeWords` are unitless. Convert at the boundary (e.g. recorded word
timings in seconds `* 1000`), not inside the library.

### Migrating from 0.0.x (hundredths of a second)

1. In each project's config, rename any overridden timing keys to the `Ms` names and
   multiply their values by 10. Old keys are ignored, and `play()` logs a warning if it
   sees them.
2. Convert each project's `scores.json` once (AUTOFADE items hold a word count and are
   left alone). Not detectable at runtime: an unmigrated scores file plays 10x too fast.
   ```
   node node_modules/scoringthespeltair/scripts/migrate-scores-to-ms.js data/scores.json          # preview
   node node_modules/scoringthespeltair/scripts/migrate-scores-to-ms.js data/scores.json --write
   ```
3. Any project-side code calling `sleep()` with hundredths needs the
   same x10.

## Versioning

Semver tags, `v0.5.0`, `v0.5.1`, ...; see [Releases](#releases) for how a project moves to one.

## Design notes

### Dependencies: keep the core dependency-free

Importing any module evaluates its imports, so a top-level `import ... from "rita"` in a
file reachable from `index.js` (or from `play.js`, which imports `timing.js`) makes every
consumer load RiTa, even one that only wants `sleep`. Policy:

- Core files (`play.js`, `timing.js`, `math.js`, `dev.js`, `display.js`, `score.js`,
  `config.js`) import nothing outside this repo.
- Anything needing an external package lives in its own file, is published only as a
  subpath export (e.g. `scoringthespeltair/timetoread-rita.js`), and is **not** re-exported
  from `index.js`. The package is declared an optional `peerDependency`
  (`peerDependenciesMeta: { rita: { optional: true } }`), so projects that don't use it
  never install it.

### Reading-time estimators

Two models, in separate files (a model is not just a different syllable counter):

| | `timetoread.js` (default, no deps) | `timetoread-rita.js` (optional) |
|---|---|---|
| Functions | `timeToRead(text, factor, options)`, `wordTime(token, factor, options)`, `whitespaceTime(gap, factor, options)`, `spelTime(spel, gap, factor, options)` | `timeToReadRita(token, whitespace, factor, overrides)`, `createTimeToReadRita(overrides)` |
| Input | any amount of text, from one token up; may contain HTML and/or Markdown | one token (does not handle markup; its default `normalize` is `normalizeToken`) |
| Model | `perLetter` x letters (Unicode `\p{L}`) + clause/sentence punctuation pauses + line breaks, spaces and tabs in gaps | length + RiTa syllables + vowels + punctuation + whitespace |
| Defaults | `timeToReadDefaults` (frozen): `perLetter` 112, `clausePause` 150, `sentencePause` 150, `perSpace` 75, `perTab` 300, `perNewline` 1000, `endBreaks` 1, `endBreaksMultiline` 2, `base` 0, `html` true, `markdown` true, `whitespace` "collapse" | `timeToReadRitaDefaults` (frozen) |
| `factor` | divides every term (>1 = faster); each part is rounded to a whole ms | divides the whole result |

All times are ms. `factor` and `options` are optional (`factor` defaults to 1).

#### How `timeToRead(text, factor, options)` reads a text

1. **Markup is removed, not read.** HTML tags (including `<script>`, `<style>`, comments), entities
   (`&amp;`, `&nbsp;`, `&mdash;`, `&#8212;`, ...; an unknown named entity is left as written) and Markdown
   (links keep their text but not their target, images and reference definitions vanish, list numerals and
   heading marks are dropped, `\.` escapes are honoured). It is a pragmatic subset of both syntaxes,
   not a full parser; `html: false` / `markdown: false` switch either off. On a lone token, `wordTime`
   handles inline markup but cannot see line-level Markdown (a list marker needs its line).
2. **Words** cost `perLetter` per Unicode letter (digits cost nothing for now) plus `clausePause` for each
   of `, ; : — – ” )` and `sentencePause` for each of `. ? ! …` inside the token. Only
   that punctuation set is accounted for.
3. **Structure becomes line breaks.** Block tags (`<p>`, `<div>`, `<br>`, `<li>`, headings, table rows,
   ...), Markdown paragraph breaks (a blank line), headings, list items, rules and hard breaks
   (two trailing spaces or a backslash) each end a line. Any run of these between two words is one
   break (`perNewline`), never more; a break at the very start of the text is not a pause.
4. **Whitespace** is `whitespace: "collapse"` by default, as the DOM and Markdown render: any run of
   spaces, tabs and newlines is a single ordinary space and costs nothing (a source newline is not a break).
   `whitespace: "respect"` is for text shown with `white-space: pre`-like behaviour: every newline is a break
   (`perNewline`), and spaces and tabs count `perSpace` and `perTab`, except that the one ordinary space
   between two words is free. Regardless of mode, text inside `<pre>` and Markdown code fences is
   respected, and `&nbsp;` / U+00A0 are always respected (so `a&nbsp;&nbsp;b` has one extra space).
5. **The end of the text supplied counts as a line ending**, real end or not. It is worth `endBreaks`
   (1) line breaks, or `endBreaksMultiline` (2) if the text contains at least one other line break
   (a break between words, or a real newline at the very start; a leading block tag does not count).
   A real line break at the very end coincides with the end rather than adding to it, so
   `"foo"`, `"foo "` and `"foo\n"` cost the same, and `"a\nb"` and `"a\nb\n"` cost the same; more real
   breaks than the end is worth (`"a\nb\n\n\n"`) are all counted. Text with no words costs 0.

`timeToRead(text)` is exactly the sum of `wordTime` for each token, `whitespaceTime` for each gap, and the
end-of-text break, so per-token estimates can be compared with recorded timings. `whitespaceTime(gap)`
takes the whitespace (and any markup) between two tokens and, like `timeToRead`, never treats a lone
space as a paragraph break.

#### `spelTime(spel, gap, factor, options)`: a spel in its context

`timeToRead` is for text that stands alone, so it counts the end of the text as a line ending. A spel
(one word or several) does not stand alone: it sits in a text, followed by whitespace that belongs to
its context. `spelTime` is the time of the spel itself plus the whitespace after it:

- the whitespace **inside** a multi-word spel counts as in `timeToRead` (line breaks, extra spaces
  and tabs under `whitespace: "respect"`), which `wordTime` on the whole spel would ignore;
- `gap` is what follows the spel up to the next spel: whitespace, perhaps with markup (`""` if nothing).
  Whitespace at the end of the spel itself is added to it; whitespace at the start of the spel is
  not counted (it belongs to the gap before);
- there is **no end-of-text break** unless `options.end` is true, for the last spel of a paragraph or
  of the text: the end then counts as a line ending, as in `timeToRead`, and the whitespace after the
  spel counts towards it.

Spel markup (`<!--@ spel --> ... <!--@ /spel -->`) is HTML comments, so it is not read, like any other
markup, and nothing here needs it: the functions work as well on text that has none.

`whitespaceTime` and `spelTime` count a gap that is only whitespace (`"     "`, `"\n    "`) by the same
rules as `timeToRead`. As there, indentation counts: in respect mode each space after a line break costs
`perSpace`.

Not yet calibrated: both punctuation figures, `perSpace`, `perTab`, `endBreaksMultiline`, and the use of
`perNewline` for prose paragraph breaks (it was measured on poem line breaks); digits are not read at all.

### Calibration of the estimators (what the numbers rest on)

Timestamped readings (word, start, end in seconds) exist in these places:

- `reading/nbks/data/reading.m4a.json` (this folder's sibling; 89 words, 1 segment)
- `/Users/kongqi/Library/CloudStorage/Dropbox/SitesShared/framework/reunion/src/data/reunion_tstamps.json` (60 words, 3 segments)
- `.../framework/crawlitsimage/src/data/limageinhii.json` (4,458 words, 22 segments)

`local-data/` (gitignored, so absent on a fresh clone) holds `timestamps-ms.json`, all three
consolidated into scores-shaped ms data (`id`, `duration`, plus `word`, `start`, `end`, and
`lineBreakAfter` where a `spels.json` layout exists), and `build-timestamps.mjs`, which
rebuilds it. `duration` = start of a word to start of the next, as `alignedSpels()` computes it.
Note the projects' own `scores.json` files can be hundredths or hand-estimated; use the
timestamps, not the scores.

Findings (start-to-start interval; fit on half of crawlitsimage, tested on the rest):

- Letters predict word time better than vowel letters (held-out crawlitsimage r 0.59 ->
  0.68, mean error 276 -> 201 ms; also better on reunion). Best fit about 112 ms per
  letter with no base. Syllables, a length cap, and step/hinge terms added nothing.
- RiTa's syllables differ from a vowel-group heuristic on only 5 of 89 words in `reading`
  and made no measurable difference; its punctuation was replaceable by a regex. So RiTa
  is not needed for accuracy (one small sample).
- A line break adds about 1000 ms (reunion: +970 median, +1060 mean). `reading`'s layout
  rows are not authored line breaks, so they don't test this.
- Punctuation is **not calibrated**: crawlitsimage and reunion contain none, `reading` has
  4-6 words. Those few show pauses well over a second, far above the 150 ms default
  (and RiTa's 700). A punctuated recording is needed before changing these.
- Pace differs by recording (mean interval about 560 ms crawlitsimage, 520 reunion, 370
  reading); that is what `factor` is for. Everything above is one reader's pace.
