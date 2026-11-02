// build.mjs - renders every NN-*.mjs diagram module to <outDir>/<name>.svg (light) or <name>.dark.svg (--theme dark).
// Usage: node build.mjs [outDir] [prefix] [--theme dark]   (--theme dark may appear anywhere in argv)
// Per file it runs structural checks (tag balance, forbidden elements, placeholders), the geometry checks on the
// kit's box registry, the arrow checks on the same registry (a label pill never on a card; an arrow never through a
// card it joins, under a card it passes, over free text or over another arrow's label; every arrow long enough to show
// shaft beside its heads; a centred label clear of the arrowhead and the tail), the contrast and font checks on the
// emitted SVG, the legend colour-distance check and, for 03 and 04, the mark-or-same check. Across the 02/03/04
// trio it runs the family-consistency check and the strict same-check (a card declared the same as Claude Code
// must match a 02 card in its lane, and a "differs" card must not), and against the kit README the alt-text check
// (each diagram's <img> alt is its aria-label, word for word). It prints the active theme's WCAG contrast ratios,
// then OK/PROBLEM per file. Any problem exits 1.
// A problem prints: PROBLEM <file>: <rule> <x,y,w,h>.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { setTheme, takeBoxes, C, deltaE00 } from './svg-kit.mjs';
import { checkSvg } from './check-svg.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// ---- argv: positionals [outDir, prefix]; --theme dark|light anywhere ----
const raw = process.argv.slice(2);
let theme = 'light';
const pos = [];
for (let i = 0; i < raw.length; i++) {
  const a = raw[i];
  if (a === '--theme') { if (raw[i + 1] === 'dark') theme = 'dark'; if (raw[i + 1]) i++; continue; }
  if (a === '--theme=dark') { theme = 'dark'; continue; }
  if (a === '--theme=light') { theme = 'light'; continue; }
  if (a.startsWith('--')) continue;
  pos.push(a);
}
const outDir = pos[0] ? path.resolve(pos[0]) : path.resolve(here, '..');
const only = pos[1];
fs.mkdirSync(outDir, { recursive: true });
setTheme(theme);

