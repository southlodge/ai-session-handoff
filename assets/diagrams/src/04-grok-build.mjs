// 04: Grok Build: how one chat flows through the hooks. Swim lanes: You · Grok Build · handoff-guard.mjs --host grok · Notes on disk · git.
import { C, doc, header, footer, arrow, band } from './svg-kit.mjs';
import { sequence } from './sequence.mjs';

export function render() {
  const TOOL = C.grok;
  let s = header('Grok Build: one chat, hook by hook', 'What the hooks do on Grok, run with --host grok, from start to the next chat taking over');

  const q = sequence({
    lanes: [
      { key: 'you', label: 'You', sub: 'in the terminal', color: C.you, h: 104 },
      { key: 'tool', label: 'Grok Build', sub: 'fires its hooks', color: TOOL, h: 110 },
      { key: 'guard', label: 'handoff-guard.mjs', sub: '--host grok', subMono: true, color: C.script, h: 232 },
      { key: 'disk', label: 'Notes on disk', sub: '~/.grok/handoff/', subMono: true, color: C.disk, h: 110 },
      { key: 'git', label: 'git', sub: 'the one question it asks', color: C.git, h: 104 },
    ],
    columns: [
      { title: 'Session start', sub: 'SessionStart', subMono: true },
      { title: 'First tool result', sub: 'PostToolUse', subMono: true },
      { title: 'You send a prompt', sub: 'UserPromptSubmit', subMono: true },
      { title: 'Grok calls a tool', sub: 'PreToolUse', subMono: true },
      { title: 'Turn ends', sub: 'Stop' },
      { title: 'Status line and compaction', sub: 'statusline · PostCompact' },
    ],
  });

  const body = { size: 13.5, shadow: true, align: 'top', offset: 8 };
  const rw = { color: C.disk, labelSize: 11.5 };

  // ① Session start
  const y1 = q.cell(0, 'you', { ...body, accent: C.you, title: 'Open a chat', body: ['Start a chat in the project folder, or resume one.'] });
  const t1 = q.cell(0, 'tool', { ...body, accent: TOOL, title: 'SessionStart', body: ['Runs the hook before you type.'] });
  const s1 = q.cell(0, 'guard', { ...body, accent: C.script, title: 'session-start', body: ['Grok shows no start text, so the recent-notes **menu** is owed.', 'A marker is left for the first tool result. Once per burst of starts.'] });
  const d1 = q.cell(0, 'disk', { ...body, accent: C.disk, title: 'owes the menu', body: ['`_pending/` holds the text to deliver later.'] });
  q.down(y1, t1).down(t1, s1).down(s1, d1, { ...rw, label: 'write' });
  q.note(0, 'git', 'not asked');

  // ② First tool result (menu goes back to Grok)
  const ch2 = { ...body, channel: true };
  q.note(1, 'you', 'the menu is for Grok');
  const t2 = q.cell(1, 'tool', { ...ch2, accent: TOOL, title: 'PostToolUse', body: ['Fires after the first tool call, pass **or** fail.'] });
  const s2 = q.cell(1, 'guard', { ...ch2, accent: C.script, title: 'posttool', body: ['Delivers the owed menu once, inside the data envelope.', 'A failed or concurrent first call still gets it once.', 'Owed notes over two hours old are dropped.'] });
  const d2 = q.cell(1, 'disk', { ...ch2, accent: C.disk, title: 'reads the marker', body: ['`_pending/`, claimed by rename so one call wins.'] });
  q.down(t2, s2).down(s2, d2, { ...rw, label: 'read' });
  q.note(1, 'git', 'not asked');
  const cx2 = q.channelX(1);
  q.raw(arrow([[cx2, s2.y + 20], [cx2, t2.bottom + 4]], { color: C.ok, dashed: true }));

  // ③ You send a prompt
  const y3 = q.cell(2, 'you', { ...body, accent: C.you, title: 'Type a prompt', body: ['“carry on with …”, or a new task.'] });
  const t3 = q.cell(2, 'tool', { ...body, accent: TOOL, title: 'UserPromptSubmit', body: ['Passes the typed prompt.'] });
  const s3 = q.cell(2, 'guard', { ...body, accent: C.script, title: 'prompt', body: ['**Handed off?** Blocked with a visible notice until you type `continue here`.', 'Every typed prompt also drops a stale **tool-ran** marker from an interrupted turn.'] });
  const d3 = q.cell(2, 'disk', { ...body, accent: C.disk, title: 'reads the mark', body: ['Takeover mark checked; a stale `_toolran` is dropped.'] });
  q.down(y3, t3).down(t3, s3).down(s3, d3, { ...rw, label: 'read' });
  q.note(2, 'git', 'not asked');

  // ④ Grok calls a tool (deny when handed off)
  const y4 = q.cell(3, 'you', { ...body, accent: C.you, title: 'Watch it work', body: ['Nothing to do unless a tool is denied.'] });
  const t4 = q.cell(3, 'tool', { ...body, accent: TOOL, title: 'PreToolUse', body: ['Every tool call, before it runs.'] });
  const s4 = q.cell(3, 'guard', { ...body, accent: C.script, title: 'pretool', body: ['Handed off → **deny**. The reason leads with the `resume-here` command and fits 300 characters.', 'Stop-work tools and `resume-here` pass.'] });
  const d4 = q.cell(3, 'disk', { ...body, accent: C.disk, title: 'reads the mark', body: ['The takeover mark, on every tool call.'] });
  q.down(y4, t4).down(t4, s4).down(s4, d4, { ...rw, label: 'read' });
  q.note(3, 'git', 'not asked');

  // ⑤ Turn ends (Stop); send-back goes to Grok
  const ch5 = { ...body, channel: true };
  const y5 = q.cell(4, 'you', { ...ch5, accent: C.you, title: 'Read the recap', body: ['Task, Done, Next, Files, bar.'] });
  const t5 = q.cell(4, 'tool', { ...ch5, accent: TOOL, title: 'Stop', body: ['The reply should end with a `HANDOFF` recap.'] });
  const s5 = q.cell(4, 'guard', { ...ch5, accent: C.script, title: 'stop → complete-check', body: ['**stop** saves the recap as the note. A turn that ran a tool but has no recap is sent back, once.', 'A closing or subagent Stop is ignored.', '**complete-check**: a 100% claim must name changed docs, or block.'] });
  const d5 = q.cell(4, 'disk', { ...ch5, accent: C.disk, title: 'writes the note', body: ['`<session>.json`: recap, bar, next, files.'] });
  const g5 = q.cell(4, 'git', { ...ch5, accent: C.git, title: 'git status', body: ['Did the named docs change?'] });
  q.up(t5, y5, { color: TOOL }).down(t5, s5).down(s5, d5, { ...rw, label: 'write' }).down(d5, g5, { color: C.git });
  const cx5 = q.channelX(4);
  q.raw(arrow([[cx5, s5.y + 20], [cx5, t5.bottom + 4]], { color: C.ok, dashed: true }));

  // ⑥ Status line and compaction (status line back to you)
  const ch6 = { ...body, channel: true };
  const y6 = q.cell(5, 'you', { ...ch6, accent: C.you, title: 'See the status line', body: ['Bar, context gauge, **HANDED OFF** when marked.'] });
  const t6 = q.cell(5, 'tool', { ...ch6, accent: TOOL, title: 'status line · compact', body: ['Painted live; PostCompact fires after a compaction.'] });
  const s6 = q.cell(5, 'guard', { ...ch6, accent: C.script, title: 'statusline · compacted', body: ['**statusline**: reads Grok’s context fields and caches the size.', '**compacted**: re-attaches this chat’s recap. Text to Grok is capped at 10,000 characters.'] });
  const d6 = q.cell(5, 'disk', { ...ch6, accent: C.disk, title: 'updates the note', body: ['`_ctx/` caches the size; the summary is stored.'] });
  q.down(t6, s6).down(s6, d6, { ...rw, label: 'write' });
  const cx6 = q.channelX(5);
  q.raw(arrow([[cx6, s6.y + 20], [cx6, y6.bottom + 4]], { color: C.ok, dashed: true }));
  q.note(5, 'git', 'not asked');

  s += q.svg();

  // bottom band: install, commands, boundaries
  s += band(q.bottom + 14, 'INSTALL, COMMANDS AND WHAT IT NEVER DOES', [
    { color: C.script, titleMono: true, title: 'node install-grok.mjs, then --write', body: 'Writes three files: the script, ~/.grok/hooks/handoff-guard.json and ~/.grok/rules/chat-handoff.md. config.toml is never touched. On Windows a .cmd wrapper carries the status-line command.' },
    { color: C.disk, titleMono: true, title: 'takeover · resume-here · notes · list', body: 'Commands you run: take a chat over, lift the mark, show the menu, print the bars. A handed-off chat still allows scheduler_delete and resume-here. Notes live under ~/.grok/handoff/, 72 hours, this machine only.' },
    { color: C.git, title: 'What it never does', body: 'No network, no telemetry, no dependencies. It never edits config.toml or your code, and every mode exits 0. Claude Code hooks that Grok runs through its compatibility layer do nothing.' },
  ]).svg;

  s += footer(4, [
    { color: C.you, label: 'You' }, { color: TOOL, label: 'Grok Build' }, { color: C.script, label: 'handoff-guard.mjs' },
    { color: C.disk, label: 'Notes on disk' }, { color: C.git, label: 'git' }, { color: C.ok, label: 'back to Grok' },
  ]);
  return doc(s, { label: 'Grok Build: how one chat flows through the hand-off hooks, from session start to the next chat taking over' });
}
