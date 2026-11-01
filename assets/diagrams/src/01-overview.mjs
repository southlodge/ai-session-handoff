// 01: Overview: one script, three tools. Hub and spoke, no swim lanes.
// Left: the three tools and the hook events each fires. Centre: the handoff-guard.mjs hub,
// its modes and commands. Right: the notes on disk and the one question it asks git.
import { C, doc, header, footer, arrow, band, card, chip, panel, badge, text, rect, tint, tw, wrap } from './svg-kit.mjs';

// A row of chips that wraps inside maxW; returns { svg, bottom }.
function chipRow(x, y, labels, o = {}) {
  const { color = C.muted, size = 12, maxW = 400, gapX = 7, gapY = 8 } = o;
  const h = size + 12;
  let cx = x, cy = y, svg = '';
  for (const lab of labels) {
    const w = Math.ceil(tw(lab, size, 'sans') + 22);
    if (cx > x && cx + w > x + maxW) { cx = x; cy += h + gapY; }
    svg += chip(cx, cy, lab, { color, size }).svg;
    cx += w + gapX;
  }
  return { svg, bottom: cy + h };
}

// A tool card: coloured title, one-line description, its hook events as chips, a host line.
function toolCard(x, y, w, o) {
  const { accent, title, desc, host, events } = o;
  const pad = 12, barW = 5, indent = barW + 8;
  const innerX = x + pad + indent;
  const innerW = w - pad * 2 - indent;
  const bodySize = 13.5, lh = 19;
  const descLines = wrap(desc, Math.floor(innerW / (bodySize * 0.48)));
  const chipsH = chipRow(0, 0, events, { size: 12, maxW: innerW }).bottom;
  const h = pad + 24 + descLines.length * lh + 18 + chipsH + 8 + 20 + pad;

  let s = rect(x, y, w, h, { fill: C.bg, stroke: C.cardLine, shadow: true });
  s += `<rect x="${x + pad - 3}" y="${y + pad - 1}" width="${barW}" height="${h - pad * 2 + 2}" rx="2.5" fill="${accent}"/>`;
  let top = y + pad;
  s += text(innerX, top + 15, title, { size: 16, weight: 700, fill: accent, code: accent });
  top += 24;
  descLines.forEach((l, i) => { s += text(innerX, top + 14 + i * lh, l, { size: bodySize, fill: C.body }); });
  top += descLines.length * lh + 6;
  s += text(innerX, top + 11, 'HOOK EVENTS', { size: 10.5, weight: 700, fill: C.faint, ls: 1 });
  top += 16;
  s += chipRow(innerX, top, events, { color: accent, size: 12, maxW: innerW }).svg;
  top += chipsH + 8;
  s += text(innerX, top + 13, host, { size: 13, fill: C.body });
  return { svg: s, bottom: y + h, h };
}

