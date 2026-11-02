// svg-kit.mjs - a tiny SVG builder for the ai-session-handoff diagrams. Node built-ins only.
// Every diagram is 1920×1080 (16:9), one type scale, one palette, one header and footer.
// Two themes share one palette object C: setTheme('dark') swaps its values in place so modules keep using C.xxx.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWidth } from './metrics.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const W = 1920;
export const H = 1080;

// Two palettes, same keys. The hues are spread so any two colours that share a legend differ by at least 20 in
// CIEDE2000 (build.mjs measures every legend it draws). Text drawn in a lane colour is deepened (light theme) or
// lightened (dark theme) by readable() until it reaches 4.5:1; bars, arrows and legend swatches keep the palette value.
// The default export C starts as the light palette.
const PALETTES = {
  light: {
    bg: '#FFFFFF', ink: '#0F1B2D', body: '#243247', muted: '#5B6B82', faint: '#94A3B8',
    panel: '#F7F9FC', panelLine: '#E3E9F1', cardLine: '#D7DFEA', rule: '#CBD5E1', arrow: '#64748B',
    you: '#2F5BD3', claude: '#C65D3B', codex: '#1F8A4C', grok: '#9B3DBF', script: '#0B7D90',
    disk: '#B07A0D', git: '#505358', block: '#C62828',
  },
  dark: {
    bg: '#0F1B2D', ink: '#F2F6FB', body: '#D6DEEA', muted: '#9FB0C6', faint: '#7E90A9',
    panel: '#16233A', panelLine: '#26344D', cardLine: '#2E3F5C', rule: '#2A3A54', arrow: '#8595AD',
    you: '#7FA2F7', claude: '#F0906A', codex: '#56C77E', grok: '#D18BF0', script: '#3EBBD6',
    disk: '#E3AC45', git: '#B5B8BE', block: '#F2705A',
  },
};
export const C = { ...PALETTES.light };
let currentTheme = 'light';
export function setTheme(name) {
  currentTheme = name === 'dark' ? 'dark' : 'light';
  Object.assign(C, PALETTES[currentTheme]); // same key set, so no stale values linger
  return currentTheme;
}
export function getTheme() { return currentTheme; }

export const FONT = {
  sans: '"Segoe UI", Inter, -apple-system, "Helvetica Neue", Arial, sans-serif',
  mono: 'Consolas, "SF Mono", Menlo, "Liberation Mono", monospace',
};
// Text width comes from metrics.mjs: measured per-glyph advances (the wider of Segoe UI and Arial, per weight) plus a
// 4% margin. One function, tw(), sizes wrapping, chips, pills and the geometry registry, so a wrapped line and its
// recorded box always agree. Code spans are set at 0.94em of the text around them, but never under 12 px.
export const codeEm = (size) => (size && size * 0.94 < 12 ? Math.ceil(1200 / size) / 100 : 0.94);

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Mini markup inside text: `code` → monospace in the code colour, **bold** → weight 700.
export const plain = (s) => String(s).replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]*)\*\*/g, '$1');
// Width in px of a string with the mini markup: code spans are measured in the mono table at their real em size,
// bold spans in the 700 table, everything else at the given weight. Mono text is drawn raw, so it is measured raw.
export function tw(s, size, family = 'sans', weight = 400) {
  if (family === 'mono') return runWidth(String(s), size, 'mono');
  let w = 0;
  for (const part of String(s).split(/(`[^`]*`|\*\*[^*]*\*\*)/g)) {
    if (!part) continue;
    if (part.startsWith('`')) w += runWidth(part.slice(1, -1), size * codeEm(size), 'mono');
    else if (part.startsWith('**')) w += runWidth(part.slice(2, -2), size, 'sans', 700);
    else w += runWidth(part, size, family, weight);
  }
  return w;
}

export function tint(hex, amount = 0.9) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const r = mix(n >> 16), g = mix((n >> 8) & 255), b = mix(n & 255);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}
// Linear blend from a toward b; t=0 → a, t=1 → b. Used for theme-aware chip grounds.
export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return '#' + [ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ---- contrast ---------------------------------------------------------------
// WCAG 2.x relative luminance and contrast ratio. AA (4.5:1) is the floor for every piece of text, in both themes.
export const AA = 4.5;
export function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}
export function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
// The text colour actually drawn: fg itself when it reaches AA on every ground, otherwise fg stepped away from the
// grounds (toward black on light grounds, toward white on dark ones) in 2% steps until it does. A lane colour keeps
// its hue as text, just deep enough to read; non-text marks (bars, arrows, legend dots) keep the palette value.
export function readable(fg, grounds, need = AA) {
  const gs = grounds ?? [C.bg, C.panel];
  const ok = (c) => gs.every((g) => contrast(c, g) >= need);
  if (ok(fg)) return fg;
  const lightGround = gs.reduce((a, g) => a + luminance(g), 0) / gs.length > luminance(fg);
  const toward = lightGround ? '#000000' : '#ffffff';
  for (let i = 1; i <= 50; i++) { const c = mix(fg, toward, i / 50); if (ok(c)) return c; }
  return toward;
}
// The fill for a shape that carries text in colour fg (a badge, a filled chip): the shape is stepped away from fg
// until fg reaches AA on it.
export function shapeFor(shape, fg, need = AA) {
  if (contrast(shape, fg) >= need) return shape;
  const toward = luminance(fg) > luminance(shape) ? '#000000' : '#ffffff';
  for (let i = 1; i <= 50; i++) { const c = mix(shape, toward, i / 50); if (contrast(c, fg) >= need) return c; }
  return toward;
}

