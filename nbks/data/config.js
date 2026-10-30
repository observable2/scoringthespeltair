// project configuration for the player: the engine's defaults plus this piece's own values
import { defaultConfig } from "https://cdn.jsdelivr.net/gh/observable2/scoringthespeltair@main/config.js";

const config = {
  ...defaultConfig,
  startingPoint: 0,
  numParas: 3,
  fontWeight: 300 // overrides the engine's default (400); the same value as in scoring-template.html
};
export { config };
