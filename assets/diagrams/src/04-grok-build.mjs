// 04: Grok Build: the same hooks, run with --host grok. Same lanes as 02, columns in event order; column 4 is the
// first tool result, where the start menu arrives. A grey chip (mark: MARK) marks each card that behaves differently
// from Claude Code; same: true marks a card that must match its 02 twin word for word once the tool name is neutral.
// build.mjs checks both directions.
//
// Every behavioural sentence below is checkable in this kit (checked 2026-11-02; check-cites.mjs prints each cited
// line beside its claim). A bare :N is always a line of handoff-guard.mjs; any other file is named. claim → source:
//   the hooks: SessionStart (new, load), UserPromptSubmit, PreToolUse (no matcher: every tool), PostToolUse,
//   PostToolUseFailure, PostCompact, Stop (stop, then complete-check); each runs with --host grok
//       grok-hooks.json:5, grok-hooks.json:15, grok-hooks.json:36, grok-hooks.json:58; :47 (HOST_FLAG)
//   Grok ignores what SessionStart and PostCompact hooks print, so session-start owes this folder’s menu of notes
//       :275-277, :454 (menu), :513, test "session-start prints nothing; the first tool result carries the menu, once"
//   the owed marker lives in _pending/                                         :66 (pendingPath), :278 (owe)
//   posttool delivers it once, as data, with the next tool result; a failed call counts; dropped after 2 h
//       :518 (posttool), :282 (rename), :285 (age), :55, :472 ("DATA"),
//       test "a failed first tool call delivers the menu too, under its own event name",
//       test "tool calls running at once deliver the menu exactly once"
//   UserPromptSubmit: Grok shows a hook's text only when it blocks             :539-542
//   prompt: handed off, blocked until you type continue here                   :543 (prompt), :563
//   prompt: a typed prompt drops a stale tool-ran marker                       :550, :67 (toolRanPath),
//       test "prompt (Grok): a typed prompt drops a tool-ran marker left by an interrupted turn"
//   pretool: deny; the reason opens with resume-here; stop-work tools and resume-here pass
//       :590 (STOP_TOOLS), :596-598, :607
//   stop saves the recap; a tool turn with none is sent back once              :314 (stop), :326-337, :343,
//       test "stop (Grok): a turn that ran a tool but has no HANDOFF recap is blocked, once"
//   complete-check: at 100%, docs and memory steps; asks git whether the named docs changed
//       :405 (completeCheck), :417-426, test "complete-check blocks a 100% recap with no docs or memory step, but only once"
//   compacted keeps the summary; the next tool re-attaches the recap           :615 (compacted), :622, :625, :528
//   statusline: bar, next step, HANDED OFF; caches the context size in _ctx/   :630 (statusline), :639, :643, :69
//   three writes in a long chat: summary on the note, the owed _pending/ marker, the _ctx/ size   :625, :622, :639
//   install: a dry run; --write writes the script, the hooks file and the rules file under ~/.grok/, plus a .cmd
//   wrapper on Windows, and backs up each file it changes; never config.toml
//       install-grok.mjs:3-8, install-grok.mjs:30-34, install-grok.mjs:35-40, install-grok.mjs:44, install-grok.mjs:90,
//       test "installer: writes its three files, never config.toml, is idempotent, and backs up a changed file"
//   the model runs takeover, resume-here and notes; list prints the bars for you   :648, :657, :665-667, :672-673
//   notes are plain JSON in ~/.grok/handoff/, kept 72 h, this machine only    :43-45, :48, :64 (notePath)
//   no network, no telemetry, no dependencies; every mode exits 0; Claude Code hooks run through the compatibility
//   layer do nothing
//       :27-30 (node built-ins only), :38-41, :692-693, test "every mode exits 0 on empty or malformed input",
//       test "Claude Code hooks that Grok runs through its compatibility layer do nothing"
import { C, doc, header, footer, arrow, band } from './svg-kit.mjs';
import { sequence } from './sequence.mjs';

const MARK = 'differs'; // the subtitle says what the grey chip means