// ---- colour difference -----------------------------------------------------
// CIEDE2000 (Sharma, Wu and Dalal 2005) between two sRGB hex colours, D65 white. build.mjs requires any two legend
// swatches of different colours to differ by at least 20, and two swatches of one colour to differ in shape.
function lab(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const r = lin((n >> 16) & 255), g = lin((n >> 8) & 255), b = lin(n & 255);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b) / 1.0;
  const Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function deltaE00(h1, h2) {
  const [L1, a1, b1] = lab(h1), [L2, a2, b2] = lab(h2);
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hp = (a, b) => (a === 0 && b === 0 ? 0 : (Math.atan2(b, a) * deg + 360) % 360);
  const h1p = hp(a1p, b1), h2p = hp(a2p, b2);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) { if (Math.abs(h1p - h2p) > 180) hbp += h1p + h2p < 360 ? 360 : -360; hbp /= 2; }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.20 * Math.cos((4 * hbp - 63) * rad);
  const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const SC = 1 + 0.045 * Cbp, SH = 1 + 0.015 * Cbp * T;
  const RT = -Math.sin(2 * dTh * rad) * RC;
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}

// ---- geometry registry -----------------------------------------------------
// An in-memory list of boxes {kind:'card'|'text'|'pill'|'chip'|'lane'|'band'|'foot'|'arrow', x,y,w,h, id, parent?, owner?, lane?, key?, size?}.
// An arrow also carries pts (its polyline), sw, head and tail (the px of shaft each arrowhead covers) and pill (its label's box id).
// Reset per document (like the marker set): doc() snapshots the boxes into lastBoxes, then clears, so a solo build
// and a full build record the same thing. build.mjs reads them with takeBoxes() right after render().
let boxes = [];
let boxSeq = 0;
let lastBoxes = [];
function reg(b) { b.id = ++boxSeq; boxes.push(b); return b; }
export function registerBox(b) { return reg(b); } // sequence.mjs registers its lane boxes through this
export function takeBoxes() { return lastBoxes; }
// For text drawn outside card(), chip(), pill() and band(): sequence.mjs registers lane and column labels and notes.
export function registerText(x, baseline, str, size, family = 'sans', anchor = 'start', extra = {}) {
  return pushTextBox(x, baseline, str, size, family, anchor, extra);
}
// Record the bounding box of a line of text drawn with its baseline at (x, baseline).
// extra may carry weight (for the width), parent or owner (the box it belongs to) and limit {x0, x1} (a span it must stay in).
function pushTextBox(x, baseline, str, size, family, anchor, extra = {}) {
  const w = tw(str, size, family, extra.weight ?? 400);
  let bx = x;
  if (anchor === 'middle') bx = x - w / 2;
  else if (anchor === 'end') bx = x - w;
  return reg({ kind: 'text', x: bx, y: baseline - size * 0.80, w, h: size * 1.05, size, ...extra });
}

