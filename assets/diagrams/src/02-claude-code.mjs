// 02: Claude Code: how one chat flows through the hooks. Swim lanes: You · Claude Code · handoff-guard.mjs · Notes on disk · git.
import { C, doc, header, footer, arrow, band } from './svg-kit.mjs';
import { sequence } from './sequence.mjs';

export function render() {
  const TOOL = C.claude;
  let s = header('Claude Code: one chat, hook by hook', 'What the hooks do at each moment of a session, from start to the next chat taking over');

  const q = sequence({
    lanes: [
      { key: 'you', label: 'You', sub: 'in the terminal', color: C.you, h: 104 },
      { key: 'tool', label: 'Claude Code', sub: 'fires its hooks', color: TOOL, h: 110 },
      { key: 'guard', label: 'handoff-guard.mjs', sub: 'one script, one mode per hook', color: C.script, h: 232 },
      { key: 'disk', label: 'Notes on disk', sub: '~/.claude/handoff/', subMono: true, color: C.disk, h: 110 },
      { key: 'git', label: 'git', sub: 'the one question it asks', color: C.git, h: 104 },
    ],
    columns: [
      { title: 'Session start', sub: 'SessionStart', subMono: true },
      { title: 'You send a prompt', sub: 'UserPromptSubmit', subMono: true },
      { title: 'Claude calls a tool', sub: 'PreToolUse', subMono: true },
      { title: 'Claude replies', sub: 'the reply ends with HANDOFF' },
      { title: 'Turn ends', sub: 'Stop, two hooks' },
      { title: 'Long chat', sub: 'PostCompact · status line' },
    ],
  });

  const body = { size: 13.5, shadow: true, align: 'top', offset: 8 };
  const rw = { color: C.disk, labelSize: 11.5 };

  // ① Session start
  const y1 = q.cell(0, 'you', { ...body, accent: C.you, title: 'Open a chat', body: ['`claude` in the project folder, or resume one.'] });
  const t1 = q.cell(0, 'tool', { ...body, accent: TOOL, title: 'SessionStart', body: ['Runs the hook before you type.'] });
  const s1 = q.cell(0, 'guard', { ...body, accent: C.script, title: 'session-start', body: ['Reads this folder’s recent notes and prints a **menu** inside a data envelope: bar, title, age and next step of each chat.', 'Once per burst of starts.'] });
  const d1 = q.cell(0, 'disk', { ...body, accent: C.disk, title: 'reads *.json', body: ['Notes newer than 72 h, this folder only.'] });
  q.down(y1, t1).down(t1, s1).down(s1, d1, { ...rw, label: 'read' });
  q.note(0, 'git', 'not asked');

  // ② Prompt
  const y2 = q.cell(1, 'you', { ...body, accent: C.you, title: 'Type a prompt', body: ['“carry on with the login rate limit”'] });
  const t2 = q.cell(1, 'tool', { ...body, accent: TOOL, title: 'UserPromptSubmit', body: ['Passes the prompt and the transcript path.'] });
  const s2 = q.cell(1, 'guard', { ...body, accent: C.script, title: 'prompt', body: ['**Handed off?** Then it says which chat took over and tells Claude to stop.', 'Past ~200k tokens it nudges: hand off soon.', 'Otherwise silent.'] });
  const d2 = q.cell(1, 'disk', { ...body, accent: C.disk, title: 'reads the mark', body: ['The `handed-off` flag on this chat’s note.'] });
  q.down(y2, t2).down(t2, s2).down(s2, d2, { ...rw, label: 'read' });
  q.note(1, 'git', 'not asked');

  // ③ Tool call
  const y3 = q.cell(2, 'you', { ...body, accent: C.you, title: 'Watch it work', body: ['Nothing to do unless a tool is refused.'] });
  const t3 = q.cell(2, 'tool', { ...body, accent: TOOL, title: 'PreToolUse', body: ['Every Bash, Edit, Write or Read call.'] });
  const s3 = q.cell(2, 'guard', { ...body, accent: C.script, title: 'pretool', body: ['Handed off → **deny**, with a reason naming the new chat and the `resume-here` command.', 'Otherwise allow, at once.', 'A refused tool is how a stale chat learns to stop.'] });
  const d3 = q.cell(2, 'disk', { ...body, accent: C.disk, title: 'reads the mark', body: ['Same flag, checked on every call.'] });
  q.down(y3, t3).down(t3, s3).down(s3, d3, { ...rw, label: 'read' });
  q.note(2, 'git', 'not asked');

  // ④ Reply with recap
  const y4 = q.cell(3, 'you', { ...body, accent: C.you, title: 'Read the recap', body: ['Task · Done · Next · Files · progress bar.'] });
  const t4 = q.cell(3, 'tool', { ...body, accent: TOOL, title: 'Claude writes', body: ['Every reply ends with a `HANDOFF` block: the convention in CLAUDE.md.'] });
  q.cell(3, 'guard', { ...body, accent: C.faint, titleColor: C.faint, title: 'not involved yet', body: [{ t: 'The recap is plain text in the reply. The script reads it at the Stop hook, one column to the right.', fill: C.muted }] });
  q.up(t4, y4, { color: TOOL });
  q.note(3, 'disk', 'nothing written yet');
  q.note(3, 'git', 'not asked');

  // ⑤ Stop (with a left channel for the return arrow)
  const ch = { ...body, channel: true };
  const y5 = q.cell(4, 'you', { ...ch, accent: C.you, title: 'See the status line', body: ['Bar and next step, or **HANDED OFF**.'] });
  const t5 = q.cell(4, 'tool', { ...ch, accent: TOOL, title: 'Stop, twice', body: ['Fires `stop`, then `complete-check`.'] });
  const s5 = q.cell(4, 'guard', { ...ch, accent: C.script, title: 'stop → complete-check', body: ['**stop**: saves the last `HANDOFF` block as the note; the bar comes from its Steps list. No recap? The old note stays.', '**complete-check**: a 100% claim must name docs that git shows changed, or it blocks, once.'] });
  const d5 = q.cell(4, 'disk', { ...ch, accent: C.disk, title: 'writes the note', body: ['`<session>.json`: recap, bar, next step, files, time.'] });
  const g5 = q.cell(4, 'git', { ...ch, accent: C.git, title: 'git status', body: ['Did the named docs change?'] });
  q.down(t5, s5).down(s5, d5, { ...rw, label: 'write' }).down(d5, g5, { color: C.git });
  const cx5 = q.channelX(4);
  q.raw(arrow([[cx5, s5.y + 20], [cx5, y5.bottom + 4]], { color: C.ok, dashed: true }));

  // ⑥ Long chat
  const y6 = q.cell(5, 'you', { ...ch, accent: C.you, title: 'Keep going, or hand off', body: ['A fresh chat picks the note up from its menu.'] });
  const t6 = q.cell(5, 'tool', { ...ch, accent: TOOL, title: 'PostCompact', body: ['After the context is summarised.'] });
  const s6 = q.cell(5, 'guard', { ...ch, accent: C.script, title: 'compacted · statusline', body: ['**compacted**: keeps the compaction summary on the note, so nothing is lost.', '**statusline**: paints the context gauge and this chat’s bar from the same note.'] });
  const d6 = q.cell(5, 'disk', { ...ch, accent: C.disk, title: 'updates the note', body: ['Adds the summary; the bar stays.'] });
  q.down(t6, s6).down(s6, d6, { ...rw, label: 'write' });
  const cx6 = q.channelX(5);
  q.raw(arrow([[cx6, s6.y + 20], [cx6, y6.bottom + 4]], { color: C.ok, dashed: true }));
  q.note(5, 'git', 'not asked');

  s += q.svg();

  // bottom band: install, commands, boundaries
  s += band(q.bottom + 14, 'INSTALL, COMMANDS AND WHAT IT NEVER DOES', [
    { color: C.script, titleMono: true, title: 'node install-claude.mjs, then --write', body: 'Dry run first. Copies the script to ~/.claude/, merges the hook and status line entries into settings.json, adds the recap convention to CLAUDE.md, and backs up every file it changes.' },
    { color: C.disk, titleMono: true, title: 'takeover · resume-here · list · notes', body: 'Commands you run yourself: mark a chat handed off, lift the mark, print the bars, show the menu. Notes are plain JSON under ~/.claude/handoff/, kept 72 hours, this machine only.' },
    { color: C.git, title: 'What it never does', body: 'No network, no telemetry, no dependencies. It never edits your code or reads other folders’ notes, and every mode exits 0, so a broken hook can never block Claude Code itself.' },
  ]).svg;

  s += footer(2, [
    { color: C.you, label: 'You' }, { color: TOOL, label: 'Claude Code' }, { color: C.script, label: 'handoff-guard.mjs' },
    { color: C.disk, label: 'Notes on disk' }, { color: C.git, label: 'git' }, { color: C.ok, label: 'back to you' },
  ]);
  return doc(s, { label: 'Claude Code: how one chat flows through the hand-off hooks, from session start to the next chat taking over' });
}
