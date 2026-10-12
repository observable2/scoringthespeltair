// one-time migration of a scores.json from hundredths of a second to milliseconds:
//   node scripts/migrate-scores-to-ms.js path/to/scores.json          (prints to stdout)
//   node scripts/migrate-scores-to-ms.js path/to/scores.json --write  (overwrites the file)
// multiplies each item's `pause` by 10; AUTOFADE items hold a word count, so are left alone.
import { readFileSync, writeFileSync } from "node:fs";

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error("usage: node scripts/migrate-scores-to-ms.js <scores.json> [--write]");
  process.exit(1);
}
const scores = JSON.parse(readFileSync(file, "utf8"));
const migrated = scores.map(score =>
  score.map(item => (item.id === "AUTOFADE" ? item : { ...item, pause: item.pause * 10 }))
);
const out = JSON.stringify(migrated);
if (flag === "--write") writeFileSync(file, out);
else console.log(out);