// Greedy word wrap by measured width: maxW is in px at the given size, family and weight. A separator such as an
// arrow or a middle dot is glued to the word after it, so no line ends on a dangling arrow.
// Only a space, tab or newline ends a word, so a no-break space (\u00a0) keeps a number with its unit.
const SEPARATORS = new Set(['\u2192', '\u2190', '\u00b7', '\u2013', '\u2014', '/', '+', '&', '=']);
export function wrap(str, maxW, o = {}) {
  const { size = 15, family = 'sans', weight = 400 } = o;
  const raw = String(str).match(/(?:`[^`]*`|\*\*[^*]*\*\*|[^ \t\r\n`]|`)+/g) || [];
  const tokens = [];
  for (let i = 0; i < raw.length; i++) {
    if (SEPARATORS.has(raw[i]) && i + 1 < raw.length) { tokens.push(raw[i] + ' ' + raw[i + 1]); i++; }
    else tokens.push(raw[i]);
  }
  const lines = [];
  let cur = [];
  for (const t of tokens) {
    if (cur.length && tw([...cur, t].join(' '), size, family, weight) > maxW) { lines.push(cur); cur = [t]; } else cur.push(t);
  }
  if (cur.length) lines.push(cur);
  // No runt: a one-word last line takes the word before it, if the line above keeps two words and the pair fits.
  const n = lines.length;
  if (n > 1 && lines[n - 1].length === 1 && lines[n - 2].length > 2) {
    const pair = [lines[n - 2].at(-1), lines[n - 1][0]];
    if (tw(pair.join(' '), size, family, weight) <= maxW) { lines[n - 2] = lines[n - 2].slice(0, -1); lines[n - 1] = pair; }
  }
  return lines.map((l) => l.join(' '));
}

export function rich(str, o = {}) {
  const { code = C.script, size } = o;
  const em = codeEm(size); // code never drops under 12 px
  return String(str).split(/(`[^`]*`|\*\*[^*]*\*\*)/g).map((part) => {
    if (!part) return '';
    if (part.startsWith('`')) return `<tspan font-family='${FONT.mono}' fill="${code}" font-size="${em}em">${esc(part.slice(1, -1))}</tspan>`;
    if (part.startsWith('**')) return `<tspan font-weight="700">${esc(part.slice(2, -2))}</tspan>`;
    return esc(part);
  }).join('');
}

export function text(x, y, str, o = {}) {
  const { size = 15, weight = 400, fill: want = C.body, anchor = 'start', family = 'sans', italic = false, ls, opacity, code, role, ground } = o;
  // ground: the colour(s) this text sits on; the default is the two canvas grounds (cards and white lanes, grey lanes)
  const fill = readable(want, ground);
  const a = [`x="${x}"`, `y="${y}"`, `font-family='${FONT[family]}'`, `font-size="${size}"`, `fill="${fill}"`];
  if (weight !== 400) a.push(`font-weight="${weight}"`);
  if (anchor !== 'start') a.push(`text-anchor="${anchor}"`);
  if (italic) a.push('font-style="italic"');
  if (ls != null) a.push(`letter-spacing="${ls}"`);
  if (opacity != null) a.push(`opacity="${opacity}"`);
  if (role) a.push(`data-role="${role}"`); // lets build.mjs extract lane/column/band/legend text exactly
  const onWhiteText = want === '#FFFFFF' || want === '#fff';
  const inner = family === 'mono' ? esc(str) : rich(str, { size, code: readable(code ?? (onWhiteText ? '#FFFFFF' : C.script), ground) });
  return `<text ${a.join(' ')}>${inner}</text>`;
}

