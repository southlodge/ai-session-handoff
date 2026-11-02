// metrics.mjs - per-glyph advance widths for the diagram fonts, in thousandths of an em. GENERATED: do not hand-edit.
// Measured with canvas measureText in headless Edge (Windows 11) by metrics/measure.html; for each glyph and weight the
// table keeps the WIDER of Segoe UI (what Windows and the PNGs render) and Arial (metric twin of Helvetica, what most
// Mac and Linux viewers fall back to). Monospace printable ASCII is 600: at least Consolas (550 here) and the
// advance of Courier New and Liberation Mono. Any other glyph in a monospace run falls back to a proportional face, so
// MONO keeps the widest of 600, what Consolas measured and the bold sans width. A glyph missing from the table counts
// as an em (1000), the safe side.
export const GLYPHS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~·’‘“”…→←↑↓–—×≤≥✓•\u2060\u00a0';
export const SANS = {
  400: [278,284,392,591,556,889,800,230,333,333,417,684,278,400,278,390,556,556,556,556,556,556,556,556,556,556,278,278,684,684,684,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,898,748,778,667,778,722,667,611,722,667,944,667,667,611,302,379,302,684,556,333,556,588,500,589,556,313,589,566,242,242,500,242,861,566,586,588,589,348,500,339,566,500,723,500,500,500,334,260,334,684,333,229,229,377,377,1000,1000,1000,500,500,556,1000,684,685,685,749,406,0,278],
  600: [278,333,474,591,556,889,722,258,333,333,434,694,278,402,278,414,556,556,556,556,576,556,558,556,556,558,333,333,694,694,694,611,975,722,722,722,722,667,611,778,735,292,556,722,611,924,767,778,667,778,722,667,611,722,667,966,667,667,611,333,405,333,694,556,333,556,611,556,611,556,345,611,611,278,278,556,278,889,611,611,611,611,389,556,361,611,556,778,556,556,500,389,280,389,694,333,278,278,500,500,1000,1000,1000,500,500,556,1000,694,695,695,749,414,0,278],
  700: [278,333,493,592,575,889,850,293,369,369,455,707,278,404,278,443,575,575,575,575,575,575,575,575,575,575,333,333,707,707,707,611,975,722,722,722,737,667,611,778,766,317,556,722,611,957,790,778,667,778,722,667,611,723,667,1005,667,667,611,369,436,369,707,556,333,556,620,556,619,556,383,619,611,284,284,559,284,916,611,611,620,619,398,556,389,611,556,797,556,556,500,389,326,389,707,333,290,290,500,500,1000,1000,1000,500,500,556,1000,707,708,708,749,422,0,278],
};
export const MONO = [600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,600,1000,1000,1000,600,600,600,1000,707,708,708,749,600,600,600];
// Every width is multiplied by this before it is used: room for SF Pro, Helvetica Neue and hinting differences.
export const SAFETY = 1.04;
const index = new Map([...GLYPHS].map((c, i) => [c, i]));
// Width in px of plain text (no markup) at size px; weight 600 and up use the bold tables.
export function runWidth(str, size, family = 'sans', weight = 400) {
  if (family === 'mono') {
    let m = 0;
    for (const c of String(str)) { const i = index.get(c); m += i == null ? 1000 : MONO[i]; }
    return m / 1000 * size * SAFETY;
  }
  const t = SANS[weight >= 700 ? 700 : weight >= 600 ? 600 : 400];
  let u = 0;
  for (const c of String(str)) { const i = index.get(c); u += i == null ? 1000 : t[i]; }
  return u / 1000 * size * SAFETY;
}
