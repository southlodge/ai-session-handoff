// 01: Overview: one script, three tools. Hub and spoke, no swim lanes.
// Reading order, numbered: 1 the three tools (left), 2 the handoff-guard.mjs hub (centre),
// 3 the notes on disk (right, top), 4 the one git check (right, bottom).
//
// Every behavioural sentence below is checkable in this kit (checked 2026-11-02; check-cites.mjs prints each cited
// line beside its claim). A bare :N is always a line of handoff-guard.mjs; any other file is named. claim → source:
//   hook modes session-start, prompt, pretool, posttool, stop, complete-check, compacted, statusline   :675, :5-12
//   commands takeover, resume-here, notes (run by the model) and list (run by you)          :676, :13-16
//   say "carry on" and the model runs takeover for you                                      :463
//   each hook event runs one mode; Stop runs two      settings.fragment.json:43, settings.fragment.json:53
//   posttool runs on Grok only                                                              :10, :505
//   default host ~/.claude, no flag; --host codex -> ~/.codex, --host grok -> ~/.grok        :18-20, :43-44
//   Claude Code fires five hook events, plus a status line
//       settings.fragment.json:2-5 (statusLine), settings.fragment.json:7-69 (five event keys)
//   Codex fires four (SessionStart, UserPromptSubmit, PreToolUse, Stop), no status line   codex-hooks.json:4-52, :660
//   Grok fires seven, plus a [ui.status_line] you paste in                   grok-hooks.json:3-90, install-grok.mjs:55
//   Codex: the nudge reads token_count events
//       :200, :220, test "the big-chat nudge reads Codex token_count events"
//   with no status line, list shows the bars
//       :660-661, test "list shows each note with its bar, session, age and next step"
//   Grok: the menu is owed, then arrives with the first tool result
//       :501, :515, test "session-start prints nothing; the first tool result carries the menu, once"
//   Grok: the status line caches the chat's size                 :627, test "caches the size for the note"
//   each chat's recap is saved as JSON in its tool's folder; one note per chat; kept 72 h; this machine only
//       :45, :64, :48, :243, :27-30 (node built-ins only)
//   credential shapes are redacted before a note is written
//       :111-124, test "credential shapes are redacted before a note is written"
//   other chats' notes are shown to the model as data, never instructions
//       :433-437, test "inside the data envelope, and a forged marker is removed"
//   at 100%, git must show the docs a recap names really changed; if not, sent back with the reason, on every try
//       :402-414, test "complete-check blocks, on every pass, a docs step that names a file git shows unchanged"
//   no repository: nothing to check                                                         :371, :408
//   every mode exits 0, so a broken hook never blocks the tool
//       :4, :680-681, test "every hook mode exits 0 on empty or malformed input"
//   it writes only to its own handoff folder, and git is only read (status, diff, show)   :45, :63-69, :81-82, :343-345
//   installers: a dry run until --write; each backs up every file it changes; Node 20 or later
//       test "installer: a dry run writes nothing", test "keeps your own entries, backs up, and is idempotent",
//       package.json:28-29
//   71 tests (21 + 20 + 30) and 96 mutations, all killed; CI on Ubuntu and Windows, Node 20, 22 and 24
//       node mutate.mjs --list ("96/96 mutations match"), .github/workflows/test.yml:19-20,
//       .github/workflows/test.yml:27-29 (npm test everywhere, npm run mutate on Ubuntu, Node 22)
import { C, doc, header, footer, arrow, band, card, panel, badge, text, rect, tint, mix, pill, tw, wrap, getTheme, registerBox, registerText } from './svg-kit.mjs';

// A theme-aware chip: pale accent ground, accent hairline, dark high-contrast label (>= 4.5:1 both themes).
function chipBox(x, y, label, accent, size) {
  const padX = 10;
  const w = Math.ceil(tw(label, size, 'sans', 600) + padX * 2);
  const h = Math.round(size + 10);
  const dark = getTheme() === 'dark';
  const ground = dark ? mix(accent, C.bg, 0.82) : tint(accent, 0.9);
  const border = dark ? mix(accent, C.bg, 0.48) : tint(accent, 0.5);
  const by = y + h / 2 + size * 0.34;
  const svg = rect(x, y, w, h, { fill: ground, stroke: border, sw: 1, r: h / 2 }) +
    text(x + w / 2, by, label, { size, weight: 600, fill: C.body, anchor: 'middle', code: C.body });
  return { svg, w, h };
}