export function lines(x, y, arr, o = {}) {
  const size = o.size ?? 15;
  const lh = o.lineH ?? size * 1.4;
  return arr.map((l, i) => (typeof l === 'string' ? text(x, y + i * lh, l, o) : text(x, y + i * lh, l.t, { ...o, ...l }))).join('');
}

export function rect(x, y, w, h, o = {}) {
  const { fill = C.bg, stroke = 'none', sw = 1, r = 12, dash, shadow = false, opacity } = o;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"` +
    (dash ? ` stroke-dasharray="${dash}"` : '') + (shadow ? ' filter="url(#shadow)"' : '') +
    (opacity != null ? ` opacity="${opacity}"` : '') + '/>';
}

// A soft background region with a small uppercase label in its top-left corner.
export function panel(x, y, w, h, o = {}) {
  const { label, color = C.muted, fill = C.panel, stroke = C.panelLine, dash } = o;
  let s = rect(x, y, w, h, { fill, stroke, r: 16, dash });
  if (label) s += text(x + 18, y + 24, label, { size: 12.5, weight: 700, fill: color, ls: 1.2, ground: [fill] });
  return s;
}

export function chip(x, y, label, o = {}) {
  const { color = C.muted, size = 13, filled = false, family = 'sans', weight = 600, padX = 11, probe = false } = o;
  const h = o.h ?? size + 12;
  const w = o.w ?? Math.ceil(tw(label, size, family, weight) + padX * 2);
  const dark = currentTheme === 'dark';
  const onFill = dark ? C.bg : '#FFFFFF';
  const fill = filled ? shapeFor(color, onFill) : (dark ? mix(color, C.bg, 0.80) : tint(color, 0.9));
  const stroke = filled ? 'none' : (dark ? mix(color, C.bg, 0.45) : tint(color, 0.55));
  const fg = filled ? onFill : color;
  const by = y + h / 2 + size * 0.36;
  const svg = rect(x, y, w, h, { fill, stroke, sw: 1, r: h / 2 }) +
    text(x + w / 2, by, label, { size, weight, fill: fg, anchor: 'middle', family, code: fg, ground: [fill] });
  if (!probe) { // probe: a measurement pass (e.g. a chipRow laying out at the origin) registers nothing
    const box = reg({ kind: 'chip', x, y, w, h });
    pushTextBox(x + w / 2, by, label, size, family, 'middle', { owner: box.id, weight });
  }
  return { svg, w, h, x, y, right: x + w, bottom: y + h, cx: x + w / 2, cy: y + h / 2 };
}

export function badge(cx, cy, n, color = C.ink, r = 15) {
  const fg = currentTheme === 'dark' ? C.bg : '#FFFFFF'; // dark number on a light accent in dark theme
  const by = cy + r * 0.38;
  const disc = shapeFor(color, fg);
  const svg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${disc}"/>` +
    text(cx, by, String(n), { size: r * 1.05, weight: 700, fill: fg, anchor: 'middle', ground: [disc] });
  const box = reg({ kind: 'pill', x: cx - r, y: cy - r, w: 2 * r, h: 2 * r });
  pushTextBox(cx, by, String(n), r * 1.05, 'sans', 'middle', { owner: box.id, weight: 700 });
  return svg;
}

