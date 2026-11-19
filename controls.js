// Keys that pause and resume play(), and skip to the next score. play() reads two live flags on
// the config, `paused` and `skip`; this sets them (and makes play() watch for them) from the keyboard.
//   bindKeys(config)                           space or p: pause / resume; ArrowRight or n: skip to the next score
//   bindKeys(config, { pause: ["k"], skip: ["j"] })
// It returns a function that unbinds the keys. A page without a keyboard can set config.paused and
// config.skip itself (play() looks at them from the first score, once they exist in the config).
// Pausing stops the piece at its next item or gap; fade-outs already due still happen. Skipping ends the
// current score at once (its gap is skipped, and what is due to fade then fades without waiting).
function bindKeys(config, keys = {}, target = globalThis.document) {
  const pause = keys.pause ?? [" ", "p"], skip = keys.skip ?? ["ArrowRight", "n"];
  config.paused = false;
  config.skip = false;
  const onKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (pause.includes(e.key)) { config.paused = !config.paused; e.preventDefault?.(); }
    else if (skip.includes(e.key)) { config.skip = true; e.preventDefault?.(); }
  };
  target.addEventListener("keydown", onKey);
  return () => target.removeEventListener("keydown", onKey);
}

export { bindKeys };
