// 05: The hand-off itself, chat to chat. Lanes: Chat A · Notes on disk · Chat B · git. The flow is the same in
// Claude Code, Codex CLI and Grok Build; where a step differs by tool, the card says so.
//
// Every behavioural sentence below is checkable in this kit (checked 2026-11-02; check-cites.mjs prints each cited
// line beside its claim). A bare :N is always a line of handoff-guard.mjs; any other file is named. claim → source:
//   each reply that does work ends with a HANDOFF recap; Stop saves it as the chat's note
//       CLAUDE.snippet.md:3-4, AGENTS.snippet.md:3, GROK.snippet.md:3, :302 (stop), :314-325
//   a note holds session_id, updated, summary and progress; newest first, one per chat   :314-325, :246, :64
//   Claude Code and Codex: past 200k tokens, a nudge to start a new chat     :53 (NUDGE_TOKENS), :564-567, :527-530
//   B's menu lists A's note, as data; on Grok, at its first tool result      :442 (menu), :460, :501, :515
//   Codex only: a new chat records a start baseline from git                 :497, :352 (snapshotDirty)
//   you say “carry on with …”; B runs takeover <A's session>                 :463 (rule b), :636 (takeover)
//   the mark is takeover/<session>.json holding { by, at }, kept 7 days      :65, :641, :49, :252
//   A is told to stop: its next prompt says so; tool calls are denied, except those that stop work; status line
//   HANDED OFF where there is one        :551, :554-556 (prompt), :575-586 (pretool), :618 (statusline), :631
//   the mark is read on every tool call; resume-here lifts it                :579-584, :645 (resumeHere), :288
//   on Grok, resume-here marks the newer chat in turn                        :287-295 (handBack), :292
//   a 100% recap names the docs it changed, or says none were affected; git must agree, or it is sent back
//       :393 (completeCheck), :405-414, :416-420 (Codex)
//   list prints the bars; notes shows the menu                               :660-661 (list), :653-657 (notes)
//   notes are plain JSON, kept 72 hours, this machine only                   :48, :64, :27-30
//   no network, no telemetry, no dependencies; never edits your code; reads git only (status, diff, show);
//   every mode exits 0
//       :27-30, :343-345, :369 (changedFiles), :680-681, test "every mode exits 0 on empty or malformed input"
import { C, doc, header, footer, band, getTheme } from './svg-kit.mjs';
import { sequence } from './sequence.mjs';

// Chat A (handing over) and Chat B (taking over) are tool-neutral colours, so the picture never implies one tool.
// Sourced per theme (not cached hex), so setTheme('dark') re-colours them. All four clear 4.5:1 on panel and bg, and
// light Chat B sits far enough from the git colour (ΔE 21) for the legend check to tell them apart.
const CHAT = {
  light: { a: '#A23B72', b: '#0A6DB3' },
  dark: { a: '#E27AB0', b: '#4FA8E8' },
};

