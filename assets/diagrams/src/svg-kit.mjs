// svg-kit.mjs — a tiny SVG builder for the ai-session-handoff diagrams. Node built-ins only.
// Every diagram is 1920×1080 (16:9), white background, one type scale, one palette, one header and footer.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const W = 1920;
export const H = 1080;

export const C = {
  bg: '#FFFFFF', ink: '#0F1B2D', body: '#243247', muted: '#5B6B82', faint: '#94A3B8',
  panel: '#F7F9FC', panelLine: '#E3E9F1', cardLine: '#D7DFEA', rule: '#CBD5E1', arrow: '#64748B',
  you: '#3454D1', claude: '#C65D3B', codex: '#0F8F6B', grok: '#6A55D3', script: '#0F8A94',
  disk: '#B07A0D', git: '#475569', ok: '#2E7D32', block: '#C62828',
};
export const FONT = {
  sans: '"Segoe UI", Inter, -apple-system, "Helvetica Neue", Arial, sans-serif',
  mono: 'Consolas, "SF Mono", Menlo, "Liberation Mono", monospace',
};
// Average glyph width as a fraction of the font size; used for wrapping and pill widths (generous on purpose).
const CW = { sans: 0.48, mono: 0.58 };

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Mini markup inside text: `code` → monospace in the code colour, **bold** → weight 700.
export const plain = (s) => String(s).replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]*)\*\*/g, '$1');
export const tw = (s, size, family = 'sans') => plain(s).length * size * CW[family];

export function tint(hex, amount = 0.9) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const r = mix(n >> 16), g = mix((n >> 8) & 255), b = mix(n & 255);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function wrap(str, maxChars) {
  const tokens = String(str).match(/`[^`]*`|\*\*[^*]*\*\*|\S+/g) || [];
  const out = [];
  let cur = '';
  for (const t of tokens) {
    const next = cur ? cur + ' ' + t : t;
    if (plain(next).length > maxChars && cur) { out.push(cur); cur = t; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

export function rich(str, o = {}) {
  const { code = C.script } = o;
  return String(str).split(/(`[^`]*`|\*\*[^*]*\*\*)/g).map((part) => {
    if (!part) return '';
    if (part.startsWith('`')) return `<tspan font-family='${FONT.mono}' fill="${code}" font-size="0.94em">${esc(part.slice(1, -1))}</tspan>`;
    if (part.startsWith('**')) return `<tspan font-weight="700">${esc(part.slice(2, -2))}</tspan>`;
    return esc(part);
  }).join('');
}

export function text(x, y, str, o = {}) {
  const { size = 15, weight = 400, fill = C.body, anchor = 'start', family = 'sans', italic = false, ls, opacity, code } = o;
  const a = [`x="${x}"`, `y="${y}"`, `font-family='${FONT[family]}'`, `font-size="${size}"`, `fill="${fill}"`];
  if (weight !== 400) a.push(`font-weight="${weight}"`);
  if (anchor !== 'start') a.push(`text-anchor="${anchor}"`);
  if (italic) a.push('font-style="italic"');
  if (ls != null) a.push(`letter-spacing="${ls}"`);
  if (opacity != null) a.push(`opacity="${opacity}"`);
  const onWhiteText = fill === '#FFFFFF' || fill === '#fff';
  const inner = family === 'mono' ? esc(str) : rich(str, { code: code ?? (onWhiteText ? '#FFFFFF' : C.script) });
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
  if (label) s += text(x + 18, y + 24, label, { size: 12.5, weight: 700, fill: color, ls: 1.2 });
  return s;
}

export function chip(x, y, label, o = {}) {
  const { color = C.muted, size = 13, filled = false, family = 'sans', weight = 600, padX = 11 } = o;
  const h = o.h ?? size + 12;
  const w = o.w ?? Math.ceil(tw(label, size, family) + padX * 2);
  const fill = filled ? color : tint(color, 0.9);
  const fg = filled ? '#FFFFFF' : color;
  const svg = rect(x, y, w, h, { fill, stroke: filled ? 'none' : tint(color, 0.55), sw: 1, r: h / 2 }) +
    text(x + w / 2, y + h / 2 + size * 0.36, label, { size, weight, fill: fg, anchor: 'middle', family, code: fg });
  return { svg, w, h, x, y, right: x + w, bottom: y + h, cx: x + w / 2, cy: y + h / 2 };
}

