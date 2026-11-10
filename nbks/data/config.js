// project configuration for the player: the engine's defaults plus this piece's own values
import { defaultConfig } from "https://cdn.jsdelivr.net/gh/observable2/scoringthespeltair@v0.5.0/config.js";

const config = {
  ...defaultConfig,
  startPara: 0,
  fontWeight: 300 // overrides the engine's default (400); the same value as in scoring-template.html
};
export { config };
