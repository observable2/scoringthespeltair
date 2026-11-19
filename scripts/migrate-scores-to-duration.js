// one-time migration of a scores.json from the item property `pause` to `duration`:
//   node scripts/migrate-scores-to-duration.js path/to/scores.json          (prints to stdout)
//   node scripts/migrate-scores-to-duration.js path/to/scores.json --write  (overwrites the file)
// renames each item's `pause` to `duration`, keeping the item's key order. AUTOFADE items hold a word
// count, not a time, so are left alone (and so is a score that names a generator, not an array of items).
// The engine reads either name (durationOf in score.js), so a scores.json can be migrated when convenient.
import { readFileSync, writeFileSync } from "node:fs";

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error("usage: node scripts/migrate-scores-to-duration.js <scores.json> [--write]");
  process.exit(1);
}
const rename = (item) => {
  if (item.id === "AUTOFADE" || !("pause" in item)) return item;
  return Object.fromEntries(Object.entries(item).map(([k, v]) => [k === "pause" ? "duration" : k, v]));
};
const scores = JSON.parse(readFileSync(file, "utf8"));
const migrated = scores.map((score) => (Array.isArray(score) ? score.map(rename) : score));
const out = JSON.stringify(migrated);
if (flag === "--write") writeFileSync(file, out);
else console.log(out);