export function badge(cx, cy, n, color = C.ink, r = 15) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>` +
    text(cx, cy + r * 0.38, String(n), { size: r * 1.05, weight: 700, fill: '#FFFFFF', anchor: 'middle' });
}

// A card: white box, optional coloured accent bar at the left, bold title, wrapped body lines.
// body items: 'string' (wrapped) or { t, family, fill, weight, italic, nowrap, size }.
export function card(o) {
  const { x, y, w, accent, title, body = [], size = 14.5, titleSize = 16, fill = C.bg, stroke = C.cardLine,
    shadow = true, pad = 14, mono = false, titleColor, lineH, maxChars, r = 12, barW = 5, titleFamily = 'sans' } = o;
  const lh = lineH ?? Math.round(size * 1.42);
  const indent = accent ? barW + 8 : 0;
  const innerX = x + pad + indent;
  const innerW = w - pad * 2 - indent;
  const fam = mono ? 'mono' : 'sans';
  const mc = maxChars ?? Math.floor(innerW / (size * CW[fam]));
  const bodyLines = body.flatMap((l) => {
    if (typeof l === 'string') return wrap(l, mc).map((t) => ({ t }));
    if (l.nowrap) return [l];
    const f = l.family ?? fam;
    const mcl = Math.floor(innerW / ((l.size ?? size) * CW[f]));
    return wrap(l.t, mcl).map((t) => ({ ...l, t }));
  });
  const n = bodyLines.length;
  const titleH = title ? Math.round(titleSize * 1.45) : 0;
  const gap = title && n ? 4 : 0;
  const contentH = n ? (n - 1) * lh + Math.round(size * 1.3) : 0;
  const h = o.h ?? pad + titleH + gap + contentH + pad;
  let s = rect(x, y, w, h, { fill, stroke, sw: 1, r, shadow });
  if (accent) s += `<rect x="${x + pad - 3}" y="${y + pad - 1}" width="${barW}" height="${h - pad * 2 + 2}" rx="2.5" fill="${accent}"/>`;
  let cy = y + pad;
  if (title) {
    const tc = titleColor ?? accent ?? C.ink;
    s += text(innerX, cy + Math.round(titleSize * 0.95), title, { size: titleSize, weight: 700, fill: tc, family: titleFamily, code: tc });
    cy += titleH + gap;
  }
  bodyLines.forEach((l, i) => {
    s += text(innerX, cy + size + i * lh, l.t, { size: l.size ?? size, fill: l.fill ?? C.body, family: l.family ?? fam, weight: l.weight ?? 400, italic: l.italic, code: l.code });
  });
  return { svg: s, h, x, y, w, bottom: y + h, right: x + w, cx: x + w / 2, cy: y + h / 2 };
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

// A label on a white pill, centred on (cx, cy).
export function pill(cx, cy, label, o = {}) {
  const { size = 12.5, color = C.muted, family = 'sans', weight = 600, fill = C.bg } = o;
  const w = Math.ceil(tw(label, size, family) + 16);
  const h = size + 9;
  return rect(cx - w / 2, cy - h / 2, w, h, { fill, stroke: tint(color, 0.5), sw: 1, r: h / 2 }) +
    text(cx, cy + size * 0.36, label, { size, weight, fill: color, anchor: 'middle', family, code: color });
}

export function arrow(pts, o = {}) {
  const { color = C.arrow, sw = 2, dashed = false, label, labelAt = 0.5, labelSize = 12.5, labelFamily = 'sans', labelColor, head = true, dx = 0, dy = 0, both = false } = o;
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
  const id = markerId(color);
  let s = `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"` +
    (dashed ? ' stroke-dasharray="6 6"' : '') + (head ? ` marker-end="url(#${id})"` : '') + (both ? ` marker-start="url(#${id})"` : '') + '/>';
  if (label) {
    const [lx, ly] = pointAt(pts, labelAt);
    s += pill(lx + dx, ly + dy, label, { size: labelSize, color: labelColor ?? color, family: labelFamily });
  }
  return s;
}

