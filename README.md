# scoringthespeltair

Shared playback engine for Observable notebook-kit "spel" poem projects (originally
factored out of the `reading` project). Provides the timed show/hide animation loop
that plays a sequence of "spels" according to a score, plus small utility helpers.

## Exports

- `scoringthespeltair/play.js` → `play(config, displayElem, spels, paras, scores)`
- `scoringthespeltair/utils.js` → `mod`, `sleep`, `msToTime`, `shuffle`, `createDevLog`
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

## Versioning

Tag releases with semver (`v1.0.0`, `v1.1.0`, ...). Consuming projects pin a specific
tag/commit in their `package.json` dependency so engine changes are opt-in per project.
