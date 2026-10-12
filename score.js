import { mod } from "./math.js";

// sums the pauses of the n score items following idx (wrapping around the score);
// with skipPauses, "PAUSE" items contribute nothing
function sumPauses(score, idx, n, { skipPauses = false } = {}) {
  let total = 0;
  for (let i = 0; i < n; ++i) {
    const item = score[mod(idx + i + 1, score.length)];
    if (!(skipPauses && item.id === "PAUSE")) total += item.pause;
  }
  return total;
}

export { sumPauses };
