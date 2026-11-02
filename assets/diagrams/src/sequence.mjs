// sequence.mjs - the shared swim-lane skeleton: the three per-tool diagrams (02 Claude Code, 03 Codex CLI, 04 Grok Build)
// and the hand-off (05) draw on it. Lanes run top to bottom (in 02 to 04: You · the tool · the script · notes on disk ·
// git); columns run left to right in time.
import { C, text, rect, badge, card, arrow, chip, registerBox, registerText } from './svg-kit.mjs';

export function sequence(spec) {
  const { lanes, columns, top = 186, left = 262, right = 1864, labelX = 56, colGap = 22 } = spec;
  const colW = (right - left) / columns.length;
  const colX = (i) => ({ x: left + i * colW + colGap / 2, w: colW - colGap, cx: left + i * colW + colW / 2 });
  const laneY = {};
  let y = top;
  for (const l of lanes) { laneY[l.key] = { y, h: l.h, cy: y + l.h / 2, bottom: y + l.h }; y += l.h; }
  const bottom = y;
  let s = '';
  // lane bands
  lanes.forEach((l, i) => {
    const g = laneY[l.key];
    s += rect(labelX, g.y, right - labelX, g.h, { fill: i % 2 ? C.bg : C.panel, r: 0 });
    s += `<line x1="${labelX}" y1="${g.bottom}" x2="${right}" y2="${g.bottom}" stroke="${C.panelLine}"/>`;
    s += `<rect x="${labelX}" y="${g.y + 10}" width="4" height="${g.h - 20}" rx="2" fill="${l.color}"/>`;
    const laneLimit = { x0: labelX, x1: left - 4 }; // a lane label keeps to the label column
    s += text(labelX + 16, g.cy - (l.sub ? 4 : -6), l.label, { size: 17, weight: 700, fill: l.color, role: 'lane-label' });
    registerText(labelX + 16, g.cy - (l.sub ? 4 : -6), l.label, 17, 'sans', 'start', { weight: 700, limit: laneLimit });
    if (l.sub) {
      const fam = l.subMono ? 'mono' : 'sans';
      s += text(labelX + 16, g.cy + 16, l.sub, { size: 12.5, fill: C.muted, family: fam });
      registerText(labelX + 16, g.cy + 16, l.sub, 12.5, fam, 'start', { limit: laneLimit });
    }
    registerBox({ kind: 'lane', key: l.key, x: labelX, y: g.y, w: right - labelX, h: g.h }); // cards must stay inside their lane
  });
  s += `<line x1="${labelX}" y1="${top}" x2="${right}" y2="${top}" stroke="${C.panelLine}"/>`;
  // column headers + separators
  columns.forEach((c, i) => {
    const x = left + i * colW;
    const cb = colX(i);
    if (i) s += `<line x1="${x}" y1="${top - 44}" x2="${x}" y2="${bottom}" stroke="${C.rule}" stroke-dasharray="3 7"/>`;
    s += badge(x + 16, top - 30, i + 1, c.color ?? C.ink, 14);
    const colLimit = { x0: x, x1: x + colW - 6 }; // a column header keeps to its own column
    s += text(x + 38, top - 25, c.title, { size: 17, weight: 700, fill: C.ink, role: 'col-title' });
    registerText(x + 38, top - 25, c.title, 17, 'sans', 'start', { weight: 700, limit: colLimit });
    if (c.sub) {
      const fam = c.subMono ? 'mono' : 'sans';
      s += text(x + 38, top - 7, c.sub, { size: 12.5, fill: C.muted, family: fam, code: C.muted });
      registerText(x + 38, top - 7, c.sub, 12.5, fam, 'start', { limit: colLimit });
    }
    // a 4px tint bar in the ink colour under each numbered header, spanning the column content width
    s += rect(cb.x, top - 5, cb.w, 4, { fill: C.ink, r: 2, opacity: 0.18 });
  });
  s += `<line x1="${labelX}" y1="${top - 50}" x2="${right}" y2="${top - 50}" stroke="${C.panelLine}"/>`;
  // time arrow under the headers (left → right), with a right-aligned "time" label
  s += arrow([[labelX, top - 50], [right, top - 50]], { color: C.rule, sw: 1.5, head: true });
  // the label ends 14 px short of the arrow tip and sits 7 px above the shaft, clear of the arrowhead
  s += text(right - 14, top - 57, 'time', { size: 12.5, fill: C.muted, anchor: 'end' });
  registerText(right - 14, top - 57, 'time', 12.5, 'sans', 'end');

  const api = {
    svg: () => s, colW, colX, laneY, top, bottom, left, right,
    // a card centred in a column cell; align 'middle' (default) | 'top' | 'bottom'; offset shifts it vertically
    cell(col, lane, o = {}) {
      const cx = colX(col); const g = laneY[lane];
      const ch = o.channel ? 30 : 0; // leave a 30px channel at the left of the column for a return arrow
      const rl = o.rail ? 30 : 0;    // leave a 30px rail at the right of the column for an arrow that passes this card
      const w = o.w ?? cx.w - (o.inset ?? 0) * 2 - ch - rl;
      const x = o.x ?? cx.x + (o.inset ?? 0) + ch;
      const probe = card({ ...o, x, y: 0, w, probe: true }); // measure height only, register nothing
      let yy;
      if (o.align === 'top') yy = g.y + (o.offset ?? 10);
      else if (o.align === 'bottom') yy = g.bottom - probe.h - (o.offset ?? 10);
      else yy = Math.round(g.cy - probe.h / 2 + (o.offset ?? 0));
      const k = card({ ...o, x, y: yy, w });
      if (k.box) { k.box.lane = lane; k.box.col = col; } // lane for containment; lane and column for the mark-or-same checks
      s += k.svg; return k;
    },
    // a small chip inside a cell (top-left by default)
    chipIn(col, lane, label, o = {}) {
      const cx = colX(col); const g = laneY[lane];
      const k = chip(cx.x + (o.dx ?? 0), g.y + (o.dy ?? 12), label, o);
      s += k.svg; return k;
    },
    // vertical arrow from card a down to card b, at a's centre unless x is given
    down(a, b, o = {}) {
      const x = o.x ?? a.cx;
      s += arrow([[x, a.bottom + 2], [x, b.y - 2]], { color: C.arrow, ...o }); return api;
    },
    up(a, b, o = {}) {
      const x = o.x ?? a.cx;
      s += arrow([[x, a.y - 2], [x, b.bottom + 2]], { color: C.arrow, ...o }); return api;
    },
    across(a, b, o = {}) {
      const yy = o.y ?? a.cy;
      s += arrow([[a.right + 2, yy], [b.x - 2, yy]], { color: C.arrow, ...o }); return api;
    },
    raw(str) { s += str; return api; },
    channelX(col) { return colX(col).x + 12; },
    railX(col) { const c = colX(col); return c.x + c.w - 15; }, // the rail beside a card built with rail: true
    // muted note inside an empty cell
    note(col, lane, str, o = {}) {
      const cx = colX(col); const g = laneY[lane];
      s += text(cx.cx, g.cy + 5, str, { size: 13, fill: C.faint, italic: true, anchor: 'middle', ...o });
      registerText(cx.cx, g.cy + 5, str, o.size ?? 13, o.family ?? 'sans', o.anchor ?? 'middle', { limit: { x0: cx.x, x1: cx.x + cx.w } });
      return api;
    },
    // ONE muted italic note at the right edge of a lane, inside the last column (replaces repeated per-cell notes)
    laneNote(lane, str, o = {}) {
      const g = laneY[lane]; const last = colX(columns.length - 1);
      s += text(last.x + last.w - 6, g.cy + 5, str, { size: o.size ?? 13, fill: C.faint, italic: true, anchor: 'end', ...o });
      registerText(last.x + last.w - 6, g.cy + 5, str, o.size ?? 13, 'sans', 'end', { limit: { x0: left, x1: last.x + last.w } });
      return api;
    },
  };
  return api;
}