export function render() {
  const { a: CHAT_A, b: CHAT_B } = CHAT[getTheme()] ?? CHAT.light;

  let s = header('The hand-off, chat to chat',
    'A note carries the work from one chat to the next, the same in Claude Code, Codex CLI and Grok Build.');

  const q = sequence({
    lanes: [
      { key: 'a', label: 'Chat A', sub: 'the chat handing over', color: CHAT_A, h: 196 },
      { key: 'disk', label: 'Notes on disk', sub: '~/.<tool>/handoff/', subMono: true, color: C.disk, h: 152 },
      { key: 'b', label: 'Chat B', sub: 'the chat taking over', color: CHAT_B, h: 158 },
      { key: 'git', label: 'git', sub: 'the one question it asks', color: C.git, h: 128 },
    ],
    columns: [
      { title: 'Chat A works', sub: 'Stop saves the note' },
      { title: 'A fills up, or ends', sub: 'nudge, then compact or close' },
      { title: 'Chat B opens', sub: 'session-start', subMono: true },
      { title: 'Chat B takes over', sub: 'takeover', subMono: true },
      { title: 'Chat A is stopped', sub: 'prompt, pretool, status line' },
      { title: 'Chat B reaches 100%', sub: 'complete-check', subMono: true },
    ],
  });

  const body = { shadow: true, align: 'top', offset: 8 }; // body defaults to 15 px, title to 17 px
  const mono = { family: 'mono', size: 13, fill: C.muted };
  const note = C.disk; // the note colour: the primary spine (write, read, mark) is drawn in it

  // --- the primary spine: A writes the note, B reads it, B takes over (solid 2.5 px) ---
  // the side effects (A told to stop, the git check and its block) are secondary (dashed 1.75 px)

  // (1) Chat A works
  const a1 = q.cell(0, 'a', { ...body, accent: CHAT_A, title: 'Works, then recaps', body: ['Each reply that does work ends with a `HANDOFF` recap.', '`Stop` saves it as A’s note.'] });
  const k1 = q.cell(0, 'disk', { ...body, accent: C.disk, title: 'A’s note', body: [{ t: 'session_id · updated', ...mono }, { t: 'summary · progress', ...mono }, 'Newest first, one per chat.'] });
  q.down(a1, k1, { color: note, weight: 'primary', label: 'write' });
  q.note(1, 'b', 'not open yet', { fill: C.muted });
  q.note(2, 'git', 'Codex only: a start baseline', { fill: C.muted });

  // (2) A fills up, or ends (Grok has no nudge)
  q.cell(1, 'a', { ...body, accent: CHAT_A, title: 'Fills up, or ends', body: ['In Claude Code and Codex, past 200k\u00a0tokens, a nudge to start a new chat.', 'Then it compacts, or closes.'] });

  // (3) Chat B opens (Grok delivers the menu at the first tool result, not at start)
  q.note(2, 'a', 'idle while B starts', { fill: C.muted });
  const k3 = q.cell(2, 'disk', { ...body, accent: C.disk, title: 'The menu', body: ['A’s note is listed for B to read, as data.'] });
  const b3 = q.cell(2, 'b', { ...body, accent: CHAT_B, title: 'Opens, sees it', body: ['A new chat, same folder.', 'Its menu lists A’s note.', 'On Grok, at its first tool result.'] });
  q.down(k3, b3, { color: note, weight: 'primary', label: 'read' });

  // (4) Chat B takes over
  const b4 = q.cell(3, 'b', { ...body, accent: CHAT_B, title: 'Takes over', body: ['You say “carry on with …”.', 'B runs `takeover <A’s session>`.'] });
  const k4 = q.cell(3, 'disk', { ...body, accent: C.disk, title: 'The mark', body: [{ t: 'takeover/<session>.json', ...mono }, { t: '{ by, at }', ...mono }, 'Held for 7\u00a0days.'] });
  q.up(b4, k4, { color: note, weight: 'primary', label: 'mark' });

  // (5) Chat A is stopped (secondary: the mark denies A)
  const a5 = q.cell(4, 'a', { ...body, accent: CHAT_A, title: 'Told to stop', body: ['Its next prompt says so.', 'Tool calls are denied, except those that stop work.', 'Status line, where there is one: **HANDED OFF**.'] });
  const k5 = q.cell(4, 'disk', { ...body, accent: C.disk, title: 'The mark holds', body: ['Read on every tool call.', '`resume-here` lifts it.'] });
  q.up(k5, a5, { color: C.block, weight: 'secondary' });

  // (6) Chat B reaches 100% (secondary: the git check, and the block; the block fires on every pass, not once)
  const b6 = q.cell(5, 'b', { ...body, accent: CHAT_B, title: 'Reaches 100%', body: ['A 100% recap names the docs it changed, or says none were affected.'] });
  const g6 = q.cell(5, 'git', { ...body, accent: C.git, title: 'git status', body: ['Did the named docs really change?'] });
  q.down(b6, g6, { x: b6.cx - 70, color: C.git, weight: 'secondary' });
  q.up(g6, b6, { x: b6.cx - 10, color: C.block, weight: 'secondary', label: 'or sent back' });

  s += q.svg();

  // bottom band: the three guarantees, the commands, the boundaries
  s += band(q.bottom + 16, 'GUARANTEES, COMMANDS AND WHAT IT NEVER DOES', [
    { color: CHAT_B, title: 'Three guarantees', body: 'The next chat can act on the note. The old chat is told to stop: its tool calls are denied, except those that stop work. A 100% claim is checked against git before it is accepted.' },
    { color: C.disk, titleMono: true, title: 'takeover · resume-here · list · notes', body: '`takeover` marks the old chat; `resume-here` lifts the mark, and on Grok marks the newer chat in turn. `list` prints the bars; `notes` shows the menu. Notes are plain JSON, kept 72\u00a0hours, this machine only.' },
    { color: C.git, title: 'What it never does', body: 'No network, no telemetry, no dependencies. It never edits your code and reads git only, and every mode exits 0, so a broken hook can never block the tool itself.' },
  ]).svg;

  s += footer(5, [
    { color: CHAT_A, label: 'Chat A' }, { color: C.disk, label: 'Notes on disk' }, { color: CHAT_B, label: 'Chat B' },
    { color: C.git, label: 'git' }, { color: C.block, label: 'blocked', line: true },
  ]);
  return doc(s, { label: 'The hand-off: Chat A’s last recap is saved as a note, Chat B reads it and takes the work over, Chat A is then told to stop, and a 100% claim is checked against git.' });
}
