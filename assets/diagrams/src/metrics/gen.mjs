// gen.mjs <dom.txt> <out metrics.mjs> : turns the headless-Edge glyph measurements into the kit's committed width table.
import fs from 'node:fs';
const dom = fs.readFileSync(process.argv[2], 'utf8');
const pre = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/)[1]
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, '\u00a0').replace(/&amp;/g, '&');
const m = JSON.parse(pre);
const chars = [...m.chars];
const W = m.w;
// the SVG's sans stack must resolve to Segoe UI on the measuring machine, or the table is not what the PNGs show
const stackIsSegoe = ['400', '600', '700'].every((wt) => W[`stack${wt}`].every((v, i) => v === W[`segoe${wt}`][i]));
console.log('stack resolves to Segoe UI:', stackIsSegoe, '| sample', JSON.stringify(m.sample));
const table = {};
for (const wt of ['400', '600', '700']) table[wt] = chars.map((c, i) => Math.max(W[`segoe${wt}`][i], W[`arial${wt}`][i]));
// Monospace: printable ASCII is in Consolas and in every mono face of the stack. Any other glyph falls back to a
// proportional face, so it takes the widest of 600, what Consolas measured (fallback included) and the bold sans width.
const isAscii = (c) => c >= ' ' && c <= '~';
const consolasMax = Math.max(...chars.map((c, i) => (isAscii(c) ? Math.max(W.consolas400[i], W.consolas700[i]) : 0)));
if (consolasMax > 600) throw new Error('Consolas ASCII is wider than the 600 mono width: ' + consolasMax);
const mono = chars.map((c, i) => (isAscii(c) ? 600 : Math.max(600, W.consolas400[i], W.consolas700[i], table['700'][i])));
console.log('consolas ASCII max', consolasMax, '| mono glyphs wider than 600:', JSON.stringify(chars.filter((c, i) => mono[i] > 600).join('')));
// report the biggest gaps between the old flat model (480/1000) and the new per-glyph sums for lowercase text
const avg = (wt, s) => [...s].reduce((a, c) => a + table[wt][chars.indexOf(c)], 0) / s.length;
for (const s of ['stop \u2192 complete-check', 'compacted \u00b7 statusline', 'UserPromptSubmit', 'PostToolUseFailure', 'Reads this folder\u2019s recent notes and lists each chat']) {
  console.log(JSON.stringify(s), 'avg em/1000: 400', avg('400', s).toFixed(0), '700', avg('700', s).toFixed(0));
}
const BS = String.fromCharCode(92); // a backslash, spelled so no shell or heredoc can fold it
const esc = (s) => s.split(BS).join(BS + BS).split("'").join(BS + "'").split(' ').join(BS + 'u00a0').split('⁠').join(BS + 'u2060');
const src = `// metrics.mjs - per-glyph advance widths for the diagram fonts, in thousandths of an em. GENERATED: do not hand-edit.
// Measured with canvas measureText in headless Edge (Windows 11) by metrics/measure.html; for each glyph and weight the
// table keeps the WIDER of Segoe UI (what Windows and the PNGs render) and Arial (metric twin of Helvetica, what most
// Mac and Linux viewers fall back to). Monospace printable ASCII is 600: at least Consolas (${consolasMax} here) and the
// advance of Courier New and Liberation Mono. Any other glyph in a monospace run falls back to a proportional face, so
// MONO keeps the widest of 600, what Consolas measured and the bold sans width. A glyph missing from the table counts
// as an em (1000), the safe side.
export const GLYPHS = '${esc(chars.join(''))}';
export const SANS = {
  400: [${table['400'].join(',')}],
  600: [${table['600'].join(',')}],
  700: [${table['700'].join(',')}],
};
export const MONO = [${mono.join(',')}];
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
`;
fs.writeFileSync(process.argv[3], src);
console.log('wrote', process.argv[3], src.length, 'bytes');
