# Diagram sources

The ten SVGs one folder up, five light and five dark, are generated, not
hand-drawn. Each `NN-*.mjs` file here exports a `render()` function that
returns one diagram as an SVG string; the same source draws both themes.

- `svg-kit.mjs` holds the shared visual system: the 1920 x 1080 canvas, the
  light and dark palettes (one colour per actor), the type scale, and the
  primitives (header with the Southlodge logo, footer with the legend, cards,
  chips, pills, arrows, the bottom band). Every primitive records its box, so
  the build can check the layout.
- `sequence.mjs` is the swim-lane skeleton that diagrams 2 to 5 share (lanes
  top to bottom, numbered columns left to right).
- `metrics.mjs` is a generated table of glyph widths. The kit wraps text with
  it and the build measures text with it. `metrics/measure.html` measures the
  fonts in a browser and `metrics/gen.mjs` turns that into the table.
- `build.mjs` writes the SVGs and checks them (see below); `check-svg.mjs` is
  the part of the check that reads each finished SVG back.
- `check-cites.mjs` prints, under each claim listed in a diagram's header, the
  lines of `handoff-guard.mjs` it cites, so every claim can be read against
  the code.
- `mutate.mjs` proves the checks. It copies the kit into a new folder once
  per case, breaks one thing on purpose (a lane 40 px shorter, a font under
  12 px, a colour under AA, an alt text that no longer matches, and more),
  and passes only when every broken copy fails the build with the rule named
  for its break and both unbroken copies, light and dark, build clean.
- `render.sh` screenshots each SVG at 1920 x 1080 with headless Edge so the
  result can be checked by eye.
- `logo-dark-700.png` and `logo-white-700.png` are the logo for the light and
  the dark theme. It is embedded as base64, so each SVG is self-contained.

## Commands

```sh
node assets/diagrams/src/build.mjs                  # five light SVGs, into assets/diagrams/
node assets/diagrams/src/build.mjs --theme dark     # their dark twins, *.dark.svg
node assets/diagrams/src/build.mjs out 03           # one diagram, into ./out
node assets/diagrams/src/check-cites.mjs            # the code behind every claim
bash assets/diagrams/src/render.sh assets/diagrams /tmp/png
node assets/diagrams/src/mutate.mjs assets/diagrams/src README.md /tmp/mut-1
```

Node 20 or later, built-ins only, no dependencies. A build from unchanged
sources reproduces the committed SVGs byte for byte. `mutate.mjs` needs a
folder that does not exist yet and leaves one copy per case in it.

To measure the fonts again (Windows; `msedge.exe` is in
`C:/Program Files (x86)/Microsoft/Edge/Application/`):

```sh
msedge --headless=new --dump-dom "file:///<kit>/assets/diagrams/src/metrics/measure.html" > dom.txt
node assets/diagrams/src/metrics/gen.mjs dom.txt assets/diagrams/src/metrics.mjs
```

## What the build checks

`build.mjs` prints `PROBLEM <file>: <rule> ...` and exits 1 when any check
fails, so a diagram that breaks a rule is never written silently. Per diagram:

- **Structure.** Tags are balanced; no placeholder text; no `script`, `style`
  or `foreignObject` element.
- **Layout**, from the box every primitive records:
  1. every line of text sits inside its card or band, at least 4 px from the
     edge;
  2. every card sits inside its lane;
  3. no pill or chip covers text it does not own;
  4. nothing but the footer reaches below y = 984;
  5. no text is under 12 px;
  6. no card holds more than five wrapped lines;
  7. text that keeps to a span (a lane label, a column, a band block) stays
     inside it;
  8. free text (a note, a label) never lies on a card;
  9. the footer's credit, legend and page count stay 24 px apart.
- **Arrows**, from the same boxes:
  10. a label pill never lies on a card;
  11. an arrow never runs through a card it joins, under or within 3 px of a
      card it passes, over free text, or under another arrow's label;
  12. every arrow is long enough to show shaft beside its heads, and a label
      on the shaft leaves shaft showing at both ends.
- **Read back from the finished SVG** (`check-svg.mjs`): every line of text,
  and every coloured span in it, reaches WCAG AA contrast (4.5:1) against the
  shape drawn under it, at any size; no text or code span is under 12 px.
- **Legend.** Every entry has one swatch, and no two entries look alike: two
  entries of one colour differ in shape, and two colours are at least 20
  apart in CIEDE2000.
- **Diagrams 3 and 4.** Every card either carries the grey "differs" chip or
  is declared the same as Claude Code.

Across diagrams 2, 3 and 4:

- the lane labels, band titles and legend entries match in number, order and
  wording once each tool's own name is set aside (the last legend entry says
  where that tool's return arrows land); the column titles match in number;
- a card declared the same as Claude Code must match a card in the same lane
  of diagram 2 word for word, and a "differs" card must not.

And the kit README: each diagram's `<img>` alt text is that diagram's
`aria-label`, word for word.

## Conventions

British spelling, no em-dashes, body text 15 px, card titles 17 px, nothing
under 12 px, at most five wrapped lines per card. Every factual claim on a
diagram is listed in the header of its `NN-*.mjs` file with the line of
`handoff-guard.mjs` (or another named kit file) that backs it, and
`check-cites.mjs` prints those lines beside the claims.

Put a no-break space (`\u00a0` in the source) between a number and its
unit, as in `72\u00a0hours`, so the two never land on different lines.
The wrapper never leaves one word alone on a card's last line: the last
word of the line above moves down to join it, when that line keeps at least
two words and the pair fits.