// A card: box, optional coloured accent bar at the left, bold title, wrapped body lines.
// body items: 'string' (wrapped) or { t, family, fill, weight, italic, nowrap, size }.
// mark: a short grey chip at the top-right inside the card; the title wraps so it never meets the chip.
// probe: measure height only, register nothing (sequence.cell uses it to place the real card).
export function card(o) {
  const { x, y, w, accent, title, body = [], size = 15, titleSize = 17, fill = C.bg, stroke = C.cardLine,
    shadow = true, pad = 14, mono = false, titleColor, lineH, r = 12, barW = 5, titleFamily = 'sans', mark, probe = false } = o;
  const lh = lineH ?? Math.round(size * 1.42);
  const indent = accent ? barW + 8 : 0;
  const innerX = x + pad + indent;
  const innerW = w - pad * 2 - indent;
  const fam = mono ? 'mono' : 'sans';
  const bodyLines = body.flatMap((l) => {
    if (typeof l === 'string') return wrap(l, innerW, { size, family: fam }).map((t) => ({ t }));
    if (l.nowrap) return [l];
    const ls = wrap(l.t, innerW, { size: l.size ?? size, family: l.family ?? fam, weight: l.weight ?? 400 });
    return ls.map((t) => ({ ...l, t }));
  });
  const n = bodyLines.length;

  // mark chip: top-right, inside the card bounds
  const markSize = 12.5, markPadX = 9;
  let markBox = null;
  if (mark) {
    const mw = Math.ceil(tw(mark, markSize, 'sans', 600) + markPadX * 2);
    const mh = Math.round(markSize + 9);
    markBox = { w: mw, h: mh, x: x + w - pad - mw, y: y + pad - 1 };
  }

  // the title wraps to the width left of the mark chip, or to the full inner width when there is no mark
  const titleLH = Math.round(titleSize * 1.3);
  const titleAvail = mark ? Math.max(40, markBox.x - 10 - innerX) : innerW;
  const titleLines = title ? wrap(title, titleAvail, { size: titleSize, family: titleFamily, weight: 700 }) : [];
  const titleH = title ? Math.round(titleSize * 1.45) + (titleLines.length - 1) * titleLH : 0;

  const gap = title && n ? 4 : 0;
  const contentH = n ? (n - 1) * lh + Math.round(size * 1.3) : 0;
  const h = o.h ?? pad + titleH + gap + contentH + pad;

  // mark and same feed the mark-or-same rule: in 03 and 04 every lane card says either how it differs or that it is the same
  const cardBox = probe ? null : reg({ kind: 'card', x, y, w, h, lines: n, mark: mark ?? null, same: !!o.same,
    title: title ?? '', text: body.map((l) => (typeof l === 'string' ? l : l.t)).join(' | ') });

  let s = rect(x, y, w, h, { fill, stroke, sw: 1, r, shadow });
  if (accent) s += `<rect x="${x + pad - 3}" y="${y + pad - 1}" width="${barW}" height="${h - pad * 2 + 2}" rx="2.5" fill="${accent}"/>`;

  if (markBox) {
    const mby = markBox.y + markBox.h / 2 + markSize * 0.36;
    s += rect(markBox.x, markBox.y, markBox.w, markBox.h, { fill: C.panel, stroke: C.cardLine, sw: 1, r: markBox.h / 2 });
    s += text(markBox.x + markBox.w / 2, mby, mark, { size: markSize, weight: 600, fill: C.muted, anchor: 'middle', code: C.muted, ground: [C.panel] });
    if (!probe) {
      const chipId = reg({ kind: 'chip', x: markBox.x, y: markBox.y, w: markBox.w, h: markBox.h, parent: cardBox.id }).id;
      pushTextBox(markBox.x + markBox.w / 2, mby, mark, markSize, 'sans', 'middle', { owner: chipId, parent: cardBox.id, weight: 600 });
    }
  }

  let cy = y + pad;
  if (titleLines.length) {
    const tc = titleColor ?? accent ?? C.ink;
    titleLines.forEach((tl, j) => {
      const by = cy + Math.round(titleSize * 0.95) + j * titleLH;
      s += text(innerX, by, tl, { size: titleSize, weight: 700, fill: tc, family: titleFamily, code: tc, ground: [fill] });
      if (!probe) pushTextBox(innerX, by, tl, titleSize, titleFamily, 'start', { parent: cardBox.id, weight: 700 });
    });
    cy += titleH + gap;
  }
  bodyLines.forEach((l, i) => {
    const by = cy + size + i * lh;
    s += text(innerX, by, l.t, { size: l.size ?? size, fill: l.fill ?? C.body, family: l.family ?? fam, weight: l.weight ?? 400, italic: l.italic, code: l.code, ground: [fill] });
    if (!probe) pushTextBox(innerX, by, l.t, l.size ?? size, l.family ?? fam, 'start', { parent: cardBox.id, weight: l.weight ?? 400 });
  });
  return { svg: s, h, x, y, w, bottom: y + h, right: x + w, cx: x + w / 2, cy: y + h / 2, box: cardBox };
}

