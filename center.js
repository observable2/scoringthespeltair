// "Centering on the longest line", generalised: centre the field so that the
// horizontal extent of its items (leftmost left edge to rightmost right edge)
// is centred in the viewport, leaving the items' own relative positions alone.
//
// How it works:
//  1. MEASURE the items' extent relative to the field's own left edge. The
//     extent is expressed in vw, so it is independent of the field's current
//     left and, because the type is sized in vw, of the viewport width.
//  2. PUBLISH it as two CSS custom properties on the field:
//       --extent-x : offset of the leftmost edge from the field's left edge
//       --extent-w : width of the extent
//  3. LET CSS DO THE CENTRING, so it is responsive with no JS involved:
//       #field { left: calc((100% - var(--extent-w)) / 2 - var(--extent-x)); }
//     (100% is the width of the containing block, i.e. the viewport.)
//
// JS re-measures only when something that changes glyph widths happens: fonts
// finishing loading, or a resize (which matters only if type is not sized in vw).
//
// Pass `items` (a selector, NodeList or array) to centre on a subset, e.g. only
// the currently visible spels, and call the returned `measure()` to refresh.

function centerField(field, { items = ".spel" } = {}) {
  const els = () =>
    typeof items === "string" ? field.querySelectorAll(items) : items;

  function measure() {
    const origin = field.getBoundingClientRect().left;
    let min = Infinity;
    let max = -Infinity;
    for (const el of els()) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue; // skip empty or display:none items
      min = Math.min(min, r.left - origin);
      max = Math.max(max, r.right - origin);
    }
    if (min > max) return; // nothing measurable yet
    const vw = window.innerWidth / 100;
    field.style.setProperty("--extent-x", `${min / vw}vw`);
    field.style.setProperty("--extent-w", `${(max - min) / vw}vw`);
  }

  measure();
  document.fonts?.ready.then(measure);
  document.fonts?.addEventListener("loadingdone", measure);
  let frame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  });
  return measure;
}

export { centerField };
