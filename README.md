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
- `scoringthespeltair/timetoread.js` → `timeToReadAlt` (no dependencies)
- `scoringthespeltair/timetoread-rita.js` → `timeToRead`, `createTimeToRead`, `timeToReadDefaults` (needs `rita`; not in the root export)
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
3. Any project-side code calling `sleep()` or `timeToReadAlt()` with hundredths needs the
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

### Reading-time estimators (files created; refactor to the plan below pending)

`timing.js` currently holds two unexported work-in-progress estimators. They are **two
different models, not two flavours of one function**:

| | `timeToRead` (RiTa) | `timeToReadAlt` (no deps) |
|---|---|---|
| Signature | `(rawToken, lengthOfWhiteSpace, factor)` | `(word, idx, spaces, pauses, factor)` |
| Model | length + syllables + vowels + punctuation + whitespace | 300 + 150 per vowel or `, : ; . ?` |
| Whitespace | added into its own result | **mutates** `pauses[idx-1]` (75 per char, +1000 per newline) |
| Units | milliseconds (constants still to be supplied) | milliseconds (was hundredths before 0.1.0) |
| `factor` | divides the whole result | divides everything except the 30 base |

RiTa supplies only `syllables`, `tokenize` and `isPunct`; punctuation is a regex, so
syllable counting is the only real RiTa gain. Notes on `timeToReadAlt`: the side effect
on `pauses` makes it hard to reuse or test; it ignores `! " ( ) -` etc.; `hundreths` typo.

Plan:

- Own file (`timetoread.js`), not `timing.js`, so `sleep`/`msToTime` stay trivial and
  `play.js` never depends on it. Projects import `scoringthespeltair/timetoread.js`
  directly without loading the engine.
- One contract for every estimator: `(word, options) => ms` for the word alone,
  no mutation. Whitespace is a separate pure function, `pauseForWhitespace(spaces, factor)`
  (ms); the caller adds it to the previous item's pause. Keep `timeToReadAlt`
  as a thin wrapper with its old signature so existing notebooks keep working.
- Default estimator = cleaned-up `timeToReadAlt` (dependency-free). The RiTa model goes
  in `timetoread-rita.js` as a subpath export, not re-exported from `index.js`, with
  `rita` an optional `peerDependency`. Tuning constants (`TIME_FACTOR`, `VOWEL_WEIGHT`,
  `PUNCT_PAUSE_MS`, base) become an overridable defaults object.
- Decide RiTa on evidence: the `reading` project has recorded word timings
  (`nbks/data/reading.m4a.json`: start/end seconds per word) and the resulting pauses
  (`scores.json`, ms after migration). Score both estimators against these; if RiTa doesn't
  clearly win, drop it.