// Arrows. Markers are registered per colour and emitted by doc().
const markers = new Set();
const markerId = (color) => { markers.add(color); return 'm' + color.slice(1).toLowerCase(); };

function pointAt(pts, t) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(L); total += L;
  }
  let d = total * t;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const f = segs[i] ? d / segs[i] : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
    }
    d -= segs[i];
  }
  return pts[pts.length - 1];
}

// The width of a pill: its label plus 8 px each side. arrow() uses it to decide where a label fits.
const pillWidth = (label, size, family, weight) => Math.ceil(tw(label, size, family, weight) + 16);
// A label on a pill (panel fill), centred on (cx, cy).
export function pill(cx, cy, label, o = {}) {
  const { size = 12.5, color = C.muted, family = 'sans', weight = 600, fill = C.bg } = o;
  const w = pillWidth(label, size, family, weight);
  const h = size + 9;
  const by = cy + size * 0.36;
  const svg = rect(cx - w / 2, cy - h / 2, w, h, { fill, stroke: tint(color, 0.5), sw: 1, r: h / 2 }) +
    text(cx, by, label, { size, weight, fill: color, anchor: 'middle', family, code: color, ground: [fill] });
  const box = reg({ kind: 'pill', x: cx - w / 2, y: cy - h / 2, w, h });
  pushTextBox(cx, by, label, size, family, 'middle', { owner: box.id, weight });
  return svg;
}

// The arrowhead marker (emitted by doc()) is a 10-unit viewBox drawn 6.5 stroke widths wide, so one unit is 0.65 sw.
// Its back edge sits 8.5 units behind refX, so the head covers HEAD_BACK = 5.525 sw of the shaft before the end point;
// it is 8.4 units tall, a half-width of HEAD_HALF = 2.73 sw. The registry carries these lengths to build.mjs.
export const HEAD_BACK = 5.525;
const HEAD_HALF = 2.73;
function pathLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

// weight: 'primary' (2.5 px solid) | 'secondary' (1.75 px dashed). Explicit sw / dashed still override.
// A label rides on a pill centred on the shaft at labelAt; dx / dy move it. On a straight vertical or horizontal arrow
// too short to show 4 px of shaft before the head and 6 px after the tail around that pill, the pill moves beside the
// shaft instead, clear of the arrowhead: right of a vertical arrow (labelSide 'left' for the other side), above a
// horizontal one (labelSide 'below'). Every arrow is registered (kind 'arrow') for the build's arrow checks.
export function arrow(pts, o = {}) {
  const { color = C.arrow, label, labelAt = 0.5, labelSize = 12.5, labelFamily = 'sans', labelColor, labelSide, head = true, dx, dy, both = false, weight } = o;
  let sw = o.sw, dashed = o.dashed;
  if (weight === 'primary') { if (sw == null) sw = 2.5; if (dashed == null) dashed = false; }
  else if (weight === 'secondary') { if (sw == null) sw = 1.75; if (dashed == null) dashed = true; }
  if (sw == null) sw = 2;
  if (dashed == null) dashed = false;
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
  const id = markerId(color);
  let s = `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"` +
    (dashed ? ' stroke-dasharray="6 6"' : '') + (head ? ` marker-end="url(#${id})"` : '') + (both ? ` marker-start="url(#${id})"` : '') + '/>';
  const headLen = head ? HEAD_BACK * sw : 0, tailLen = both ? HEAD_BACK * sw : 0;
  let pillId = null;
  if (label) {
    const [lx, ly] = pointAt(pts, labelAt);
    let ox = dx ?? 0, oy = dy ?? 0;
    const [x0, y0] = pts[0], [x1, y1] = pts[pts.length - 1];
    const vertical = pts.length === 2 && x0 === x1, horizontal = pts.length === 2 && y0 === y1;
    if (dx == null && dy == null && (vertical || horizontal)) {
      const pw = pillWidth(label, labelSize, labelFamily, 600), ph = labelSize + 9;
      const L = pathLength(pts), along = labelAt * L, half = (vertical ? ph : pw) / 2;
      if (L - along - half < headLen + 4 || along - half < tailLen + 6) {
        const gap = Math.ceil(HEAD_HALF * sw + 3);
        if (vertical) ox = (labelSide === 'left' ? -1 : 1) * (pw / 2 + gap);
        else oy = (labelSide === 'below' ? 1 : -1) * (ph / 2 + gap);
      }
    }
    const before = boxes.length;
    s += pill(lx + ox, ly + oy, label, { size: labelSize, color: labelColor ?? color, family: labelFamily });
    pillId = boxes.slice(before).find((b) => b.kind === 'pill')?.id ?? null;
  }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), pad = HEAD_HALF * sw;
  reg({ kind: 'arrow', pts: pts.map((p) => [p[0], p[1]]), sw, head: headLen, tail: tailLen, pill: pillId,
    x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + 2 * pad, h: Math.max(...ys) - Math.min(...ys) + 2 * pad });
  return s;
}