const logoCache = {};
export function logoDataUri(variant = 'dark') {
  if (!logoCache[variant]) logoCache[variant] = fs.readFileSync(path.join(here, `logo-${variant}-700.png`)).toString('base64');
  return logoCache[variant];
}

export function header(title, subtitle, o = {}) {
  const { logo = 'dark', x = 56, y = 70 } = o;
  const lw = 300, lh = Math.round((180 * lw) / 700);
  const uri = logoDataUri(logo);
  return text(x, y, title, { size: 38, weight: 700, fill: C.ink, ls: -0.4 }) +
    (subtitle ? text(x, y + 38, subtitle, { size: 19, fill: C.muted }) : '') +
    `<image x="${W - 56 - lw}" y="34" width="${lw}" height="${lh}" preserveAspectRatio="xMidYMid meet" xlink:href="data:image/png;base64,${uri}"/>`;
}

export function footer(n, legend = [], o = {}) {
  const yLine = H - 86, y = H - 44;
  let s = `<line x1="56" y1="${yLine}" x2="${W - 56}" y2="${yLine}" stroke="${C.panelLine}" stroke-width="1.5"/>`;
  s += text(56, y + 5, o.left ?? 'ai-session-handoff · one script, three tools · github.com/southlodge/ai-session-handoff', { size: 14, fill: C.muted });
  if (legend.length) {
    const size = 13.5;
    const widths = legend.map((l) => 14 + tw(l.label, size) + 26);
    const total = widths.reduce((a, b) => a + b, 0) - 26;
    let lx = o.legendX ?? Math.round(W / 2 - total / 2);
    legend.forEach((l, i) => {
      s += `<circle cx="${lx + 6}" cy="${y}" r="6" fill="${l.color}"/>` + text(lx + 20, y + 5, l.label, { size, fill: C.body, weight: 600 });
      lx += widths[i];
    });
  }
  s += text(W - 56, y + 5, `Diagram ${n} of 5`, { size: 14, fill: C.muted, anchor: 'end', weight: 600 });
  return s;
}

export function doc(body, o = {}) {
  // each document carries only the arrow markers it used; clearing here keeps a solo build identical to a full build
  const used = [...markers]; markers.clear();
  const defs = `<defs><filter id="shadow" x="-5%" y="-10%" width="110%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0F1B2D" flood-opacity="0.09"/></filter>` +
    used.map((c) => `<marker id="m${c.slice(1).toLowerCase()}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M0.5 0.8 L9.5 5 L0.5 9.2 z" fill="${c}"/></marker>`).join('') + '</defs>';
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label ?? '')}">\n${defs}\n<rect width="${W}" height="${H}" fill="${C.bg}"/>\n${body}\n</svg>\n`;
}

// A compact bottom band: a labelled panel holding up to three plain-text blocks (coloured heading + two body lines), no card chrome.
// items: [{ color, title, titleMono, body }]. Returns { svg, bottom }.
export function band(y, label, items, o = {}) {
  const x0 = o.x ?? 56, w = o.w ?? 1808, size = o.size ?? 13, lh = Math.round(size * 1.4);
  const n = items.length, gap = 28, colW = Math.floor((w - 40 - gap * (n - 1)) / n);
  let maxLines = 0;
  const blocks = items.map((it) => {
    const mc = Math.floor((colW - 14) / (size * CW.sans));
    const ls = wrap(it.body, mc);
    maxLines = Math.max(maxLines, ls.length);
    return { ...it, ls };
  });
  const h = 36 + 22 + maxLines * lh + 14;
  let s = panel(x0, y, w, h, { label });
  blocks.forEach((b, i) => {
    const bx = x0 + 20 + i * (colW + gap);
    s += `<rect x="${bx}" y="${y + 40}" width="4" height="${16 + maxLines * lh}" rx="2" fill="${b.color}"/>`;
    s += text(bx + 14, y + 54, b.title, { size: size + 1, weight: 700, fill: b.color, family: b.titleMono ? 'mono' : 'sans' });
    b.ls.forEach((l, j) => { s += text(bx + 14, y + 54 + 20 + j * lh, l, { size, fill: C.body }); });
  });
  return { svg: s, bottom: y + h, h };
}
