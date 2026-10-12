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

export { sleep, msToTime }