const logoCache = {};
export function logoDataUri(variant = 'dark') {
  if (!logoCache[variant]) logoCache[variant] = fs.readFileSync(path.join(here, `logo-${variant}-700.png`)).toString('base64');
  return logoCache[variant];
}

export function header(title, subtitle, o = {}) {
  const { logo = currentTheme === 'dark' ? 'white' : 'dark', x = 56, y = 70 } = o; // white logo on the dark background
  const lw = 300, lh = Math.round((180 * lw) / 700);
  const uri = logoDataUri(logo);
  return text(x, y, title, { size: 38, weight: 700, fill: C.ink, ls: -0.4 }) +
    (subtitle ? text(x, y + 38, subtitle, { size: 20, fill: C.muted }) : '') +
    `<image x="${W - 56 - lw}" y="34" width="${lw}" height="${lh}" preserveAspectRatio="xMidYMid meet" xlink:href="data:image/png;base64,${uri}"/>`;
}

export function footer(n, legend = [], o = {}) {
  const yLine = H - 86, y = H - 44;
  let s = `<line x1="56" y1="${yLine}" x2="${W - 56}" y2="${yLine}" stroke="${C.panelLine}" stroke-width="1.5"/>`;
  // The three footer parts (credit line, legend, page number) are registered as foot boxes so build.mjs can
  // require clear space between them.
  const fy = y + 5 - 14 * 0.8, fh = 14 * 1.05;
  const left = o.left ?? 'ai-session-handoff · one script, three tools · github.com/southlodge/ai-session-handoff';
  s += text(56, y + 5, left, { size: 14, fill: C.muted });
  reg({ kind: 'foot', x: 56, y: fy, w: tw(left, 14), h: fh });
  if (legend.length) {
    // each entry is a swatch then its label: a dot for a lane colour, a short dashed line for an arrow style
    const size = 13.5;
    const sw = (l) => (l.line ? 26 : 12);
    const widths = legend.map((l) => sw(l) + 8 + tw(l.label, size, 'sans', 600) + 26);
    const total = widths.reduce((a, b) => a + b, 0) - 26;
    // centred in the free space between the credit line and the page number, not on the canvas middle: the
    // credit line is long, so a canvas-centred legend ran into it
    const creditEnd = 56 + tw(left, 14), pageX = W - 56 - tw(`Diagram ${n} of 5`, 14, 'sans', 600);
    let lx = o.legendX ?? Math.round((creditEnd + pageX) / 2 - total / 2);
    reg({ kind: 'foot', x: lx, y: fy, w: total, h: fh });
    legend.forEach((l, i) => {
      s += l.line
        ? `<line x1="${lx + 1}" y1="${y}" x2="${lx + 25}" y2="${y}" stroke="${l.color}" stroke-width="2" stroke-linecap="round" stroke-dasharray="5 5" data-role="legend-swatch"/>`
        : `<circle cx="${lx + 6}" cy="${y}" r="6" fill="${l.color}" data-role="legend-swatch"/>`;
      s += text(lx + sw(l) + 8, y + 5, l.label, { size, fill: C.body, weight: 600, role: 'legend' });
      lx += widths[i];
    });
  }
  const page = `Diagram ${n} of 5`, pw = tw(page, 14, 'sans', 600);
  s += text(W - 56, y + 5, page, { size: 14, fill: C.muted, anchor: 'end', weight: 600 });
  reg({ kind: 'foot', x: W - 56 - pw, y: fy, w: pw, h: fh });
  return s;
}

