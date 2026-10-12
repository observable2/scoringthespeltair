// all times in this library are milliseconds
function sleep(ms, factor = 1) {
  if (ms < 0) ms = 0;
  return new Promise(resolve => setTimeout(resolve, ms * factor));
}

function msToTime(duration) {
  var seconds = parseInt((duration / 1000) % 60)
    , minutes = parseInt((duration / (1000 * 60)) % 60);

  minutes = (minutes < 10) ? "0" + minutes : minutes;
  seconds = (seconds < 10) ? "0" + seconds : seconds;

  return minutes + ":" + seconds;
}

export { sleep, msToTime }