export function render() {
  const TOOL = C.grok;
  let s = header('Grok Build: one chat, hook by hook', 'What the hooks do on Grok, run with --host grok; a grey chip marks each step that differs from Claude Code');

  const q = sequence({
    lanes: [
      { key: 'you', label: 'You', sub: 'in the terminal', color: C.you, h: 126 },
      { key: 'tool', label: 'Grok Build', sub: 'fires its hooks', color: TOOL, h: 126 },
      { key: 'guard', label: 'handoff-guard.mjs', sub: '--host grok', subMono: true, color: C.script, h: 190 },
      { key: 'disk', label: 'Notes on disk', sub: '~/.grok/handoff/', subMono: true, color: C.disk, h: 112 },
      { key: 'git', label: 'git', sub: 'the one question it asks', color: C.git, h: 91 },
    ],
    columns: [
      { title: 'Session start', sub: 'SessionStart', subMono: true },
      { title: 'You send a prompt', sub: 'UserPromptSubmit', subMono: true },
      { title: 'Grok calls a tool', sub: 'PreToolUse', subMono: true },
      { title: 'First tool result', sub: 'PostToolUse', subMono: true },
      { title: 'Turn ends', sub: '`Stop`, two hooks' },
      { title: 'Long chat', sub: '`PostCompact` · status line' },
    ],
  });

  const body = { shadow: true, align: 'top', offset: 8 };       // body defaults to 15 px, titles to 17 px
  const prim = (color) => ({ weight: 'primary', color });        // primary: 2.5 px solid, coloured by its source lane
  const ch = { ...body, channel: true };                         // leaves a 30 px channel for the return arrow
  const same = { same: true };                                   // worded as its 02 twin; build.mjs checks it
  const differs = { mark: MARK };                                // the grey chip; build.mjs checks it has no twin
  // secondary: a dashed return in the script colour, out of the card's left edge, up the column's channel and
  // into the target's left edge
  const back = (src, dest, col) => {
    const cx = q.channelX(col);
    q.raw(arrow([[src.x - 2, src.y + 28], [cx, src.y + 28], [cx, dest.cy], [dest.x - 2, dest.cy]], { weight: 'secondary', color: C.script }));
  };

  // ① Session start: Grok shows nothing a start hook prints, so the menu is owed to the first tool result
  const y1 = q.cell(0, 'you', { ...body, ...same, accent: C.you, title: 'Open a chat', body: ['Start or resume a chat with `grok`.'] });
  const t1 = q.cell(0, 'tool', { ...body, ...same, accent: TOOL, title: 'SessionStart', body: ['Runs before you type.'] });
  const s1 = q.cell(0, 'guard', { ...body, ...differs, accent: C.script, title: 'session-start', body: ['Grok ignores start-hook text, so this folder’s **menu** of recent notes is owed.', 'A marker waits for the first tool result.'] });
  const d1 = q.cell(0, 'disk', { ...body, ...differs, accent: C.disk, title: 'owes the menu', body: ['`_pending/` marks the menu as owed.'] });
  q.down(y1, t1, prim(C.you)).down(t1, s1, prim(TOOL)).down(s1, d1, { ...prim(C.script), label: 'write', labelColor: C.disk });

  // ② Prompt: Grok shows a prompt hook's text only when the hook blocks
  const y2 = q.cell(1, 'you', { ...body, ...same, accent: C.you, title: 'Type a prompt', body: ['“carry on with the login fix”'] });
  const t2 = q.cell(1, 'tool', { ...body, ...differs, accent: TOOL, title: 'Prompt hook', body: ['Its text is shown only on a block.'] });
  const s2 = q.cell(1, 'guard', { ...body, ...differs, accent: C.script, title: 'prompt', body: ['Handed off? **Blocked** until you type `continue here`.', 'A typed prompt drops a stale **tool-ran** marker from an interrupted turn.'] });
  const d2 = q.cell(1, 'disk', { ...body, ...differs, accent: C.disk, title: 'reads the mark', body: ['Takeover mark; a stale `_toolran` drops.'] });
  q.down(y2, t2, prim(C.you)).down(t2, s2, prim(TOOL)).down(s2, d2, prim(C.script));

  // ③ Tool call: PreToolUse has no matcher, so it runs before every tool
  const y3 = q.cell(2, 'you', { ...body, ...same, accent: C.you, title: 'Watch it work', body: ['Idle unless a tool is denied.'] });
  const t3 = q.cell(2, 'tool', { ...body, ...same, accent: TOOL, title: 'PreToolUse', body: ['Before every tool call.'] });
  const s3 = q.cell(2, 'guard', { ...body, ...differs, accent: C.script, title: 'pretool', body: ['Handed off? **Deny**; the reason opens with the `resume-here` command.', 'Stop-work tools and `resume-here` pass.'] });
  const d3 = q.cell(2, 'disk', { ...body, ...same, accent: C.disk, title: 'reads the mark', body: ['Checked on every call.'] });
  q.down(y3, t3, prim(C.you)).down(t3, s3, prim(TOOL)).down(s3, d3, prim(C.script));

  // ④ First tool result, where the menu owed at ① arrives (a channel column: posttool's return arrow runs up its left side)
  q.note(3, 'you', 'the menu is for Grok', { fill: C.muted }); // muted clears 4.5:1 where faint does not (light theme)
  const t4 = q.cell(3, 'tool', { ...ch, ...differs, accent: TOOL, title: 'Tool result', body: ['`PostToolUse` or `PostToolUseFailure`.'] });
  const s4 = q.cell(3, 'guard', { ...ch, ...differs, accent: C.script, title: 'posttool', body: ['Delivers the owed **menu** once, as data.', 'A failed first call counts too; dropped after 2\u00a0hours.'] });
  const d4 = q.cell(3, 'disk', { ...ch, ...differs, accent: C.disk, title: 'the marker', body: ['`_pending/`, claimed by an exclusive lock.'] });
  q.down(t4, s4, prim(TOOL)).down(s4, d4, { ...prim(C.script), label: 'read', labelColor: C.disk });
  back(s4, t4, 3);

  // ⑤ Turn ends (with a left channel for the return arrow)
  const y5 = q.cell(4, 'you', { ...ch, ...same, accent: C.you, title: 'Read the recap', body: ['Task, Done, Next, Files and the bar.'] });
  const t5 = q.cell(4, 'tool', { ...ch, ...same, accent: TOOL, title: 'Stop, two hooks', body: ['Fires `stop`, then `complete-check`.'] });
  const s5 = q.cell(4, 'guard', { ...ch, ...differs, accent: C.script, title: 'Save, check', body: ['`stop` saves the recap; a tool turn with none is sent back once.', '`complete-check`: docs and memory at 100%.'] });
  const d5 = q.cell(4, 'disk', { ...ch, ...same, rail: true, accent: C.disk, title: 'writes the note', body: ['`<session>.json`: recap and progress.'] });
  const g5 = q.cell(4, 'git', { ...ch, ...same, accent: C.git, title: 'git status', body: ['Named docs changed?'] });
  q.up(t5, y5, prim(TOOL)).down(t5, s5, prim(TOOL)).down(s5, d5, { ...prim(C.script), label: 'write', labelColor: C.disk }).down(s5, g5, { weight: 'secondary', color: C.git, x: q.railX(4) });
  back(s5, t5, 4);

  // ⑥ Long chat
  const y6 = q.cell(5, 'you', { ...ch, ...same, accent: C.you, title: 'See the status line', body: ['Bar, next step, and **HANDED OFF** if set.'] });
  const t6 = q.cell(5, 'tool', { ...ch, ...same, accent: TOOL, title: 'PostCompact', body: ['After the context is summarised.'] });
  const s6 = q.cell(5, 'guard', { ...ch, ...differs, accent: C.script, title: 'Keep, show', body: ['`compacted` keeps the summary; the next tool re-attaches the recap.', '`statusline` caches the context size.'] });
  const d6 = q.cell(5, 'disk', { ...ch, ...differs, accent: C.disk, title: 'three writes', body: ['Summary, `_pending/` marker, `_ctx/` size.'] });
  q.down(t6, s6, prim(TOOL)).down(s6, d6, prim(C.script));
  back(s6, y6, 5);

  // one lane-level note on git in place of repeated notes (git is asked at step 5 only)
  q.laneNote('git', 'asked only at step 5', { fill: C.muted });

  s += q.svg();

  // bottom band: install, commands, boundaries
  s += band(q.bottom + 14, 'INSTALL, COMMANDS AND WHAT IT NEVER DOES', [
    { color: C.script, titleMono: true, title: 'node install-grok.mjs, then --write', body: 'A dry run previews every change. `--write` writes the script, `hooks/handoff-guard.json` and `rules/chat-handoff.md` under `~/.grok/`, plus a `.cmd` status-line wrapper on Windows, and backs up each file it changes.' },
    { color: C.disk, titleMono: true, title: 'takeover · resume-here · list · notes', body: 'The model runs `takeover`, `resume-here` and `notes`; `list` prints the bars for you. Notes are plain JSON in `~/.grok/handoff/`, kept 72\u00a0hours, this machine only.' },
    { color: C.git, title: 'What it never does', body: 'No network, no telemetry, no dependencies, and every mode exits 0. It never edits `config.toml` or your code. Claude Code hooks run through Grok’s compatibility layer do nothing.' },
  ]).svg;

  s += footer(4, [
    { color: C.you, label: 'You' }, { color: TOOL, label: 'Grok Build' }, { color: C.script, label: 'handoff-guard.mjs' },
    { color: C.disk, label: 'Notes on disk' }, { color: C.git, label: 'git' }, { color: C.script, label: 'back to Grok or you', line: true },
  ]);
  return doc(s, { label: 'In Grok Build, handoff-guard.mjs runs with --host grok: it delivers the start menu at the first tool result, blocks a handed-off chat’s prompts until you type continue here, and saves the recap as a note at each turn’s end so the next chat can take over.' });
}
