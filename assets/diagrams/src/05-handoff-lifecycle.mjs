// 05: The hand-off itself. Two-chat timeline. Lanes: Chat A · Notes on disk · Chat B · git.
// The same flow runs in Claude Code, Codex CLI and Grok Build.
import { C, doc, header, footer, arrow, band } from './svg-kit.mjs';
import { sequence } from './sequence.mjs';

const CHAT_A = '#A23B72'; // the chat handing over
const CHAT_B = '#0369A1'; // the chat taking over

export function render() {
  let s = header('The hand-off, chat to chat',
    'The same in Claude Code, Codex CLI and Grok Build: a note carries the work from one chat to the next.');

  const q = sequence({
    lanes: [
      { key: 'a', label: 'Chat A', sub: 'the chat handing over', color: CHAT_A, h: 176 },
      { key: 'disk', label: 'Notes on disk', sub: '~/.claude, .codex, .grok', subMono: true, color: C.disk, h: 158 },
      { key: 'b', label: 'Chat B', sub: 'the chat taking over', color: CHAT_B, h: 152 },
      { key: 'git', label: 'git', sub: 'the one question it asks', color: C.git, h: 124 },
    ],
    columns: [
      { title: 'Chat A works', sub: 'Stop saves the note' },
      { title: 'A fills up, or closes', sub: 'nudge, compact or close' },
      { title: 'Chat B opens', sub: 'SessionStart', subMono: true },
      { title: 'Chat B takes over', sub: 'takeover', subMono: true },
      { title: 'Chat A is stopped', sub: 'prompt, pretool, status line' },
      { title: 'Chat B reaches 100%', sub: 'complete-check', subMono: true },
    ],
  });

  const body = { size: 13.5, shadow: true, align: 'top', offset: 8 };
  const mono = { family: 'mono', size: 12, fill: C.muted };

  // ① Chat A works
  const a1 = q.cell(0, 'a', { ...body, accent: CHAT_A, title: 'Works, then recaps', body: ['Each reply ends with a `HANDOFF` recap. The last one is saved as this chat’s note, bar and next step named.'] });
  const k1 = q.cell(0, 'disk', { ...body, accent: C.disk, title: 'A’s note', body: [{ t: 'session, bar, title', ...mono }, { t: 'next, files, time', ...mono }, 'One JSON per chat, newest first.'] });
  q.down(a1, k1, { color: C.disk, label: 'write', labelSize: 11.5 });
  q.note(0, 'b', 'not open yet');
  q.note(0, 'git', 'not asked');

  // ② A fills up, or closes
  q.cell(1, 'a', { ...body, accent: CHAT_A, title: 'Grows big, or ends', body: ['Past 200k tokens it is nudged to hand off soon.', 'Then it is compacted, hits its limit, or is closed.'] });
  q.note(1, 'disk', 'A’s note is kept 72 h');
  q.note(1, 'b', 'not open yet');
  q.note(1, 'git', 'not asked');

  // ③ Chat B opens
  q.note(2, 'a', 'idle, or closed');
  const k3 = q.cell(2, 'disk', { ...body, accent: C.disk, title: 'the menu', body: ['A’s note is listed, newest first, as data the next chat may read.'] });
  const b3 = q.cell(2, 'b', { ...body, accent: CHAT_B, title: 'Opens, sees the menu', body: ['A new chat in the same folder. `session-start` shows A’s note before you type.'] });
  q.down(k3, b3, { color: C.ok, dashed: true, label: 'menu', labelSize: 11.5 });
  q.note(2, 'git', 'not asked');

  // ④ Chat B takes over
  const b4 = q.cell(3, 'b', { ...body, accent: CHAT_B, title: 'Takes over', body: ['You say “carry on with …”. B runs `takeover <A’s session>`.'] });
  const k4 = q.cell(3, 'disk', { ...body, accent: C.disk, title: 'the mark', body: [{ t: '{ by: Chat B, at: time }', ...mono }, 'While it exists, A is handed off (7 days).'] });
  q.up(b4, k4, { color: C.disk, label: 'write', labelSize: 11.5 });
  q.note(3, 'a', 'still the old chat');
  q.note(3, 'git', 'not asked');

  // ⑤ Chat A is stopped
  const a5 = q.cell(4, 'a', { ...body, accent: CHAT_A, title: 'Told to stop', body: ['Its next prompt says it was handed off. Tool calls are denied; wake-ups stop.', 'Status line: **HANDED OFF**. `resume-here` hands the work back.'] });
  const k5 = q.cell(4, 'disk', { ...body, accent: C.disk, title: 'the mark holds', body: ['Read on every tool call.'] });
  q.up(k5, a5, { color: C.block });
  q.note(4, 'b', 'now the live chat');
  q.note(4, 'git', 'not asked');

  // ⑥ Chat B reaches 100%
  q.note(5, 'a', 'stays silent');
  q.note(5, 'disk', 'B’s note is live now');
  const b6 = q.cell(5, 'b', { ...body, channel: true, accent: CHAT_B, title: 'Reaches 100%', body: ['A 100% recap must name the docs it changed.'] });
  const g6 = q.cell(5, 'git', { ...body, channel: true, accent: C.git, title: 'git status', body: ['Did the named docs really change? Accept, or block once.'] });
  q.down(b6, g6, { color: C.git, label: 'asks git', labelSize: 11.5 });
  const cx6 = q.channelX(5);
  q.raw(arrow([[cx6, g6.cy], [cx6, b6.bottom + 4]], { color: C.block, dashed: true, label: 'or block, once', labelSize: 11.5 }));

  s += q.svg();

  // bottom band: guarantees, commands, boundaries
  s += band(q.bottom + 14, 'THE GUARANTEES, THE COMMANDS AND WHAT IT NEVER DOES', [
    { color: CHAT_B, title: 'Three guarantees', body: 'The next chat can act on the note. The old chat is told to stop and its tools are refused. A 100% claim is checked against git before it is accepted.' },
    { color: C.disk, titleMono: true, title: 'takeover · resume-here · list · notes', body: 'Mark the old chat handed off, lift the mark and hand the work back, print the bars, show the menu. Notes are plain JSON under the tool’s home folder, kept 72 hours, this machine only.' },
    { color: C.git, title: 'What it never does', body: 'No network, no telemetry, no dependencies. It never edits your code or runs the work twice, and every mode exits 0, so a broken hook can never block the tool itself.' },
  ]).svg;

  s += footer(5, [
    { color: CHAT_A, label: 'Chat A' }, { color: C.disk, label: 'Notes on disk' }, { color: CHAT_B, label: 'Chat B' },
    { color: C.git, label: 'git' }, { color: C.ok, label: 'back to a chat' }, { color: C.block, label: 'blocked' },
  ]);
  return doc(s, { label: 'The hand-off lifecycle: Chat A’s recap becomes a note, Chat B reads it and takes the work over, Chat A is told to stop, and the 100% claim is checked against git' });
}