// A row of chips that wraps inside maxW. probe: measure height only, register and draw nothing (the origin height pass).
function chipRow(x, y, labels, o = {}) {
  const { accent = C.muted, size = 12.5, maxW = 400, gapX = 7, gapY = 7, probe = false } = o;
  const h = Math.round(size + 10);
  let cx = x, cy = y, svg = '';
  for (const lab of labels) {
    const w = Math.ceil(tw(lab, size, 'sans', 600) + 20);
    if (cx > x && cx + w > x + maxW) { cx = x; cy += h + gapY; }
    if (!probe) {
      svg += chipBox(cx, cy, lab, accent, size).svg;
      registerBox({ kind: 'chip', x: cx, y: cy, w, h });
    }
    cx += w + gapX;
  }
  return { svg, bottom: cy + h };
}

// A tool card (hand-drawn, not kit.card: it carries the HOOK EVENTS chip row and a DIFFERENCE line).
// o: { accent, title, desc, events[], diff }. Returns { svg, bottom, h, x, y, w, cx, cy }.
function toolCard(x, y, w, o) {
  const { accent, title, desc, events, diff } = o;
  const pad = 14, barW = 5, indent = barW + 8;
  const innerX = x + pad + indent;
  const innerW = w - pad * 2 - indent;
  const titleSize = 17, body = 15, lh = 21, eyebrow = 12;
  const descLines = wrap(desc, innerW, { size: body });
  const diffLines = wrap(diff, innerW, { size: body });
  const chipsH = chipRow(0, 0, events, { size: 12.5, maxW: innerW, probe: true }).bottom;
  const h = pad + 24 + descLines.length * lh + 14 + chipsH + 16 + eyebrow + 4 + diffLines.length * lh + pad + 6;

  let s = rect(x, y, w, h, { fill: C.bg, stroke: C.cardLine, shadow: true });
  // the card and every line of its text join the registry, so the five-line budget and containment apply here too
  const id = registerBox({ kind: 'card', x, y, w, h, lines: descLines.length + diffLines.length }).id;
  const put = (tx, ty, str, size, weight = 400) => registerText(tx, ty, str, size, 'sans', 'start', { parent: id, weight });
  s += `<rect x="${x + pad - 3}" y="${y + pad - 1}" width="${barW}" height="${h - pad * 2 + 2}" rx="2.5" fill="${accent}"/>`;
  let top = y + pad;
  s += text(innerX, top + 16, title, { size: titleSize, weight: 700, fill: accent, code: accent });
  put(innerX, top + 16, title, titleSize, 700);
  top += 24;
  descLines.forEach((l, i) => { s += text(innerX, top + 15 + i * lh, l, { size: body, fill: C.body }); put(innerX, top + 15 + i * lh, l, body); });
  top += descLines.length * lh + 10;
  s += text(innerX, top + 11, 'HOOK EVENTS IT FIRES', { size: eyebrow, weight: 700, fill: C.muted, ls: 1 });
  top += 18;
  s += chipRow(innerX, top, events, { accent, size: 12.5, maxW: innerW }).svg;
  top += chipsH + 14;
  s += text(innerX, top + 11, 'WHAT IS DIFFERENT HERE', { size: eyebrow, weight: 700, fill: C.muted, ls: 1 });
  top += 18;
  diffLines.forEach((l, i) => { s += text(innerX, top + 13 + i * lh, l, { size: body, fill: C.body }); put(innerX, top + 13 + i * lh, l, body); });
  return { svg: s, bottom: y + h, h, x, y, w, cx: x + w / 2, cy: y + Math.round(h / 2) };
}

