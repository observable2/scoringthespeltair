// dependency-free reading-time estimate (milliseconds); see timetoread-rita.js
// for the RiTa-based model
function timeToReadAlt(word, idx, spaces, pauses, factor = 1) {
  let ms = 300;
  let vowelsOrPunc = word.match(/[aeiouy,:;\.\?]/gi);
  if (vowelsOrPunc) ms += (vowelsOrPunc.length * 150) / factor;
  if (idx - 1 > -1) {
    pauses[idx - 1] += (spaces.length * 75) / factor;
    let crs = spaces.match(/[\n\r]/gi);
    if (crs) pauses[idx - 1] += (crs.length * 1000) / factor;
  }
  return ms;
}

export { timeToReadAlt };
