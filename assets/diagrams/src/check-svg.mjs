// check-svg.mjs <file.svg>... : checks the EMITTED SVG, independent of the kit's own bookkeeping.
//  contrast: every <text> and every coloured <tspan> against the shape painted under it, at WCAG AA
//            (4.5:1) whatever the size, large text included. The ground is found by
//            sampling the left, centre and right of each line and taking the topmost rect or circle
//            drawn before the text that contains the point (partial opacity is blended).
//  font:     every text, and every tspan at its em scale, is at least 12px.
//  width:    each line is measured run by run with the same per-glyph table the kit uses (metrics.mjs).
// Prints PROBLEM <file>: <rule> ... and exits 1 when anything fails.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWidth } from './metrics.mjs';

const hex6 = (h) => (h.length === 4 ? '#' + [...h.slice(1)].map((c) => c + c).join('') : h).toUpperCase();
function lum(h) {
  const n = parseInt(hex6(h).slice(1), 16);
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function blend(top, below, a) {
  const p = parseInt(hex6(top).slice(1), 16), q = parseInt(hex6(below).slice(1), 16);
  const ch = (s) => Math.round(((p >> s) & 255) * a + ((q >> s) & 255) * (1 - a));
  return '#' + [ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function attrs(tag) {
  const o = {};
  for (const m of tag.matchAll(/([a-zA-Z:-]+)=("([^"]*)"|'([^']*)')/g)) o[m[1]] = m[3] ?? m[4];
  return o;
}
const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// Width of one text element from its inner markup: plain runs in the text family and weight, each tspan in its own
// family, weight and em size, plus any letter-spacing per glyph.
function measure(inner, size, fam, weight, ls) {
  let w = 0, glyphs = 0;
  for (const part of inner.split(/(<tspan\b[^>]*>[\s\S]*?<\/tspan>)/g)) {
    if (!part) continue;
    const sp = part.match(/^<tspan\b([^>]*)>([\s\S]*?)<\/tspan>$/);
    const a = sp ? attrs(sp[1]) : {};
    const str = unesc(sp ? sp[2] : part);
    const em = a['font-size'] && a['font-size'].endsWith('em') ? parseFloat(a['font-size']) : 1;
    const f = a['font-family'] ? (/^Consolas/.test(a['font-family']) ? 'mono' : 'sans') : fam;
    w += runWidth(str, size * em, f, Number(a['font-weight'] ?? weight));
    glyphs += [...str].length;
  }
  return w + ls * glyphs;
}

export function checkSvg(svg) {
  const problems = [];
  const body = svg.replace(/<defs>[\s\S]*?<\/defs>/g, ''); // markers and filters are not grounds
  const shapes = [];
  const texts = [];
  const re = /<(rect|circle)\b([^>]*)\/?>|<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    if (m[1]) {
      const a = attrs(m[2]);
      if (a.fill === 'none') continue;
      const fill = a.fill ?? '#000000';
      if (!fill.startsWith('#')) continue; // url(...) paints are not used by this kit
      const op = a.opacity != null ? Number(a.opacity) : 1;
      if (m[1] === 'rect') shapes.push({ kind: 'rect', x: +(a.x ?? 0), y: +(a.y ?? 0), w: +a.width, h: +a.height, fill, op, at: shapes.length, pos: m.index });
      else shapes.push({ kind: 'circle', cx: +a.cx, cy: +a.cy, r: +a.r, fill, op, at: shapes.length, pos: m.index });
    } else {
      texts.push({ a: attrs(m[3]), inner: m[4], pos: m.index });
    }
  }
  const inside = (s, x, y) => (s.kind === 'rect' ? x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h
    : (x - s.cx) ** 2 + (y - s.cy) ** 2 <= s.r * s.r);
  function groundAt(x, y, before) {
    for (let i = before - 1; i >= 0; i--) {
      const s = shapes[i];
      if (!inside(s, x, y)) continue;
      return s.op >= 1 ? s.fill : blend(s.fill, groundAt(x, y, i), s.op);
    }
    return '#FFFFFF'; // no canvas rect: an SVG viewer's default ground
  }
  for (const t of texts) {
    const size = Number(t.a['font-size'] ?? 16);
    const fam = /^Consolas/.test(t.a['font-family'] ?? '') ? 'mono' : 'sans';
    const weight = Number(t.a['font-weight'] ?? 400);
    const fill = t.a.fill ?? '#000000';
    const plainText = unesc(t.inner.replace(/<[^>]+>/g, ''));
    const w = measure(t.inner, size, fam, weight, Number(t.a['letter-spacing'] ?? 0));
    const x = Number(t.a.x), y = Number(t.a.y);
    const anchor = t.a['text-anchor'] ?? 'start';
    const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    const cy = y - size * 0.32;
    const before = shapes.filter((s) => s.pos < t.pos).length;
    const grounds = [...new Set([x0 + 2, x0 + w / 2, x0 + w - 2].map((px) => groundAt(px, cy, before)))];
    const label = plainText.length > 48 ? plainText.slice(0, 45) + '...' : plainText;
    const need = () => 4.5; // every text at AA (4.5:1), large or not
    const runs = [{ fill, size, weight }];
    for (const sp of t.inner.matchAll(/<tspan\b([^>]*)>/g)) {
      const b = attrs(sp[1]);
      const em = b['font-size'] && b['font-size'].endsWith('em') ? parseFloat(b['font-size']) : 1;
      runs.push({ fill: b.fill ?? fill, size: size * em, weight: Number(b['font-weight'] ?? weight) });
    }
    for (const r of runs) {
      if (r.size < 12 - 1e-9) problems.push(`font ${r.size.toFixed(2)}px "${label}"`);
      for (const g of grounds) {
        const c = ratio(r.fill, g);
        if (c < need(r.size, r.weight) - 1e-9) problems.push(`contrast ${c.toFixed(2)} fg=${hex6(r.fill)} ground=${g} ${r.size.toFixed(1)}px "${label}"`);
      }
    }
  }
  return [...new Set(problems)];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let bad = 0;
  for (const f of process.argv.slice(2)) {
    const p = checkSvg(fs.readFileSync(f, 'utf8'));
    for (const x of p) console.log(`PROBLEM ${path.basename(f)}: ${x}`);
    console.log(`${p.length ? 'PROBLEM' : 'OK'} ${path.basename(f)} (${p.length})`);
    if (p.length) bad++;
  }
  process.exit(bad ? 1 : 0);
}
