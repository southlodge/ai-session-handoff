// 03: Codex CLI: the same hooks, run with --host codex. Swim lanes: You · Codex CLI · handoff-guard.mjs · Notes on disk · git.
import { C, doc, header, footer, arrow, band } from './svg-kit.mjs';
import { sequence } from './sequence.mjs';

export function render() {
  const TOOL = C.codex;
  let s = header('Codex CLI: one chat, hook by hook', 'What the hooks do on Codex, run with --host codex, from start to the next chat taking over');

  const q = sequence({
    lanes: [
      { key: 'you', label: 'You', sub: 'in the terminal', color: C.you, h: 104 },
      { key: 'tool', label: 'Codex CLI', sub: 'fires its hooks', color: TOOL, h: 110 },
      { key: 'guard', label: 'handoff-guard.mjs', sub: '--host codex', subMono: true, color: C.script, h: 232 },
      { key: 'disk', label: 'Notes on disk', sub: '~/.codex/handoff/', subMono: true, color: C.disk, h: 110 },
      { key: 'git', label: 'git', sub: 'what git says changed', color: C.git, h: 104 },
    ],
    columns: [
      { title: 'Session start', sub: 'SessionStart', subMono: true },
      { title: 'You send a prompt', sub: 'UserPromptSubmit', subMono: true },
      { title: 'Codex calls a tool', sub: 'PreToolUse', subMono: true },
      { title: 'Codex replies', sub: 'the reply ends with HANDOFF' },
      { title: 'Turn ends', sub: 'Stop, two hooks' },
      { title: 'Compaction and list', sub: 'compact matcher · list' },
    ],
  });

  const body = { size: 13.5, shadow: true, align: 'top', offset: 8 };
  const rw = { color: C.disk, labelSize: 11.5 };

  // ① Session start (menu returns to Codex; git snapshot taken)
  const y1 = q.cell(0, 'you', { ...body, channel: true, accent: C.you, title: 'Open or resume', body: ['`codex` in the project folder, or resume a chat.'] });
  const t1 = q.cell(0, 'tool', { ...body, channel: true, accent: TOOL, title: 'SessionStart', body: ['Fires on startup, resume, clear or compact.'] });
  const s1 = q.cell(0, 'guard', { ...body, channel: true, accent: C.script, title: 'session-start', body: ['On startup or clear, prints the recent-notes **menu**, the same DATA fences as Claude.', 'Records the files git already shows changed: the `_start` baseline.'] });
  const d1 = q.cell(0, 'disk', { ...body, channel: true, accent: C.disk, title: 'notes · snapshot', body: ['Notes under 72 h. Writes the `_start` baseline.'] });
  const g1 = q.cell(0, 'git', { ...body, channel: true, accent: C.git, title: 'git status', body: ['Which files were already changed.'] });
  q.down(y1, t1).down(t1, s1).down(s1, d1, { ...rw, label: 'read' }).down(d1, g1, { color: C.git });
  const cx1 = q.channelX(0);
  q.raw(arrow([[cx1, s1.y + 20], [cx1, t1.bottom + 4]], { color: C.ok, dashed: true }));

  // ② Prompt
  const y2 = q.cell(1, 'you', { ...body, accent: C.you, title: 'Type a prompt', body: ['“carry on with the login rate limit”'] });
  const t2 = q.cell(1, 'tool', { ...body, accent: TOOL, title: 'UserPromptSubmit', body: ['Passes your prompt and the transcript path.'] });
  const s2 = q.cell(1, 'guard', { ...body, accent: C.script, title: 'prompt', body: ['**Handed off?** It tells Codex to answer in one line and stop, naming the chat that took over.', 'Past 200k tokens it nudges: start a new chat soon.', 'Below that, nothing: plain text would be injected.'] });
  const d2 = q.cell(1, 'disk', { ...body, accent: C.disk, title: 'reads the mark', body: ['The `handed-off` flag on this chat’s note.'] });
  q.down(y2, t2).down(t2, s2).down(s2, d2, { ...rw, label: 'read' });
  q.note(1, 'git', 'not asked');

  // ③ Tool call
  const y3 = q.cell(2, 'you', { ...body, accent: C.you, title: 'Watch it work', body: ['Nothing to do unless a tool is denied.'] });
  const t3 = q.cell(2, 'tool', { ...body, accent: TOOL, title: 'PreToolUse', body: ['Before every tool call.'] });
  const s3 = q.cell(2, 'guard', { ...body, accent: C.script, title: 'pretool', body: ['Handed off → **deny**, naming the chat that took over and the `resume-here` command.', 'Otherwise it allows at once.', 'The tools that stop work still run.'] });
  const d3 = q.cell(2, 'disk', { ...body, accent: C.disk, title: 'reads the mark', body: ['Checked on every tool call.'] });
  q.down(y3, t3).down(t3, s3).down(s3, d3, { ...rw, label: 'read' });
  q.note(2, 'git', 'not asked');

  // ④ Reply with recap
  const y4 = q.cell(3, 'you', { ...body, accent: C.you, title: 'Read the recap', body: ['Task · Done · Next · Files · progress bar.'] });
  const t4 = q.cell(3, 'tool', { ...body, accent: TOOL, title: 'Codex writes', body: ['Every reply ends with a `HANDOFF` recap: the AGENTS.md rule.'] });
  q.cell(3, 'guard', { ...body, accent: C.faint, titleColor: C.faint, title: 'not involved yet', body: [{ t: 'The recap is plain text. The script reads it at Stop, one column to the right.', fill: C.muted }, { t: 'Every reply the hooks print uses only keys Codex accepts.', fill: C.muted }] });
  q.up(t4, y4, { color: TOOL });
  q.note(3, 'disk', 'nothing written yet');
  q.note(3, 'git', 'not asked');

  // ⑤ Stop (two hooks; complete-check returns to Codex)
  const ch = { ...body, channel: true };
  const y5 = q.cell(4, 'you', { ...ch, accent: C.you, title: 'Nothing to see', body: ['Codex has no status line, so Stop shows you nothing.'] });
  const t5 = q.cell(4, 'tool', { ...ch, accent: TOOL, title: 'Stop, two hooks', body: ['Fires `stop`, then `complete-check`.'] });
  const s5 = q.cell(4, 'guard', { ...ch, accent: C.script, title: 'stop · complete-check', body: ['**stop** saves the last `HANDOFF` block. No recap, the old note stays.', '**complete-check** gates a 100% claim: changed files need a docs step, never a memory one.'] });
  const d5 = q.cell(4, 'disk', { ...ch, accent: C.disk, title: 'writes the note', body: ['The note: recap, bar, next step, files.'] });
  const g5 = q.cell(4, 'git', { ...ch, accent: C.git, title: 'git status', body: ['What changed since the `_start` baseline?'] });
  q.down(t5, s5).down(s5, d5, { ...rw, label: 'write' }).down(d5, g5, { color: C.git });
  const cx5 = q.channelX(4);
  q.raw(arrow([[cx5, s5.y + 20], [cx5, t5.bottom + 4]], { color: C.ok, dashed: true }));

  // ⑥ Compaction and list
  const y6 = q.cell(5, 'you', { ...ch, accent: C.you, title: 'Run `list` yourself', body: ['No status line. You run `list` to print the bars.'] });
  const t6 = q.cell(5, 'tool', { ...ch, accent: TOOL, title: 'SessionStart compact', body: ['No PostCompact hook: the compact matcher does it.'] });
  const s6 = q.cell(5, 'guard', { ...ch, accent: C.script, title: 'compacted recap', body: ['On the `compact` source it re-attaches this chat’s own last **recap**, as data for orientation.', 'Nothing from the summary is lost.'] });
  const d6 = q.cell(5, 'disk', { ...ch, accent: C.disk, title: 'reads the note', body: ['This chat’s own saved recap.'] });
  q.down(t6, s6).down(s6, d6, { ...rw, label: 'read' });
  const cx6 = q.channelX(5);
  q.raw(arrow([[cx6, s6.y + 20], [cx6, t6.bottom + 4]], { color: C.ok, dashed: true }));
  q.note(5, 'git', 'not asked');

  s += q.svg();

  // bottom band: install, commands, boundaries
  s += band(q.bottom + 14, 'INSTALL, COMMANDS AND WHAT IT NEVER DOES', [
    { color: C.script, titleMono: true, title: 'node install-codex.mjs, then --write', body: 'Dry run first. It copies the script to ~/.codex/, merges codex-hooks.json into hooks.json (each hook carries a “Handoff: …” statusMessage), and backs up what it changes. Paste AGENTS.snippet.md into ~/.codex/AGENTS.md.' },
    { color: C.disk, titleMono: true, title: 'takeover · resume-here · list · notes', body: 'Commands you run yourself: mark a chat handed off, lift the mark, print the bars, show the menu. list is your view, as Codex has no status line. Notes are plain JSON under ~/.codex/handoff/, kept 72 hours, this machine only. CODEX_HOME moves the store.' },
    { color: C.git, title: 'What it never does', body: 'No network, no telemetry, no dependencies. It never edits your code or reads other folders’ notes, and every mode exits 0, so a broken hook can never block Codex itself.' },
  ]).svg;

  s += footer(3, [
    { color: C.you, label: 'You' }, { color: TOOL, label: 'Codex CLI' }, { color: C.script, label: 'handoff-guard.mjs' },
    { color: C.disk, label: 'Notes on disk' }, { color: C.git, label: 'git' }, { color: C.ok, label: 'back to Codex' },
  ]);
  return doc(s, { label: 'Codex CLI: how one chat flows through the hand-off hooks run with --host codex, from session start to the next chat taking over' });
}
