// 03: Codex CLI: the same hooks, run with --host codex. Same lanes and columns as 02. A grey chip (mark: MARK) marks
// each card that behaves differently from Claude Code; same: true marks a card that must match its 02 twin word for
// word once the tool name is neutral. build.mjs checks both directions.
//
// Every behavioural sentence below is checkable in this kit (checked 2026-11-02; check-cites.mjs prints each cited
// line beside its claim). A bare :N is always a line of handoff-guard.mjs; any other file is named. claim → source:
//   the hooks: SessionStart (startup, resume, clear, compact), UserPromptSubmit, PreToolUse, Stop; no PostCompact
//       codex-hooks.json:6 (the matcher); its four event keys
//   every hook runs with --host codex, and the takeover command the menu suggests carries it too
//       codex-hooks.json:10, :47 (HOST_FLAG), :463
//   session-start lists this folder’s notes newer than 72 h, one menu line each: bar, title, age
//       :473 (sessionStart), :442 (menu), :458 (menu line), :234 (listNotes), :48 (NOTE_MAX_AGE_MS)
//   CODEX_HOME moves the note store
//       :43-45 (HOST_DIR, ROOT), test "CODEX_HOME moves the note store, as it moves the rest of Codex"
//   a new chat records a start baseline: what git already shows changed       :497, :352-355 (snapshotDirty), :68
//   prompt: handed off, say the work moved on, and stop                        :531 (prompt), :534, :554-559
//   prompt: past 200k tokens, a nudge, read from Codex token_count events
//       :53 (NUDGE_TOKENS), :565-567, test "the big-chat nudge reads Codex token_count events"
//   PreToolUse runs before shell, apply_patch and MCP calls on recent Codex    BUILD-YOUR-OWN-CODEX-HANDOFF.md:228-229
//   pretool: handed off, deny naming the new chat; only resume-here passes (no Codex tool is a stop-work tool)
//       :578 (STOP_TOOLS), :584-586, :597
//   each final reply that does work ends with a HANDOFF recap; recapOf reads the last one   AGENTS.snippet.md:3-4, :131
//   Codex has no status line; stop saves the note without printing anything    :660, :302 (stop), :314-325
//   complete-check on Codex: at 100%, a docs step only if files changed since the start baseline; never a memory step
//       :416-420, test "complete-check blocks a 100% recap with changed files and no docs step, but only once"
//   compaction arrives as SessionStart compact: session-start re-attaches this chat’s last recap   :490-494
//   install: a dry run; --write copies the script and merges the hooks, backing up hooks.json; you paste the recap rule
//       install-codex.mjs:3-4, install-codex.mjs:78 (paste AGENTS.snippet.md into AGENTS.md)
//   the model runs takeover, resume-here and notes; list prints the bars for you   :636, :645, :653-655, :660-661
//   notes are plain JSON in ~/.codex/handoff/, kept 72 h, this machine only   :43-45, :48, :243, :64 (notePath)
//   no network, no telemetry, no dependencies; it never edits code; every mode exits 0
//       :27-30 (node built-ins only), :680-681, test "every mode exits 0 on empty or malformed input"
import { C, doc, header, footer, arrow, band } from './svg-kit.mjs';
import { sequence } from './sequence.mjs';

const MARK = 'differs'; // the subtitle says what the grey chip means

