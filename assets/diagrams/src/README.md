# Diagram sources

The five SVGs one folder up are generated, not hand-drawn. Each `NN-*.mjs` file
here exports a `render()` function that returns the finished SVG as a string.

- `svg-kit.mjs` holds the shared visual system: the 1920 x 1080 canvas, the
  palette (one colour per actor), the type scale, and the primitives (header
  with the Southlodge logo, footer with the legend, cards, chips, badges,
  arrows, the bottom band).
- `sequence.mjs` is the swim-lane skeleton the three per-tool diagrams share
  (lanes top to bottom, numbered columns left to right).
- `build.mjs` compiles every `NN-*.mjs` in this folder to SVG and checks the
  output (balanced tags, no placeholder text, no script, style or
  foreignObject elements).
- `render.sh` screenshots each SVG at 1920 x 1080 with headless Edge so the
  result can be checked by eye.

## Commands

```sh
node assets/diagrams/src/build.mjs                       # all five, into assets/diagrams/
node assets/diagrams/src/build.mjs out 03                # one diagram, into ./out
bash assets/diagrams/src/render.sh assets/diagrams /tmp/png
```

Node built-ins only, no dependencies. The logo is embedded as base64 from
`logo-dark-700.png`, so the SVGs are self-contained. Conventions: British
spelling, no em-dashes, at most seven wrapped lines per card, and every
factual claim on a diagram must be checkable against `handoff-guard.mjs`.
