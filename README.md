# scoringthespeltair

Shared playback engine for Observable notebook-kit "spel" poem projects (originally
factored out of the `reading` project). Provides the timed show/hide animation loop
that plays a sequence of "spels" according to a score, plus small utility helpers.

## Exports

Everything is re-exported from the package root (`import { play, defaultConfig, sleep } from "scoringthespeltair"`),
or import individual files:

- `scoringthespeltair/play.js` → `play(config, displayElem, spels, paras, scores)`
- `scoringthespeltair/display.js` → `toggleSpel`
- `scoringthespeltair/score.js` → `sumPauses`
- `scoringthespeltair/text.js` → `normalizeToken` (markdown-aware token cleanup; default `normalize` for the RiTa estimator)
- `scoringthespeltair/timetoread.js` → `wordTime`, `whitespaceTime`, `timeToRead` (legacy signature), `timeToReadDefaults` (no dependencies)
- `scoringthespeltair/timetoread-rita.js` → `timeToReadRita`, `createTimeToReadRita`, `timeToReadRitaDefaults` (needs `rita`; not in the root export)
- `scoringthespeltair/timing.js` → `sleep`, `msToTime`
- `scoringthespeltair/math.js` → `mod`, `shuffle`
- `scoringthespeltair/dev.js` → `createDevLog`
- `scoringthespeltair/config.js` → `defaultConfig` (generic timing/behavior defaults)

## Usage

Each consuming project keeps its own content (`spels.json`, `paras.json`, `scores.json`)
and its own `config.js` that spreads `defaultConfig` and adds project-specific values:

```js
import { defaultConfig } from "scoringthespeltair/config.js";

const config = {
  ...defaultConfig,
  startingPoint: 0,
  numParas: 1,
};
export { config };
```

```js
const { play } = await import("scoringthespeltair/play.js");
play(config, stageElem, spels, paras, scores);
```

## Units: milliseconds everywhere

Every time value in this library (`sleep`, `msToTime`, config keys, score `pause`
values, reading-time estimates) is in **milliseconds**. Config keys end in `Ms`
(`interCycleMs`, `interScoreMs`, `creditsPauseMs`, `charIntervalMs`, `scoredPauseMs`);
`slower` and `fadeWords` are unitless. Convert at the boundary (e.g. recorded word
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
3. Any project-side code calling `sleep()` or `timeToRead()` with hundredths needs the
   same x10.

## Versioning

Tag releases with semver (`v1.0.0`, `v1.1.0`, ...). Consuming projects pin a specific
tag/commit in their `package.json` dependency so engine changes are opt-in per project.

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
| Functions | `wordTime(word, factor, overrides)`, `whitespaceTime(spaces, factor, overrides)`, legacy `timeToRead(word, idx, spaces, pauses, factor, overrides)` | `timeToReadRita(token, whitespace, factor, overrides)`, `createTimeToReadRita(overrides)` |
| Model | `perLetter` x letters (Unicode `\p{L}`) + clause/sentence punctuation pauses; line breaks add `perNewline` | length + RiTa syllables + vowels + punctuation + whitespace |
| Defaults | `perLetter` 112, `clausePause` 150, `sentencePause` 150, `perSpace` 0, `perNewline` 1000, `base` 0 (`timeToReadDefaults`, frozen) | `timeToReadRitaDefaults` (frozen); `normalize` = `normalizeToken` |
| Side effects | none (only the legacy wrapper adds the whitespace pause to `pauses[idx-1]`) | none |
| `factor` | divides every term (>1 = faster) | divides the whole result |

All times are ms. Both return the word's own time; whitespace is separate so the caller
decides where a pause lands. Strip HTML from a token before measuring it (`normalizeToken`
handles markdown, not HTML).

### Calibration of the estimators (what the numbers rest on)

Timestamped readings (word, start, end in seconds) exist in these places:

- `reading/nbks/data/reading.m4a.json` (this folder's sibling; 89 words, 1 segment)
- `/Users/kongqi/Library/CloudStorage/Dropbox/SitesShared/framework/reunion/src/data/reunion_tstamps.json` (60 words, 3 segments)
- `.../framework/crawlitsimage/src/data/limageinhii.json` (4,458 words, 22 segments)

`local-data/` (gitignored, so absent on a fresh clone) holds `timestamps-ms.json`, all three
consolidated into scores-shaped ms data (`id`, `pause`, plus `word`, `start`, `end`, and
`lineBreakAfter` where a `spels.json` layout exists), and `build-timestamps.mjs`, which
rebuilds it. `pause` = start of a word to start of the next, as `alignedSpels()` computes it.
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