export function render() {
  const TOOL = C.codex;
  let s = header('Codex CLI: one chat, hook by hook', 'What the hooks do on Codex, run with --host codex; a grey chip marks each step that differs from Claude Code');

  const q = sequence({
    lanes: [
      { key: 'you', label: 'You', sub: 'in the terminal', color: C.you, h: 126 },
      { key: 'tool', label: 'Codex CLI', sub: 'fires its hooks', color: TOOL, h: 126 },
      { key: 'guard', label: 'handoff-guard.mjs', sub: '--host codex', subMono: true, color: C.script, h: 190 },
      { key: 'disk', label: 'Notes on disk', sub: '~/.codex/handoff/', subMono: true, color: C.disk, h: 112 },
      { key: 'git', label: 'git', sub: 'the one question it asks', color: C.git, h: 91 },
    ],
    columns: [
      { title: 'Session start', sub: 'SessionStart', subMono: true },
      { title: 'You send a prompt', sub: 'UserPromptSubmit', subMono: true },
      { title: 'Codex calls a tool', sub: 'PreToolUse', subMono: true },
      { title: 'Codex replies', sub: 'the reply ends with `HANDOFF`' },
      { title: 'Turn ends', sub: '`Stop`, two hooks' },
      { title: 'Long chat', sub: '`compact` matcher · `list`' },
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

  // ① Session start
  const y1 = q.cell(0, 'you', { ...body, ...same, accent: C.you, title: 'Open a chat', body: ['Start or resume a chat with `codex`.'] });
  const t1 = q.cell(0, 'tool', { ...body, ...differs, accent: TOOL, title: 'SessionStart', body: ['`startup`, `resume`, `clear` or `compact`.'] });
  const s1 = q.cell(0, 'guard', { ...body, ...differs, accent: C.script, title: 'session-start', body: ['Lists this folder’s recent notes as **menu** lines: bar, title, age.', 'Its `takeover` command carries `--host codex`.'] });
  const d1 = q.cell(0, 'disk', { ...body, ...differs, rail: true, accent: C.disk, title: 'reads *.json', body: ['Notes in `CODEX_HOME` newer than 72\u00a0hours.'] });
  const g1 = q.cell(0, 'git', { ...body, ...differs, accent: C.git, title: 'git status', body: ['Records the start baseline.'] });
  q.down(y1, t1, prim(C.you)).down(t1, s1, prim(TOOL)).down(s1, d1, { ...prim(C.script), label: 'read', labelColor: C.disk }).down(s1, g1, { weight: 'secondary', color: C.git, x: q.railX(0) });

  // ② Prompt
  const y2 = q.cell(1, 'you', { ...body, ...same, accent: C.you, title: 'Type a prompt', body: ['“carry on with the login fix”'] });
  const t2 = q.cell(1, 'tool', { ...body, ...same, accent: TOOL, title: 'UserPromptSubmit', body: ['Passes the prompt and transcript path.'] });
  const s2 = q.cell(1, 'guard', { ...body, ...differs, accent: C.script, title: 'prompt', body: ['Handed off? Say the work moved on, and stop.', 'Past 200k\u00a0tokens: a nudge, read from Codex `token_count` events.'] });
  const d2 = q.cell(1, 'disk', { ...body, ...same, accent: C.disk, title: 'reads the mark', body: ['This chat’s takeover mark.'] });
  q.down(y2, t2, prim(C.you)).down(t2, s2, prim(TOOL)).down(s2, d2, prim(C.script));

  // ③ Tool call
  const y3 = q.cell(2, 'you', { ...body, ...same, accent: C.you, title: 'Watch it work', body: ['Idle unless a tool is denied.'] });
  const t3 = q.cell(2, 'tool', { ...body, ...differs, accent: TOOL, title: 'PreToolUse', body: ['Before shell, edit and MCP calls.'] });
  const s3 = q.cell(2, 'guard', { ...body, ...differs, accent: C.script, title: 'pretool', body: ['Handed off? **Deny**, naming the new chat; only `resume-here` passes.', 'Else allow at once.'] });
  const d3 = q.cell(2, 'disk', { ...body, ...same, accent: C.disk, title: 'reads the mark', body: ['Checked on every call.'] });
  q.down(y3, t3, prim(C.you)).down(t3, s3, prim(TOOL)).down(s3, d3, prim(C.script));

  // ④ Reply with recap
  const y4 = q.cell(3, 'you', { ...body, ...same, accent: C.you, title: 'Read the recap', body: ['Task, Done, Next, Files and the bar.'] });
  const t4 = q.cell(3, 'tool', { ...body, ...same, accent: TOOL, title: 'Codex writes', body: ['Each reply that does work ends with a `HANDOFF` recap.'] });
  q.cell(3, 'guard', { ...body, ...same, accent: C.faint, titleColor: C.muted, title: 'not involved yet', body: [{ t: 'The recap is plain text, read at `Stop`.', fill: C.muted, code: C.muted }] });
  q.up(t4, y4, prim(TOOL));
  q.note(3, 'disk', 'nothing to write yet', { fill: C.muted }); // muted clears 4.5:1 where faint does not (light theme)

  // ⑤ Stop (with a left channel for the return arrow)
  const y5 = q.cell(4, 'you', { ...ch, ...differs, accent: C.you, title: 'Silent', body: ['No status line; the note is saved quietly.'] });
  const t5 = q.cell(4, 'tool', { ...ch, ...same, accent: TOOL, title: 'Stop, two hooks', body: ['Fires `stop`, then `complete-check`.'] });
  const s5 = q.cell(4, 'guard', { ...ch, ...differs, accent: C.script, title: 'Save, check', body: ['`stop` saves the note.', '`complete-check`: at 100%, a docs step only if files changed.', 'Never a memory step.'] });
  const d5 = q.cell(4, 'disk', { ...ch, ...same, rail: true, accent: C.disk, title: 'writes the note', body: ['`<session>.json`: recap and progress.'] });
  const g5 = q.cell(4, 'git', { ...ch, ...differs, accent: C.git, title: 'git status', body: ['New since the baseline?'] });
  q.down(t5, s5, prim(TOOL)).down(s5, d5, { ...prim(C.script), label: 'write', labelColor: C.disk }).down(s5, g5, { weight: 'secondary', color: C.git, x: q.railX(4) });
  back(s5, t5, 4);

  // ⑥ Long chat
  q.cell(5, 'you', { ...ch, ...differs, accent: C.you, title: 'List', body: ['Run `list` for the bars.'] });
  const t6 = q.cell(5, 'tool', { ...ch, ...differs, accent: TOOL, title: 'Compaction', body: ['Fires `SessionStart` with `compact`.'] });
  const s6 = q.cell(5, 'guard', { ...ch, ...differs, accent: C.script, title: 'On compact', body: ['`session-start` re-attaches the last **recap**.', 'The summary is not saved.'] });
  const d6 = q.cell(5, 'disk', { ...ch, ...differs, accent: C.disk, title: 'reads back', body: ['This chat’s saved recap.'] });
  q.down(t6, s6, prim(TOOL)).down(s6, d6, { ...prim(C.script), label: 'read', labelColor: C.disk });
  back(s6, t6, 5);

  // one lane-level note on git in place of repeated notes (git is asked at the start and at step 5 only)
  q.laneNote('git', 'otherwise not asked', { fill: C.muted });

  s += q.svg();

  // bottom band: install, commands, boundaries
  s += band(q.bottom + 14, 'INSTALL, COMMANDS AND WHAT IT NEVER DOES', [
    { color: C.script, titleMono: true, title: 'node install-codex.mjs, then --write', body: 'A dry run previews every change. `--write` copies the script and merges `codex-hooks.json` into `hooks.json`, backing it up. You paste the recap rule into `AGENTS.md`.' },
    { color: C.disk, titleMono: true, title: 'takeover · resume-here · list · notes', body: 'The model runs `takeover`, `resume-here` and `notes`; `list` prints the bars for you. Notes are plain JSON in `~/.codex/handoff/`, kept 72\u00a0hours, this machine only.' },
    { color: C.git, title: 'What it never does', body: 'No network, no telemetry, no dependencies. It never edits your code, and every mode exits 0, so a broken hook can never block Codex itself.' },
  ]).svg;

  s += footer(3, [
    { color: C.you, label: 'You' }, { color: TOOL, label: 'Codex CLI' }, { color: C.script, label: 'handoff-guard.mjs' },
    { color: C.disk, label: 'Notes on disk' }, { color: C.git, label: 'git' }, { color: C.script, label: 'back to Codex', line: true },
  ]);
  return doc(s, { label: 'In Codex CLI, handoff-guard.mjs runs with --host codex: it records a git baseline when a new chat starts, reads the chat’s size from token_count events, and saves the recap as a note at each turn’s end so the next chat can take over.' });
}
