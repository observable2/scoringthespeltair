function mod(n, m) {
  // mod function that handles negative numbers, usage: mod(num, modulous)
  return ((n % m) + m) % m;
}
function sleep(hundredths, factor=1) {
  if (hundredths < 0) hundredths = 0;
  return new Promise(resolve => setTimeout(resolve, hundredths * 10 * factor));
}
function msToTime(duration) {
  var seconds = parseInt((duration / 1000) % 60)
    , minutes = parseInt((duration / (1000 * 60)) % 60);

  minutes = (minutes < 10) ? "0" + minutes : minutes;
  seconds = (seconds < 10) ? "0" + seconds : seconds;

  return minutes + ":" + seconds;
}
function shuffle (b) {
  let a = b.slice(); // make a copy
  let i = a.length;
  if (i < 2) return a;
  while (--i > 0) {
    let j = ~~(Math.random() * (i + 1)); // ~~ is a common optimization for Math.floor
    let t = a[j];
    a[j] = a[i];
    a[i] = t;
  }
  return a;
}

const createDevLog = (config) => (...args) => {
  if (!config.PRODUCTION) console.log(...args);
};
export { mod, sleep, msToTime, shuffle, createDevLog }
