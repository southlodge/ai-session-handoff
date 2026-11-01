// sequence.mjs — the shared swim-lane skeleton used by the three per-tool diagrams (02 Claude Code, 03 Codex CLI, 04 Grok Build).
// Lanes run top to bottom (You · the tool · the script · notes on disk · git); columns run left to right in time.
import { C, text, rect, badge, card, arrow, chip } from './svg-kit.mjs';

export function sequence(spec) {
  const { lanes, columns, top = 186, left = 262, right = 1864, labelX = 56, colGap = 22 } = spec;
  const colW = (right - left) / columns.length;
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
    s += text(labelX + 16, g.cy - (l.sub ? 4 : -6), l.label, { size: 16, weight: 700, fill: l.color });
    if (l.sub) s += text(labelX + 16, g.cy + 16, l.sub, { size: 12.5, fill: C.muted, family: l.subMono ? 'mono' : 'sans' });
  });
  s += `<line x1="${labelX}" y1="${top}" x2="${right}" y2="${top}" stroke="${C.panelLine}"/>`;
  // column headers + separators
  columns.forEach((c, i) => {
    const x = left + i * colW;
    if (i) s += `<line x1="${x}" y1="${top - 44}" x2="${x}" y2="${bottom}" stroke="${C.rule}" stroke-dasharray="3 7"/>`;
    s += badge(x + 16, top - 30, i + 1, c.color ?? C.ink, 14);
    s += text(x + 38, top - 25, c.title, { size: 16, weight: 700, fill: C.ink });
    if (c.sub) s += text(x + 38, top - 7, c.sub, { size: 12.5, fill: C.muted, family: c.subMono ? 'mono' : 'sans' });
  });
  s += `<line x1="${labelX}" y1="${top - 50}" x2="${right}" y2="${top - 50}" stroke="${C.panelLine}"/>`;
  // time arrow under the headers (left → right)
  s += arrow([[labelX, top - 50], [right, top - 50]], { color: C.rule, sw: 1.5, head: true });

  const colX = (i) => ({ x: left + i * colW + colGap / 2, w: colW - colGap, cx: left + i * colW + colW / 2 });
  const api = {
    svg: () => s, colW, colX, laneY, top, bottom, left, right,
    // a card centred in a column cell; align 'middle' (default) | 'top' | 'bottom'; offset shifts it vertically
    cell(col, lane, o = {}) {
      const cx = colX(col); const g = laneY[lane];
      const ch = o.channel ? 30 : 0; // leave a 30px channel at the left of the column for a return arrow
      const w = o.w ?? cx.w - (o.inset ?? 0) * 2 - ch;
      const x = o.x ?? cx.x + (o.inset ?? 0) + ch;
      const probe = card({ ...o, x, y: 0, w });
      let yy;
      if (o.align === 'top') yy = g.y + (o.offset ?? 10);
      else if (o.align === 'bottom') yy = g.bottom - probe.h - (o.offset ?? 10);
      else yy = Math.round(g.cy - probe.h / 2 + (o.offset ?? 0));
      const k = card({ ...o, x, y: yy, w });
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
    // muted note inside an empty cell
    note(col, lane, str, o = {}) {
      const cx = colX(col); const g = laneY[lane];
      s += text(cx.cx, g.cy + 5, str, { size: 13, fill: C.faint, italic: true, anchor: 'middle', ...o }); return api;
    },
  };
  return api;
}