export function doc(body, o = {}) {
  // each document carries only the arrow markers it used; clearing here keeps a solo build identical to a full build
  const used = [...markers]; markers.clear();
  // snapshot the geometry registry for build.mjs (takeBoxes), then reset for the next document
  lastBoxes = boxes; boxes = []; boxSeq = 0;
  const shadowFlood = currentTheme === 'dark' ? '#000000' : '#0F1B2D';
  const defs = `<defs><filter id="shadow" x="-5%" y="-10%" width="110%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${shadowFlood}" flood-opacity="0.09"/></filter>` +
    used.map((c) => `<marker id="m${c.slice(1).toLowerCase()}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M0.5 0.8 L9.5 5 L0.5 9.2 z" fill="${c}"/></marker>`).join('') + '</defs>';
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label ?? '')}">\n${defs}\n<rect width="${W}" height="${H}" fill="${C.bg}"/>\n${body}\n</svg>\n`;
}

// A compact bottom band: a labelled panel holding up to three plain-text blocks (coloured heading + body lines), no card chrome.
// items: [{ color, title, titleMono, body }]. Returns { svg, bottom, h }.
export function band(y, label, items, o = {}) {
  const x0 = o.x ?? 56, w = o.w ?? 1808, size = o.size ?? 14.5, lh = Math.round(size * 1.4);
  const n = items.length, gap = 28, colW = Math.floor((w - 40 - gap * (n - 1)) / n);
  let maxLines = 0;
  const blocks = items.map((it) => {
    const ls = wrap(it.body, colW - 14, { size });
    maxLines = Math.max(maxLines, ls.length);
    return { ...it, ls };
  });
  const h = 36 + 22 + maxLines * lh + 14;
  let s = panel(x0, y, w, h, { label });
  const bandBox = o.probe ? null : reg({ kind: 'band', x: x0, y, w, h });
  blocks.forEach((b, i) => {
    const bx = x0 + 20 + i * (colW + gap);
    const tf = b.titleMono ? 'mono' : 'sans';
    const limit = { x0: bx, x1: bx + colW }; // each block keeps to its own column
    s += `<rect x="${bx}" y="${y + 40}" width="4" height="${16 + maxLines * lh}" rx="2" fill="${b.color}"/>`;
    s += text(bx + 14, y + 54, b.title, { size: size + 1, weight: 700, fill: b.color, family: tf, role: 'band-title', ground: [C.panel] });
    if (bandBox) pushTextBox(bx + 14, y + 54, b.title, size + 1, tf, 'start', { parent: bandBox.id, weight: 700, limit });
    b.ls.forEach((l, j) => {
      const by = y + 54 + 20 + j * lh;
      s += text(bx + 14, by, l, { size, fill: C.body, ground: [C.panel] });
      if (bandBox) pushTextBox(bx + 14, by, l, size, 'sans', 'start', { parent: bandBox.id, limit });
    });
  });
  return { svg: s, bottom: y + h, h };
}
