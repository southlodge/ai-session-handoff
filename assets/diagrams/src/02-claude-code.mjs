// 02: Claude Code: how one chat flows through the hooks. Swim lanes: You · Claude Code · handoff-guard.mjs · Notes on disk · git.
//
// Every behavioural sentence below is checkable in this kit (checked 2026-11-02; check-cites.mjs prints each cited
// line beside its claim). A bare :N is a line of handoff-guard.mjs. claim → source:
//   session-start lists this folder's notes newer than 72 h, one menu line each: bar, title, age
//       handoff-guard.mjs:485 (sessionStart), :454 (menu), :470 (menu line), :246 (listNotes), :48 (NOTE_MAX_AGE_MS)
//   a burst of starts gets no menu                     :510, test "session-start skips the menu for a burst of starts"
//   prompt reads this chat's takeover mark; handed off: say the work moved on, and stop   :543 (prompt), :546, :566-571
//   prompt: past 200k tokens, a nudge to start a new chat                                 :53 (NUDGE_TOKENS), :577-579
//   pretool: handed off: deny all but resume-here and the stop-work tools, naming the new chat
//       :591 (pretool), :590 (STOP_TOOLS), :596-598, :609 (the reason names session t.by); no mark: allow at once :594
//   each reply that does work ends with a HANDOFF recap   CLAUDE.snippet.md:3-4; :131 (recapOf reads the last HANDOFF block)
//   stop saves the recap as <session>.json: summary (the recap) and progress (the bar)    :314 (stop), :326-337, :64
//   complete-check: at 100% the Steps need a docs step and a memory step; named docs must have changed (git)
//       :405 (completeCheck), :417-426, :427 (once), test "complete-check blocks a 100% recap that has no docs or memory step, but only once"
//   compacted keeps the summary on the note; the bar stays   :615 (compacted), :625, test "compacted keeps the compaction summary on the note"
//   statusline paints the context gauge and the chat's bar with its next step, and HANDED OFF if marked
//       :630 (statusline), :640, :642, :643, :203 (gauge)
//   install: a dry run; --write copies the script, merges settings.json, adds the CLAUDE.md rule, backs up each file
//       install-claude.mjs:3-5
//   the model runs takeover, resume-here and notes; list prints the bars for you   :648, :657, :665-667, :672-673, :688
//   notes are plain JSON in ~/.claude/handoff/, kept 72 h, this machine only       :48, :255, :64 (notePath)
//   the hooks read only this folder’s notes: one directory per folder   :45 (ROOT), :63 (projectDir), :246-247 (listNotes)
//   no network, no telemetry, no dependencies; every mode exits 0
//       :27-30 (node built-ins only), :692-693, test "every hook mode exits 0 on empty or malformed input"
import { C, doc, header, footer, arrow, band } from './svg-kit.mjs';
import { sequence } from './sequence.mjs';