export function render() {
  let s = header('One script, three tools',
    'One Node file runs at each tool’s hook moments and saves every chat’s recap for the next chat to pick up');

  const Y0 = 198;
  const LX = 56, LW = 470;      // 1 the tools
  const HX = 730, HW = 470;     // 2 the hub
  const RX = 1404, RW = 460;    // 3 notes, 4 git

  // ---- numbered section headers ----
  const hdr = (bx, n, label, color) => badge(bx + 11, 176, n, color, 13) + text(bx + 34, 182, label, { size: 17, weight: 700, fill: C.ink });
  s += hdr(LX, 1, 'Three tools', C.ink);
  s += hdr(HX, 2, 'One script', C.script);
  s += hdr(RX, 3, 'Notes on disk', C.disk);

  // ---- 1. the three tools (left) ----
  const c1 = toolCard(LX, Y0, LW, {
    accent: C.claude, title: 'Claude Code', desc: 'Fires five hook events, plus a status line.',
    events: ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'Stop', 'PostCompact'],
    diff: 'The baseline host. No host flag is needed.',
  });
  s += c1.svg;
  const c2 = toolCard(LX, c1.bottom + 16, LW, {
    accent: C.codex, title: 'OpenAI Codex CLI', desc: 'Fires four. No status line.',
    events: ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'Stop'],
    diff: 'Pass `--host codex`. The nudge reads `token_count`, and with no status line, `list` shows the bars.',
  });
  s += c2.svg;
  const c3 = toolCard(LX, c2.bottom + 16, LW, {
    accent: C.grok, title: 'xAI Grok Build', desc: 'Fires seven, plus a status line you paste in.',
    events: ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PostCompact', 'Stop'],
    diff: 'Pass `--host grok`. The menu arrives with the first tool result, and the status line caches the chat’s size.',
  });
  s += c3.svg;

  // ---- 3. notes on disk (right, top) ----
  const notes = card({
    x: RX, y: Y0, w: RW, accent: C.disk, title: 'Notes on disk',
    body: [
      'Each chat’s recap is saved as JSON in its tool’s folder:',
      { t: '~/.claude/handoff/', family: 'mono', size: 13, fill: C.muted },
      { t: '~/.codex/handoff/', family: 'mono', size: 13, fill: C.muted },
      { t: '~/.grok/handoff/', family: 'mono', size: 13, fill: C.muted },
      'One note per chat. Kept 72\u00a0hours. This machine only.',
    ],
  });
  s += notes.svg;

  // ---- 4. git (right, bottom) ----
  s += badge(RX + 11, notes.bottom + 34, 4, C.git, 13) + text(RX + 34, notes.bottom + 40, 'The one check', { size: 17, weight: 700, fill: C.git });
  const git = card({
    x: RX, y: notes.bottom + 58, w: RW, accent: C.git, title: 'git',
    body: [
      'When a recap claims 100%, git must show the docs it names really changed.',
      'If not, the reply is sent back with the reason, on every try.',
      'No repository? Then there is nothing to check.',
    ],
  });
  s += git.svg;

  // ---- 2. the hub (centre) ----
  const ix = HX + 24, iw = HW - 48;
  const noteBox = (x, y, w, textStr, accent, label) => {
    const wrapped = wrap(textStr, w - 28, { size: 14.5 });
    const h = 10 + (label ? 22 : 0) + wrapped.length * 20 + 12; // the same padding above the label and below the last line
    const dark = getTheme() === 'dark';
    const fill = dark ? mix(accent, C.bg, 0.86) : tint(accent, 0.92); // a wash of the accent on either canvas
    let b = rect(x, y, w, h, { fill, stroke: dark ? mix(accent, C.bg, 0.55) : tint(accent, 0.6), r: 10 });
    // the callout and its text join the registry, so the five-line budget and containment apply here too
    const id = registerBox({ kind: 'card', x, y, w, h, lines: wrapped.length }).id;
    let yy = y + 24;
    if (label) {
      b += text(x + 14, yy, label, { size: 12, weight: 700, fill: accent, ls: 1, ground: [fill] });
      registerText(x + 14, yy, label, 12, 'sans', 'start', { parent: id, weight: 700 });
      yy += 22;
    }
    wrapped.forEach((l, i) => {
      b += text(x + 14, yy + i * 20, l, { size: 14.5, fill: C.body, ground: [fill] });
      registerText(x + 14, yy + i * 20, l, 14.5, 'sans', 'start', { parent: id });
    });
    return { svg: b, bottom: y + h };
  };
  let hub = '';
  hub += text(ix, Y0 + 64, 'handoff-guard.mjs', { size: 24, weight: 700, fill: C.script, family: 'mono' });
  hub += text(ix, Y0 + 92, 'One Node file. Node built-ins only.', { size: 15, fill: C.muted });
  let hy = Y0 + 122;
  const why = wrap('Each hook event runs one mode; `Stop` runs two. Every mode exits 0, so a broken hook never blocks the tool.', iw, { size: 15 });
  why.forEach((l, i) => {
    hub += text(ix, hy + 16 + i * 21, l, { size: 15, fill: C.body });
    registerText(ix, hy + 16 + i * 21, l, 15, 'sans', 'start', { limit: { x0: HX, x1: HX + HW } });
  });
  hy += why.length * 21 + 40;
  hub += text(ix, hy, 'HOOK MODES', { size: 12, weight: 700, fill: C.muted, ls: 1.2 });
  hy += 18;
  const modeChips = chipRow(ix, hy, ['session-start', 'prompt', 'pretool', 'posttool', 'stop', 'complete-check', 'compacted', 'statusline'],
    { accent: C.script, size: 12.5, maxW: iw });
  hub += modeChips.svg;
  hy = modeChips.bottom + 12;
  hub += text(ix, hy + 6, '`posttool` runs on Grok only.', { size: 13, fill: C.muted, italic: true });
  hy += 34;
  hub += text(ix, hy, 'COMMANDS', { size: 12, weight: 700, fill: C.muted, ls: 1.2 });
  hy += 18;
  const cmdChips = chipRow(ix, hy, ['takeover', 'resume-here', 'list', 'notes'], { accent: C.disk, size: 12.5, maxW: iw });
  hub += cmdChips.svg;
  hy = cmdChips.bottom + 26;
  const entry = noteBox(ix - 4, hy, iw + 8,
    'A new chat is shown a menu of recent notes. Say “carry on with …” and the model runs `takeover` for you.', C.you, 'AT A NEW CHAT');
  hub += entry.svg;
  hy = entry.bottom + 14;
  const safe = noteBox(ix - 4, hy, iw + 8,
    'Credential shapes are redacted before a note is written. Other chats’ notes are shown to the model as data, never instructions.', C.script, 'SAFE BY DESIGN');
  hub += safe.svg;
  const hubEnd = safe.bottom;
  s += panel(HX, Y0, HW, Math.min(c3.bottom, hubEnd + 16) - Y0, { label: 'THE HUB', fill: C.panel });
  s += hub;

  // ---- arrows: primary spokes in, dashed return out; hub to notes primary, hub to git dashed ----
  // The three spokes land `spread` px apart on the hub's edge with Codex level in the middle, so the stdin label sits
  // above the middle spoke and the dashed return below it, each in clear space (rule 11c: no spoke runs under a label).
  const fanY = c2.cy, spread = 72;
  const gapCx = Math.round((LX + LW + HX) / 2);
  s += arrow([[LX + LW, c1.cy], [HX - 4, fanY - spread]], { color: C.claude, weight: 'primary', head: true });
  s += arrow([[LX + LW, c2.cy], [HX - 4, fanY]], { color: C.codex, weight: 'primary', head: true });
  s += arrow([[LX + LW, c3.cy], [HX - 4, fanY + spread]], { color: C.grok, weight: 'primary', head: true });
  s += pill(gapCx, fanY - spread / 2, 'hook JSON on stdin', { color: C.body });
  s += arrow([[HX - 4, fanY + spread / 2], [LX + LW + 2, fanY + spread / 2]], { weight: 'secondary', color: C.script, label: 'JSON on stdout, exit 0', labelColor: C.body });

  s += arrow([[HX + HW, notes.cy], [RX - 2, notes.cy]], { color: C.disk, weight: 'primary', both: true, label: 'read, write', labelColor: C.body });
  s += arrow([[HX + HW, git.cy], [RX - 2, git.cy]], { color: C.git, weight: 'secondary', label: 'git status', labelColor: C.body });

  // ---- bottom band ----
  const contentBottom = Math.max(c3.bottom, Math.max(hubEnd, git.bottom) + 14, git.bottom);
  s += band(contentBottom + 24, 'INSTALL, PROOF AND WHAT IT NEVER DOES', [
    {
      color: C.script, titleMono: true, title: 'install-claude · install-codex · install-grok',
      body: 'One installer per tool. Each is a dry run until you add `--write`, and it backs up every file it changes. Node\u00a020 or later.',
    },
    {
      color: C.you, title: 'Proof you can run',
      body: '71\u00a0tests and 96\u00a0mutations, all killed: run them before you install. CI on Ubuntu and Windows, Node\u00a020, 22 and 24.',
    },
    {
      color: C.git, title: 'What it never does',
      body: 'No network, no telemetry, no dependencies. It never edits your code. It writes only to its own handoff folder, and git is only read.',
    },
  ]).svg;

  s += footer(1, [
    { color: C.claude, label: 'Claude Code' }, { color: C.codex, label: 'Codex CLI' }, { color: C.grok, label: 'Grok Build' },
    { color: C.script, label: 'handoff-guard.mjs' }, { color: C.disk, label: 'Notes on disk' }, { color: C.git, label: 'git' },
  ]);
  return doc(s, {
    label: 'Claude Code, OpenAI Codex CLI and xAI Grok Build all run one Node script, handoff-guard.mjs, at their hook moments: it saves each chat’s recap as a note on disk, and asks git whether a 100% claim really changed its docs.',
  });
}