export function render() {
  let s = header('One script, three tools',
    'The same Node file runs at each tool’s hook moments, saving every chat’s recap for the next chat to pick up');

  // ---- numbered section headers (reading order, left to right then down) ----
  const hdr = (bx, n, label, color) => badge(bx + 11, 180, n, color, 13) + text(bx + 32, 185, label, { size: 16, weight: 700, fill: C.ink });
  s += hdr(56, 1, 'Three tools', C.ink);
  s += hdr(730, 2, 'One script', C.script);
  s += hdr(1404, 3, 'Notes on disk', C.disk);

  // ---- 1. the three tools (left column) ----
  const LX = 56, LW = 470;
  const c1 = toolCard(LX, 200, LW, {
    accent: C.claude, title: 'Claude Code', desc: 'The default host. It fires six hook events.',
    host: 'No flag needed: this is the default host.',
    events: ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'Stop', 'PostCompact', 'statusLine'],
  });
  s += c1.svg;
  const c2 = toolCard(LX, c1.bottom + 19, LW, {
    accent: C.codex, title: 'OpenAI Codex CLI', desc: 'Same script, notes under `~/.codex`. No status line.',
    host: '`--host codex`',
    events: ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'Stop'],
  });
  s += c2.svg;
  const c3 = toolCard(LX, c2.bottom + 19, LW, {
    accent: C.grok, title: 'xAI Grok Build', desc: 'Same script, notes under `~/.grok`. Delivers owed notes after a tool call.',
    host: '`--host grok`',
    events: ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PostCompact', 'Stop', 'status line'],
  });
  s += c3.svg;

  // ---- 2. the hub (centre column) ----
  const HX = 730, HW = 470, HY = 200;
  const ix = HX + 24, iw = HW - 48;
  // a content-sized tinted note box; returns { svg, bottom }
  const noteBox = (x, y, w, lines, accent, label) => {
    const wrapped = wrap(lines, Math.floor((w - 24) / (13 * 0.48)));
    const h = 14 + (label ? 20 : 0) + wrapped.length * 18 + 10;
    let b = rect(x, y, w, h, { fill: tint(accent, 0.92), stroke: tint(accent, 0.6), r: 10, shadow: false });
    let yy = y + 22;
    if (label) { b += text(x + 12, yy, label, { size: 10.5, weight: 700, fill: accent, ls: 1 }); yy += 20; }
    wrapped.forEach((l, i) => { b += text(x + 12, yy + i * 18, l, { size: 13, fill: C.body }); });
    return { svg: b, bottom: y + h };
  };
  let hub = '';
  hub += text(ix, HY + 62, 'handoff-guard.mjs', { size: 22, weight: 700, fill: C.script, family: 'mono' });
  hub += text(ix, HY + 86, 'One Node file. Node built-ins only.', { size: 13.5, fill: C.muted });
  let hy = HY + 108;
  wrap('One mode per hook event. Every mode exits 0 and never throws, so a broken hook cannot block the tool.', Math.floor(iw / (13.5 * 0.48)))
    .forEach((l, i) => { hub += text(ix, hy + 15 + i * 19, l, { size: 13.5, fill: C.body }); });
  hy += 3 * 19 + 20;
  hub += text(ix, hy, 'HOOK MODES', { size: 11, weight: 700, fill: C.faint, ls: 1.2 });
  hy += 14;
  const modeChips = chipRow(ix, hy, ['session-start', 'prompt', 'pretool', 'posttool', 'stop', 'complete-check', 'compacted', 'statusline'],
    { color: C.script, size: 12, maxW: iw });
  hub += modeChips.svg;
  hy = modeChips.bottom + 16;
  hub += text(ix, hy, 'posttool runs on Grok only.', { size: 12, fill: C.muted, italic: true });
  hy += 26;
  hub += text(ix, hy, 'COMMANDS YOU TYPE', { size: 11, weight: 700, fill: C.faint, ls: 1.2 });
  hy += 14;
  const cmdChips = chipRow(ix, hy, ['takeover', 'resume-here', 'list', 'notes'], { color: C.disk, size: 12, maxW: iw });
  hub += cmdChips.svg;
  hy = cmdChips.bottom + 18;
  const boxA = noteBox(ix - 6, hy, iw + 12,
    '`--host codex` or `--host grok` keeps the notes under that tool’s home folder; the default is Claude. `$CODEX_HOME` and `$GROK_HOME` are honoured.', C.script);
  hub += boxA.svg;
  const boxB = noteBox(ix - 6, boxA.bottom + 12, iw + 12,
    'Credential shapes are redacted before a note is written. Other chats’ notes are shown to the model as data, not instructions.', C.ok, 'SAFE BY DESIGN');
  hub += boxB.svg;
  const hubEnd = boxB.bottom;
  s += panel(HX, HY, HW, hubEnd + 16 - HY, { label: 'THE HUB', fill: C.panel });
  s += hub;

  // ---- 3. notes on disk (right column, top) ----
  const RX = 1404, RW = 460;
  const notes = card({
    x: RX, y: 200, w: RW, accent: C.disk, title: 'Notes on disk', size: 13.5,
    body: [
      'Each chat’s recap is saved as one JSON note, in the tool’s own home folder.',
      { t: '~/.claude/handoff/', family: 'mono', size: 12.5, fill: C.muted },
      { t: '~/.codex/handoff/', family: 'mono', size: 12.5, fill: C.muted },
      { t: '~/.grok/handoff/', family: 'mono', size: 12.5, fill: C.muted },
      'One note per chat. Kept 72 h. This machine only. Plain text you can read, copy or delete.',
    ],
  });
  s += notes.svg;

  // ---- 4. git (right column, bottom) ----
  s += badge(RX + 11, notes.bottom + 36, 4, C.git, 13) + text(RX + 32, notes.bottom + 41, 'The check', { size: 16, weight: 700, fill: C.git });
  const git = card({
    x: RX, y: notes.bottom + 60, w: RW, accent: C.git, title: 'git', size: 13.5,
    body: [
      'The one question it asks.',
      'When a recap claims 100%, git must show the `.md` or `.txt` docs the recap names really changed.',
      'If not, the Stop reply is blocked, once, with the reason.',
      'On Codex, it is asked only when git already shows files changed since the chat began.',
      'Not a git repository? Then there is nothing to check.',
    ],
  });
  s += git.svg;

  // ---- arrows between the columns ----
  // tools -> hub, and hub -> tools
  const midY = Math.round((200 + c3.bottom) / 2);
  s += arrow([[LX + LW + 2, midY - 22], [HX - 2, midY - 22]], { color: C.script, label: 'hook JSON on stdin' });
  s += arrow([[HX - 2, midY + 24], [LX + LW + 2, midY + 24]], { color: C.ok, dashed: true, label: 'JSON on stdout, exit 0' });
  // hub -> notes (read, write) and hub -> git (git status)
  s += arrow([[HX + HW + 2, notes.cy], [RX - 2, notes.cy]], { color: C.disk, both: true, label: 'read, write' });
  s += arrow([[HX + HW + 2, git.cy], [RX - 2, git.cy]], { color: C.git, label: 'git status' });

  // ---- bottom band ----
  const contentBottom = Math.max(c3.bottom, hubEnd + 16, git.bottom);
  s += band(contentBottom + 26, 'INSTALL, PROOF AND WHAT IT NEVER DOES', [
    {
      color: C.script, titleMono: true, title: 'install-claude.mjs · install-codex.mjs · install-grok.mjs',
      body: 'One installer per tool. Each is a dry run first: it says what it would change and writes nothing until you add --write, backs up every file it touches, and is safe to run again. Node 20 or later.',
    },
    {
      color: C.ok, title: 'Proof',
      body: '71 tests and 96 mutations, all killed. Run them before you install: a passing suite means the tests are real. CI on Ubuntu and Windows, Node 20, 22 and 24.',
    },
    {
      color: C.git, title: 'What it never does',
      body: 'No network, no telemetry, no dependencies. It never edits your code and reads only this folder’s notes. Every mode exits 0, so a broken hook can never block the tool.',
    },
  ]).svg;

  s += footer(1, [
    { color: C.claude, label: 'Claude Code' }, { color: C.codex, label: 'Codex CLI' }, { color: C.grok, label: 'Grok Build' },
    { color: C.script, label: 'handoff-guard.mjs' }, { color: C.disk, label: 'Notes on disk' }, { color: C.git, label: 'git' },
  ]);
  return doc(s, { label: 'One script, three tools: Claude Code, OpenAI Codex CLI and xAI Grok Build each run handoff-guard.mjs at their hook moments; it reads and writes notes under the tool’s home folder and asks git about a 100% claim' });
}
