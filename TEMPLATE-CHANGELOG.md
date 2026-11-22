# Scoring template changelog

`nbks/scoring-template.html` is the reference copy of the scoring
notebook. Each project has its own `scoring-<name>.html`, copied from it,
which a maker edits by hand: the galley text, the config, the scores.

## The rule

A new affordance is first needed, and built, in one piece's notebook.
When it is generic:

1. Add it to the template (the machinery cells and the documentation
   cells), and to **every** `scoring-*.html`. Piece-specific things stay
   apart: config values, galley text, header text, the export folder,
   the entries of the `fonts` table.
2. Add an entry below and bump the template's `### Version x.y.z`.
3. Set the stamp in each notebook's header, "made from the Scoring
   Template (version x.y.z)". A partial copy (it has only some of the
   cells) says "the cells it shares with the template are synced to
   version x.y.z".
4. Check, from a project:

   ```
   node ../scoringthespeltair/scripts/check-notebooks.mjs
   ```

   (`--tag vX.Y.Z` compares with the template of a release instead.) It
   matches cells by the names they declare, since Observable Desktop
   renumbers cell ids when it saves, and lists every shared cell whose
   code differs, and any notebook behind the template.

## 1.4.0 (engine 0.17.0)

- **`spels-raw.json`.** The export also writes a copy of `spels.json` as
  the notebook makes it (`WITH_RAW` in the export cell), for when
  `spels.json` is edited by hand: `diff spels-raw.json spels.json` shows
  the edits. Where the notebook saves into the data folder, a `spels.json`
  that differs from the `spels-raw.json` on disk is not selected for
  writing. (uchaf, which only downloads, gets the extra file.)

## 1.3.0 (engine 0.17.0)

- **Blank lines at the top of a `clmn`.** A column used to start at its
  first spel, so a blank line (or a `&nbsp;` line) before it was lost
  when it was lifted to the top of its ofld. Now those lines count, as
  they do inside a column: the first line break after the markup ends
  the markup's own line, and each further one is a blank line. Notebooks
  whose columns start right after the markup, or on the next line, measure
  exactly as before. Cells: `measureBoxes` (with `inHost`,
  `measureMarks`) and `addSpansTo`.

## 1.2.0 (engine 0.16.0)

The first stamp that names a fixed set of cells: the template had moved
on from 1.1.0 without a bump, so this lists everything since.

- **Fonts.** `<!--@ font:name -->` ... `<!--@ /font -->` sets the font of
  the spels inside it; the `fonts` table in the config cell maps names
  to a family or `{ family, sizeVw }`. The region is shown in that font
  in the galley and measured in it, whitespace included, so indents come
  out as displayed; exported spels carry `font` and the font in `html`.
- **Chinese.** Each Han character is a spel of its own, with its
  punctuation. The linear scores time a character by the letters of its
  pinyin (`romanize`, tiny-pinyin from a CDN, loaded only when the galley
  has Han characters).
- **Geometry.** The spanned galley is at least as tall as its tallest
  column.
- **Export.** Saves into `nbks/data/` after asking, per file; one record
  per line (`toLines`).
- **Performance.** Align a recording to derive performed scores, snap
  onsets to the sound, flag long durations.
- **Config.** `fadeOut`, `fadeStyle` and their refinements, `fadeMs`,
  `fadeInMs`, `fadeOutMs`, `clearPauseMs`, and `perScore` (expanded by
  `expandScoreSettings`); score items have a `duration`.
- **Page.** The notebook keeps its theme; the player's page chrome is
  scoped to pages with `#field`.

## 1.1.0 (engine 0.7.0)

`interParaMs`, `interFieldMs`; a score may override the gap at the end of
a unit.

## 1.0.0

The first template: the galley, the markup (`spel`, `para`, `clmn`,
`ofld`, `sctn`, `chpt`), measuring, linear scores from `timeToRead`, and
the export of `spels.json`, `paras.json`, `scores.json`, `config.json` and
`measured.json`.