export function render() {
  const TOOL = C.claude;
  let s = header('Claude Code: one chat, hook by hook', 'What the hooks do at each moment of a chat, from session start to the next chat taking over');

  const q = sequence({
    lanes: [
      { key: 'you', label: 'You', sub: 'in the terminal', color: C.you, h: 126 },
      { key: 'tool', label: 'Claude Code', sub: 'fires its hooks', color: TOOL, h: 126 },
      { key: 'guard', label: 'handoff-guard.mjs', sub: 'the default host', color: C.script, h: 190 },
      { key: 'disk', label: 'Notes on disk', sub: '~/.claude/handoff/', subMono: true, color: C.disk, h: 112 },
      { key: 'git', label: 'git', sub: 'the one question it asks', color: C.git, h: 91 },
    ],
    columns: [
      { title: 'Session start', sub: 'SessionStart', subMono: true },
      { title: 'You send a prompt', sub: 'UserPromptSubmit', subMono: true },
      { title: 'Claude calls a tool', sub: 'PreToolUse', subMono: true },
      { title: 'Claude replies', sub: 'the reply ends with `HANDOFF`' },
      { title: 'Turn ends', sub: '`Stop`, two hooks' },
      { title: 'Long chat', sub: '`PostCompact` · status line' },
    ],
  });

  const body = { shadow: true, align: 'top', offset: 8 };       // body defaults to 15 px, titles to 17 px
  const prim = (color) => ({ weight: 'primary', color });        // primary: 2.5 px solid, coloured by its source lane
  const ch = { ...body, channel: true };                         // leaves a 30 px channel for the return arrow
  // secondary: a dashed return in the script colour, out of the card's left edge, up the column's channel and
  // into the target's left edge
  const back = (src, dest, col) => {
    const cx = q.channelX(col);
    q.raw(arrow([[src.x - 2, src.y + 28], [cx, src.y + 28], [cx, dest.cy], [dest.x - 2, dest.cy]], { weight: 'secondary', color: C.script }));
  };

  // ① Session start
  const y1 = q.cell(0, 'you', { ...body, accent: C.you, title: 'Open a chat', body: ['Start or resume a chat with `claude`.'] });
  const t1 = q.cell(0, 'tool', { ...body, accent: TOOL, title: 'SessionStart', body: ['Runs before you type.'] });
  const s1 = q.cell(0, 'guard', { ...body, accent: C.script, title: 'session-start', body: ['Reads this folder’s recent notes and lists each chat as a **menu** line: bar, title, age.'] });
  const d1 = q.cell(0, 'disk', { ...body, accent: C.disk, title: 'reads *.json', body: ['Notes newer than 72\u00a0hours, this folder.'] });
  q.down(y1, t1, prim(C.you)).down(t1, s1, prim(TOOL)).down(s1, d1, { ...prim(C.script), label: 'read', labelColor: C.disk });

  // ② Prompt
  const y2 = q.cell(1, 'you', { ...body, accent: C.you, title: 'Type a prompt', body: ['“carry on with the login fix”'] });
  const t2 = q.cell(1, 'tool', { ...body, accent: TOOL, title: 'UserPromptSubmit', body: ['Passes the prompt and transcript path.'] });
  const s2 = q.cell(1, 'guard', { ...body, accent: C.script, title: 'prompt', body: ['Handed off? Say the work moved on, and stop.', 'Past 200k\u00a0tokens: a nudge to start a new chat.'] });
  const d2 = q.cell(1, 'disk', { ...body, accent: C.disk, title: 'reads the mark', body: ['This chat’s takeover mark.'] });
  q.down(y2, t2, prim(C.you)).down(t2, s2, prim(TOOL)).down(s2, d2, prim(C.script));

  // ③ Tool call
  const y3 = q.cell(2, 'you', { ...body, accent: C.you, title: 'Watch it work', body: ['Idle unless a tool is denied.'] });
  const t3 = q.cell(2, 'tool', { ...body, accent: TOOL, title: 'PreToolUse', body: ['Before every tool call.'] });
  const s3 = q.cell(2, 'guard', { ...body, accent: C.script, title: 'pretool', body: ['Handed off? **Deny** all but `resume-here` and stop-work tools, naming the new chat.', 'Else allow at once.'] });
  const d3 = q.cell(2, 'disk', { ...body, accent: C.disk, title: 'reads the mark', body: ['Checked on every call.'] });
  q.down(y3, t3, prim(C.you)).down(t3, s3, prim(TOOL)).down(s3, d3, prim(C.script));

  // ④ Reply with recap
  const y4 = q.cell(3, 'you', { ...body, accent: C.you, title: 'Read the recap', body: ['Task, Done, Next, Files and the bar.'] });
  const t4 = q.cell(3, 'tool', { ...body, accent: TOOL, title: 'Claude writes', body: ['Each reply that does work ends with a `HANDOFF` recap.'] });
  q.cell(3, 'guard', { ...body, accent: C.faint, titleColor: C.muted, title: 'not involved yet', body: [{ t: 'The recap is plain text, read at `Stop`.', fill: C.muted, code: C.muted }] });
  q.up(t4, y4, prim(TOOL));
  q.note(3, 'disk', 'nothing to write yet', { fill: C.muted }); // muted clears 4.5:1 where faint does not (light theme)

  // ⑤ Stop (with a left channel for the return arrow)
  const y5 = q.cell(4, 'you', { ...ch, accent: C.you, title: 'See the status line', body: ['Bar, next step, and **HANDED OFF** if set.'] });
  const t5 = q.cell(4, 'tool', { ...ch, accent: TOOL, title: 'Stop, two hooks', body: ['Fires `stop`, then `complete-check`.'] });
  const s5 = q.cell(4, 'guard', { ...ch, accent: C.script, title: 'Save, check', body: ['`stop` saves the recap as the note.', '`complete-check`: 100% needs docs and memory steps.'] });
  const d5 = q.cell(4, 'disk', { ...ch, rail: true, accent: C.disk, title: 'writes the note', body: ['`<session>.json`: recap and progress.'] });
  const g5 = q.cell(4, 'git', { ...ch, accent: C.git, title: 'git status', body: ['Named docs changed?'] });
  q.down(t5, s5, prim(TOOL)).down(s5, d5, { ...prim(C.script), label: 'write', labelColor: C.disk }).down(s5, g5, { weight: 'secondary', color: C.git, x: q.railX(4) });
  back(s5, y5, 4);

  // ⑥ Long chat
  const y6 = q.cell(5, 'you', { ...ch, accent: C.you, title: 'Carry on or hand off', body: ['A fresh chat picks the note up.'] });
  const t6 = q.cell(5, 'tool', { ...ch, accent: TOOL, title: 'PostCompact', body: ['After the context is summarised.'] });
  const s6 = q.cell(5, 'guard', { ...ch, accent: C.script, title: 'Keep, show', body: ['`compacted` keeps the summary on the note.', '`statusline` paints the gauge and bar.'] });
  const d6 = q.cell(5, 'disk', { ...ch, accent: C.disk, title: 'updates the note', body: ['Adds the summary; the bar stays.'] });
  q.down(t6, s6, prim(TOOL)).down(s6, d6, prim(C.script));
  back(s6, y6, 5);

  // one lane-level note on git (asked once) in place of five repeated notes
  q.laneNote('git', 'asked only at step 5', { fill: C.muted });

  s += q.svg();

  // bottom band: install, commands, boundaries
  s += band(q.bottom + 14, 'INSTALL, COMMANDS AND WHAT IT NEVER DOES', [
    { color: C.script, titleMono: true, title: 'node install-claude.mjs, then --write', body: 'A dry run previews every change. `--write` copies the script into `~/.claude/`, merges the hook and status-line entries into `settings.json`, adds the recap convention to `CLAUDE.md`, and backs up each file it changes.' },
    { color: C.disk, titleMono: true, title: 'takeover · resume-here · list · notes', body: 'The model runs `takeover`, `resume-here` and `notes`; `list` prints the bars for you. Notes are plain JSON in `~/.claude/handoff/`, kept 72\u00a0hours, this machine only.' },
    { color: C.git, title: 'What it never does', body: 'No network, no telemetry, no dependencies. It never edits your code, its hooks read only this folder’s notes, and every mode exits 0, so a broken hook can never block Claude Code itself.' },
  ]).svg;

  s += footer(2, [
    { color: C.you, label: 'You' }, { color: TOOL, label: 'Claude Code' }, { color: C.script, label: 'handoff-guard.mjs' },
    { color: C.disk, label: 'Notes on disk' }, { color: C.git, label: 'git' }, { color: C.script, label: 'back to you', line: true },
  ]);
  return doc(s, { label: 'In Claude Code, handoff-guard.mjs runs at each hook of a chat: it lists recent notes when a new chat starts, tells a handed-off chat to stop, and saves the recap as a note at each turn’s end so the next chat can take over.' });
}