// ---- WCAG 2.x relative-luminance contrast ratio (used for the contrast check; printed here in both themes) ----
function luminance(hex) {
  const lin = [0, 8, 16].map((sh) => {
    const c = ((parseInt(hex.slice(1), 16) >> sh) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const [b, g, r] = lin; // sh 0,8,16 -> B,G,R
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ---- geometry checks over the box registry ----
const round = (n) => Math.round(n);
const fmt = (b) => `${round(b.x)},${round(b.y)},${round(b.w)},${round(b.h)}`;
function geomProblems(boxes) {
  const P = [];
  const E = 0.6; // rounding tolerance for the containment edges
  const M = 1;   // ignore touches up to 1px for intersection
  const cards = boxes.filter((b) => b.kind === 'card');
  const lanes = boxes.filter((b) => b.kind === 'lane');
  const texts = boxes.filter((b) => b.kind === 'text');
  const marks = boxes.filter((b) => b.kind === 'pill' || b.kind === 'chip');
  const holders = boxes.filter((b) => b.kind === 'card' || b.kind === 'band');
  for (const t of texts) { // 1: every text line inside its card or band (4px margin)
    if (t.parent == null) continue;
    const c = holders.find((k) => k.id === t.parent);
    if (!c) continue;
    if (t.x < c.x + 4 - E || t.x + t.w > c.x + c.w - 4 + E || t.y < c.y + 4 - E || t.y + t.h > c.y + c.h - 4 + E)
      P.push(`text-outside-${c.kind} ${fmt(t)}`);
  }
  for (const c of cards) { // 2: every card inside its lane
    if (c.lane == null) continue;
    const g = lanes.find((l) => l.key === c.lane);
    if (!g) continue;
    if (c.x < g.x - E || c.x + c.w > g.x + g.w + E || c.y < g.y - E || c.y + c.h > g.y + g.h + E)
      P.push(`card-outside-lane:${c.lane} ${fmt(c)}`);
  }
  for (const p of marks) { // 3: no pill/chip box intersecting a text box it does not own
    for (const t of texts) {
      if (t.owner === p.id) continue;
      if (p.x < t.x + t.w - M && p.x + p.w > t.x + M && p.y < t.y + t.h - M && p.y + p.h > t.y + M)
        P.push(`${p.kind}-over-text ${fmt(p)}`);
    }
  }
  for (const b of boxes) if (b.kind !== 'foot' && b.y + b.h > 984 + E) P.push(`below-984:${b.kind} ${fmt(b)}`); // 4: only the footer sits below 984
  for (const t of texts) if (t.size < 12 - 1e-9) P.push(`font-under-12:${t.size} ${fmt(t)}`); // 5
  for (const c of cards) if (c.lines > 5) P.push(`card-over-5-lines:${c.lines} ${fmt(c)}`); // 6: the five-line budget
  for (const t of texts) { // 7: text that must keep to a span (lane label column, its own column, its band block) does
    if (!t.limit) continue;
    if (t.x < t.limit.x0 - E || t.x + t.w > t.limit.x1 + E) P.push(`text-past-limit ${fmt(t)} limit ${round(t.limit.x0)}-${round(t.limit.x1)}`);
  }
  for (const t of texts) { // 8: free text (a note, a label) never lies on a card
    if (t.parent != null || t.owner != null) continue;
    for (const c of cards)
      if (t.x < c.x + c.w - M && t.x + t.w > c.x + M && t.y < c.y + c.h - M && t.y + t.h > c.y + M)
        P.push(`text-over-card ${fmt(t)} card ${fmt(c)}`);
  }
  const foot = boxes.filter((b) => b.kind === 'foot').sort((a, b) => a.x - b.x);
  for (let i = 1; i < foot.length; i++) { // 9: the footer's credit, legend and page count keep 24px apart
    const gap = foot[i].x - (foot[i - 1].x + foot[i - 1].w);
    if (gap < 24 - E) P.push(`footer-crowded gap ${gap.toFixed(1)} ${fmt(foot[i - 1])} | ${fmt(foot[i])}`);
  }
  return P;
}

// ---- arrow checks over the same registry (rules 10-12) ----
// An arrow box carries pts (its polyline), head and tail (the px of shaft each arrowhead covers) and pill (the id of
// its label's pill, if it has one). A card counts as joined to an arrow when an end point lies within JOIN px of it.
const JOIN = 6;
const inset = (b, d) => ({ x0: b.x + d, y0: b.y + d, x1: b.x + b.w - d, y1: b.y + b.h - d });
const nearRect = (p, b) => // distance from point p to box b (0 inside it)
  Math.hypot(Math.max(b.x - p[0], 0, p[0] - (b.x + b.w)), Math.max(b.y - p[1], 0, p[1] - (b.y + b.h)));
// Liang-Barsky clipping: does the segment (x0,y0)-(x1,y1) meet the rectangle r {x0,y0,x1,y1}?
function segHitsRect(x0, y0, x1, y1, r) {
  const dx = x1 - x0, dy = y1 - y0;
  const p = [-dx, dx, -dy, dy], q = [x0 - r.x0, r.x1 - x0, y0 - r.y0, r.y1 - y0];
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}
const pathHits = (pts, r) => pts.slice(1).some((p, i) => segHitsRect(pts[i][0], pts[i][1], p[0], p[1], r));
const polyLength = (pts) => pts.slice(1).reduce((L, p, i) => L + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
function pointAtLen(pts, d) { // the point d px along the polyline
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const seg = Math.hypot(bx - ax, by - ay);
    if (d <= seg || i === pts.length - 1) {
      const t = seg ? Math.min(1, Math.max(0, d / seg)) : 0;
      return [ax + (bx - ax) * t, ay + (by - ay) * t];
    }
    d -= seg;
  }
  return pts[0];
}
const inBox = (p, b) => p[0] >= b.x && p[0] <= b.x + b.w && p[1] >= b.y && p[1] <= b.y + b.h;
const fmtPts = (a) => a.pts.map((p) => `${round(p[0])},${round(p[1])}`).join('>');
function arrowProblems(boxes) {
  const P = [];
  const E = 0.6, M = 1;
  const cards = boxes.filter((b) => b.kind === 'card');
  const arrows = boxes.filter((b) => b.kind === 'arrow');
  const pills = boxes.filter((b) => b.kind === 'pill');
  const freeText = boxes.filter((b) => b.kind === 'text' && b.parent == null && b.owner == null);
  for (const p of pills) for (const c of cards) // 10: a label pill never lies on a card
    if (p.x < c.x + c.w - M && p.x + p.w > c.x + M && p.y < c.y + c.h - M && p.y + p.h > c.y + M)
      P.push(`pill-over-card ${fmt(p)} card ${fmt(c)}`);
  for (const a of arrows) {
    const ends = [a.pts[0], a.pts[a.pts.length - 1]];
    for (const c of cards) { // 11: an arrow never runs through a card it joins, nor under (or within 3 px of) one it passes
      const joined = ends.some((e) => nearRect(e, c) <= JOIN);
      if (joined ? pathHits(a.pts, inset(c, M)) : pathHits(a.pts, inset(c, -3)))
        P.push(`${joined ? 'arrow-through-card' : 'arrow-under-card'} ${fmtPts(a)} card ${fmt(c)}`);
    }
    for (const t of freeText) // 11b: nor over a free label (a lane or column label, a note, the time label)
      if (pathHits(a.pts, inset(t, -2))) P.push(`arrow-over-text ${fmtPts(a)} text ${fmt(t)}`);
    for (const p of pills) // 11c: nor under any pill but its own label
      if (p.id !== a.pill && pathHits(a.pts, inset(p, -2))) P.push(`arrow-under-pill ${fmtPts(a)} pill ${fmt(p)}`);
    const L = polyLength(a.pts); // 12a: long enough to show shaft beside its heads
    if (L < Math.max(24, a.head + a.tail + 10) - E) P.push(`arrow-too-short ${round(L)}px ${fmtPts(a)}`);
    const own = pills.find((p) => p.id === a.pill); // 12b: a label on the shaft leaves shaft showing at both ends
    if (own) {
      let first = null, last = null;
      for (let d = 0; d <= L; d += 0.5) if (inBox(pointAtLen(a.pts, d), own)) { if (first == null) first = d; last = d; }
      if (first != null) { // a label moved beside the shaft has no sample inside it
        if (L - last < a.head + 4 - E) P.push(`arrow-head-crowded ${round(L - last)}px ${fmtPts(a)}`);
        if (first < a.tail + 6 - E) P.push(`arrow-tail-crowded ${round(first)}px ${fmtPts(a)}`);
      }
    }
  }
  return P;
}

// ---- family consistency across 02/03/04 ----
function roleTexts(svg, role) {
  const re = new RegExp(`<text[^>]*data-role="${role}"[^>]*>(.*?)</text>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(svg)) !== null) out.push(m[1].replace(/<[^>]+>/g, '').trim());
  return out;
}
// Lane labels, band titles and legend entries must match in count AND order, word for word, once each tool's own
// name is replaced by TOOL. The legend's last entry says where the dashed return arrows land ("back to ..."), which is
// per tool by design. Column titles follow each tool's own hooks (Grok's menu arrives at the first tool result), so
// for them only the count must match.
const TOOL_NAMES = {
  '02-claude-code': ['Claude Code', 'Claude', 'claude'],
  '03-codex-cli': ['Codex CLI', 'Codex', 'codex'],
  '04-grok-build': ['Grok Build', 'Grok', 'grok'],
};
const neutral = (base, s) => TOOL_NAMES[base].reduce((t, n) => t.split(n).join('TOOL'), s);
function p7(svgs) {
  const P = [];
  const trio = Object.keys(TOOL_NAMES).filter((n) => svgs[n]);
  if (trio.length < 2) return P; // skipped when a prefix limits the build to one file
  const [base, ...rest] = trio;
  for (const role of ['lane-label', 'col-title', 'band-title', 'legend']) {
    const b = roleTexts(svgs[base], role).map((s) => neutral(base, s));
    for (const f of rest) {
      const o = roleTexts(svgs[f], role).map((s) => neutral(f, s));
      if (o.length !== b.length) { P.push(`${role} count ${base}=${b.length} ${f}=${o.length}`); continue; }
      if (role === 'col-title') continue;
      o.forEach((t, i) => {
        const backTo = role === 'legend' && t.startsWith('back to ') && b[i].startsWith('back to ');
        if (t !== b[i] && !backTo) P.push(`${role}[${i}] ${base}="${b[i]}" ${f}="${t}"`);
      });
    }
  }
  return P;
}

// ---- legend: no two entries may look alike ----
// Each swatch is read back from the emitted SVG (data-role="legend-swatch"): a dot by its fill, a line by its stroke.
// Two entries of one colour must differ in shape (a dot and a dashed line). Any two colours must be at least DE_MIN
// apart in CIEDE2000; 2.3 is the just-noticeable step, 20 is a difference most readers see at a glance.
const DE_MIN = 20;
function legendProblems(svg) {
  const P = [];
  const sw = [...svg.matchAll(/<(circle|line) ([^>]*)data-role="legend-swatch"/g)].map((m) => {
    const k = m[1] === 'circle' ? ' fill="' : ' stroke="';
    const i = m[2].indexOf(k);
    return { shape: m[1], color: i < 0 ? '' : m[2].slice(i + k.length, m[2].indexOf('"', i + k.length)).toLowerCase() };
  });
  const labels = roleTexts(svg, 'legend');
  if (labels.length !== sw.length) P.push(`legend-count swatches ${sw.length} labels ${labels.length}`);
  for (let i = 0; i < sw.length; i++) {
    for (let j = i + 1; j < sw.length; j++) {
      const name = `"${labels[i]}" / "${labels[j]}"`;
      if (sw[i].color === sw[j].color) { if (sw[i].shape === sw[j].shape) P.push(`legend-same-swatch ${name}`); continue; }
      const d = deltaE00(sw[i].color, sw[j].color);
      if (d < DE_MIN) P.push(`legend-too-close ${name} dE00 ${d.toFixed(1)}`);
    }
  }
  return P;
}

// ---- mark-or-same: in 03 and 04 every lane card says whether it differs from Claude Code ----
// A card carries the "differs" chip or is declared the same as 02 (card option same: true). An undeclared card fails,
// so a new card cannot slip in without someone deciding which it is; a card cannot be both.
const MARKED = new Set(['03-codex-cli', '04-grok-build']);
function markProblems(base, boxes) {
  if (!MARKED.has(base)) return [];
  const P = [];
  for (const c of boxes) {
    if (c.kind !== 'card' || c.lane == null) continue;
    if (c.mark === 'differs' && c.same) P.push(`card-differs-and-same:${c.lane} ${fmt(c)}`);
    else if (c.mark !== 'differs' && !c.same) P.push(`card-unmarked:${c.lane} ${fmt(c)}`);
  }
  return P;
}

// ---- same-check, strict: a card declared the same as Claude Code must match a 02 card in its lane ----
// A same: true card in 03 or 04 needs a card in the same lane of 02 whose title and body text are equal once each
// tool's own name is replaced by TOOL; a "differs" card that has such a twin is mislabelled. The match is by lane, not
// column, because the tools fire their hooks in different orders. Skipped when a prefix leaves 02 out of the build.
function sameProblems(boxesByBase) {
  const P = [];
  const ref = boxesByBase['02-claude-code'];
  if (!ref) return P;
  const key = (base, c) => JSON.stringify([c.lane, neutral(base, c.title), neutral(base, c.text)]);
  const twins = new Set(ref.filter((c) => c.kind === 'card' && c.lane != null).map((c) => key('02-claude-code', c)));
  for (const base of MARKED) {
    for (const c of boxesByBase[base] ?? []) {
      if (c.kind !== 'card' || c.lane == null) continue;
      const has = twins.has(key(base, c));
      if (c.same && !has) P.push(`card-same-but-differs:${base}:${c.lane}:col${c.col + 1} "${c.title}"`);
      if (c.mark === 'differs' && has) P.push(`card-marked-but-same:${base}:${c.lane}:col${c.col + 1} "${c.title}"`);
    }
  }
  return P;
}

// ---- alt text: the kit README shows each diagram with its aria-label as the alt text, word for word ----
// The README is the kit's own, three folders up from this file. A build run from a copy of this folder that has no
// README there says so and skips the check; in the kit it always runs.
const readme = path.resolve(here, '../../../README.md');
function altProblems(svgs) {
  if (!fs.existsSync(readme)) { console.log(`README alt check skipped: no ${readme}`); return []; }
  const md = fs.readFileSync(readme, 'utf8');
  const P = [];
  for (const [base, svg] of Object.entries(svgs)) {
    const at = svg.indexOf('aria-label="') + 'aria-label="'.length;
    const label = svg.slice(at, svg.indexOf('"', at));
    const imgs = md.split(`<img src="assets/diagrams/${base}.svg" alt="`).slice(1);
    if (!imgs.length) P.push(`readme-no-img ${base}`);
    for (const m of imgs) {
      const alt = m.slice(0, m.indexOf('"'));
      if (alt !== label) P.push(`readme-alt ${base}: alt "${alt}" is not its aria-label "${label}"`);
    }
  }
  return P;
}

// ---- contrast report for the active theme ----
console.log(`theme=${theme}`);
for (const k of ['you', 'claude', 'codex', 'grok', 'script', 'disk', 'git', 'block']) {
  console.log(`contrast ${k}: on panel ${contrast(C[k], C.panel).toFixed(2)} · on bg ${contrast(C[k], C.bg).toFixed(2)}`);
}
console.log(`contrast body-on-panel ${contrast(C.body, C.panel).toFixed(2)} · muted-on-panel ${contrast(C.muted, C.panel).toFixed(2)} · ink-on-bg ${contrast(C.ink, C.bg).toFixed(2)}`);

// ---- build ----
const files = fs.readdirSync(here).filter((f) => /^\d\d-.*\.mjs$/.test(f) && (!only || f.startsWith(only))).sort();
let bad = 0;
const svgs = {};
const boxesByBase = {};
for (const f of files) {
  const mod = await import(pathToFileURL(path.join(here, f)).href + '?t=' + Date.now());
  const svg = mod.render();
  const boxes = takeBoxes();
  const problems = [];
  for (const tag of ['text', 'g', 'svg', 'tspan', 'defs', 'marker', 'filter']) {
    const open = (svg.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length;
    const close = (svg.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (open !== close) problems.push(`tag-balance ${tag} ${open}/${close}`);
  }
  if (/__[A-Z_]+__/.test(svg)) problems.push('placeholder');
  if (/<script|<style|<foreignObject/.test(svg)) problems.push('forbidden-element');
  const base = f.replace(/\.mjs$/, '');
  problems.push(...geomProblems(boxes));
  problems.push(...arrowProblems(boxes)); // rules 10-12: labels, crossings and arrow length
  problems.push(...checkSvg(svg)); // contrast and font size read back from the emitted SVG, independent of the registry
  problems.push(...legendProblems(svg));
  problems.push(...markProblems(base, boxes));
  svgs[base] = svg;
  boxesByBase[base] = boxes;
  const out = path.join(outDir, base + (theme === 'dark' ? '.dark.svg' : '.svg'));
  fs.writeFileSync(out, svg);
  for (const p of problems) console.log(`PROBLEM ${path.basename(out)}: ${p}`);
  console.log(`${problems.length ? 'PROBLEM' : 'OK'} ${path.basename(out)} ${Buffer.byteLength(svg)} bytes`);
  if (problems.length) bad++;
}
for (const p of p7(svgs)) { console.log(`PROBLEM consistency: ${p}`); bad++; }
for (const p of sameProblems(boxesByBase)) { console.log(`PROBLEM consistency: ${p}`); bad++; }
for (const p of altProblems(svgs)) { console.log(`PROBLEM readme: ${p}`); bad++; }
process.exit(bad ? 1 : 0);
