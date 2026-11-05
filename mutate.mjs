// mutate.mjs — proves the tests can fail. Run with:  node mutate.mjs   (node mutate.mjs --list only checks the list loads + matches;
// node mutate.mjs --only "codex: resume,codex: memory" runs just the mutations whose name contains one of the comma-separated parts —
// for a quick check of newly added entries; the full run is still the proof)
// It copies the whole kit to a temporary folder and first checks that the UNMUTATED copy passes all three test files.
// If it does not, it stops: a "kill" against a copy that already fails proves nothing. Then it breaks one guard
// at a time; at least one test must fail ("KILLED"). A mutation no test notices ("SURVIVED") means a check that
// could silently stop working. When you change a file, keep each `from` string here matching its current text.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const LIST = args.includes('--list');
const ONLY = args.includes('--only') ? String(args[args.indexOf('--only') + 1] || '').split(',').map((s) => s.trim()).filter(Boolean) : null;
const kit = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--only') || path.dirname(fileURLToPath(import.meta.url));
const TESTS = ['handoff-guard.test.mjs', 'handoff-guard.codex.test.mjs', 'handoff-guard.grok.test.mjs'];
const G = 'handoff-guard.mjs';
const I = 'install-codex.mjs';
const K = 'install-grok.mjs';
const C = 'install-claude.mjs';
const mutations = [
  // [name, file, from, to]
  ['no forged-marker removal', G, ".replace(/<<<\\s*(?:BEGIN|END)[^\\n>]{0,80}HANDOFF NOTES[^\\n>]{0,80}>>>/gi, '«marker removed»')", ''],
  ['wording nudge loops', G, 'if (data.stop_hook_active) return;', ''],
  ['no git check', G, 'if (unchanged.length) {', 'if (false) {'],
  ['no scrub', G, "const text = scrub(String(data.last_assistant_message || '').trim());", "const text = String(data.last_assistant_message || '').trim();"],
  ['pretool never denies', G, 'if (!t || STOP_TOOLS.has(data.tool_name)) return;', 'return;'],
  ['no burst guard', G, 'if (burstStart(cwd)) return;', ''],
  ['typed numbers trusted', G, 'if (steps.length) {', 'if (false) {'],
  ['bar dropped on plain reply', G, '|| own.progress || null', '|| null'],
  ['whitespace edits count', G, "if (/[?A]/.test(line.slice(0, 2)) || realEdits.has(file))", 'if (true)'],
  ['bracketed none-affected trusted', G, '!/none affected/i.test(stripParen(docsStep.text))', '!/none affected/i.test(docsStep.text)'],
  ['Claude usage ignored', G, 'if (u) return', 'if (false) return'],
  ['codex: --host ignored', G, "const CODEX = HOST === 'codex';", "const CODEX = HOST === 'never';"],
  ['codex: CODEX_HOME ignored', G, "(process.env.CODEX_HOME || path.join(HOME, '.codex'))", "path.join(HOME, '.codex')"],
  ['codex: commands lose --host', G, 'const HOST_FLAG = CODEX || GROK ?', 'const HOST_FLAG = GROK ?'],
  ['codex: no compact re-attach', G, "if (source === 'compact') {", 'if (false) {'],
  ['codex: token_count ignored', G, 'if (Number.isFinite(codex?.total_tokens)) return codex.total_tokens;', ''],
  ['codex: Claude-only wording', G, "${CODEX ? 'Reply in one line", "${false ? 'Reply in one line"],
  ['installer drops other hooks', I, '.filter((h) => !ours(h))', '.filter(() => false)'],
  ['installer keeps stale entries', I, '.filter((h) => !ours(h))', '.filter(() => true)'],
  ['installer writes on a dry run', I, 'if (!write) {', 'if (false) {'],
  ['installer skips the backup', I, 'if (existingText !== null) fs.writeFileSync(backup, existingText);', ''],
  ['installer rewrites when unchanged', I, 'existingText !== null && JSON.stringify(current) === JSON.stringify(merged)', 'false'],
  ['codex hooks: a hook loses its statusMessage', 'codex-hooks.json', '"statusMessage": "Handoff: checking a 100% claim against git"', '"noStatusMessage": "Handoff: checking a 100% claim against git"'],
  ['grok: --host ignored', G, "const GROK = HOST === 'grok';", "const GROK = HOST === 'never';"],
  ['grok: GROK_HOME ignored', G, "(process.env.GROK_HOME || path.join(HOME, '.grok'))", "path.join(HOME, '.grok')"],
  ['grok: commands lose --host', G, 'const HOST_FLAG = CODEX || GROK ?', 'const HOST_FLAG = CODEX ?'],
  ['grok: camelCase input ignored', G, 'if (GROK) for (const [from, to] of Object.entries(GROK_KEYS))', 'if (false) for (const [from, to] of Object.entries(GROK_KEYS))'],
  ['grok: closing Stop counted', G, "((!data.reason || data.reason === 'end_turn') && !data.subagentType)", '(!data.subagentType)'],
  ['grok: subagent Stop counted', G, "data.reason === 'end_turn') && !data.subagentType)", "data.reason === 'end_turn'))"],
  ['grok: Claude hooks run under Grok', G, 'if (!GROK && process.env.GROK_HOOK_EVENT) process.exit(0);', ''],
  ['grok: menu printed at start', G, "if (GROK) { owe(cwd, data.session_id, 'menu'); return; }", ''],
  ['grok: menu delivered again', G, 'owed = parseJson(safeRead(mine)); fs.unlinkSync(mine);', 'owed = parseJson(safeRead(mine)); fs.renameSync(mine, p);'],
  ['grok: stale marker delivered', G, 'ageMs(owed.at) <= PENDING_MAX_AGE_MS ? owed : null', 'owed'],
  ['grok: no late-delivery wording', G, "menu(cwd, data.session_id, 'late')", 'menu(cwd, data.session_id)'],
  ['grok: notes command repeats the menu', G, "if (owed?.kind === 'menu' && !ranNotes)", "if (owed?.kind === 'menu')"],
  ['grok: notes command not seen', G, 'const ranNotes = /handoff-guard\\.mjs"?\\s+notes\\b/.test(', 'const ranNotes = /^$/.test('],
  ['grok: compaction not owed', G, "if (GROK) owe(cwd, data.session_id, 'compact');", ''],
  ['grok: resume not owed', G, "if (GROK) { owe(cwd, data.session_id, 'resumed'); return; }", ''],
  ['grok: scheduler_list denied', G, "'AskUserQuestion', 'scheduler_list', ", "'AskUserQuestion', "],
  ['grok: scheduler_delete denied', G, "'scheduler_list', 'scheduler_delete']", "'scheduler_list']"],
  ['grok: resume-here blocked', G, "['Bash', 'run_terminal_command'].includes(data.tool_name)", "['Bash'].includes(data.tool_name)"],
  ['grok: no /loop wording on deny', G, 'cancel any /loop via scheduler_delete', 'cancel the loop'],
  ['grok: oldest notes kept', G, 'while (GROK && m.context.length > GROK_TEXT_MAX && notes.length > 1)', 'while (false)'],
  ['grok: huge note not cut', G, 'if (GROK && m.context.length > GROK_TEXT_MAX) m = build(', 'if (false) m = build('],
  ['grok: token cache not written', G, 'if (GROK && ctx > 0 && data.session_id) try {', 'if (false) try {'],
  ['grok: token cache not read', G, 'GROK ? cachedContext(data.session_id) : ', 'false ? cachedContext(data.session_id) : '],
  ['grok: transcript read for the gauge', G, 'GROK ? Number(cw.context_tokens) || 0', 'GROK ? Number(cw.context_tokens) || contextFromTranscript(data.transcript_path) || 0'],
  ['grok: window size ignored', G, '(GROK && Number(cw.context_window_size)) || ', ''],
  ['grok: used_percentage ignored', G, "GROK && typeof cw.used_percentage === 'number'", 'false'],
  ['grok hooks: Claude start matcher', 'grok-hooks.json', '"matcher": "new"', '"matcher": "startup"'],
  ['grok hooks: Claude resume matcher', 'grok-hooks.json', '"matcher": "load"', '"matcher": "resume"'],
  ['grok installer writes on a dry run', K, 'if (!write) {', 'if (false) {'],
  ['grok installer skips the backup', K, 'if (t.now !== null) fs.writeFileSync(t.backup, t.now);', ''],
  ['grok installer rewrites when unchanged', K, "t.now === t.content ? 'up to date'", "false ? 'up to date'"],
  ['grok installer leaves the placeholder', K, "text.replaceAll('__HANDOFF_GUARD__', scriptArg)", 'text'],
  ['grok installer misses duplicate hooks', K, "if (f.endsWith('.json') && f !== 'handoff-guard.json'", "if (false && f.endsWith('.json')"],
  ['grok installer flags its own file', K, " && f !== 'handoff-guard.json'", ''],
  ['grok installer ignores compat off', K, " && !compatOff('hooks')", ''],
  ['grok installer prints no status line', K, '`${statusToml.split', '`${"".split'],
  ['claude installer drops other hooks', C, '.filter((h) => !ours(h))', '.filter(() => false)'],
  ['claude installer keeps stale entries', C, '.filter((h) => !ours(h))', '.filter(() => true)'],
  ['claude installer leaves ~ in commands', C, "h.command = h.command.replace('~/.claude/handoff-guard.mjs', scriptArg);", ''],
  ['claude installer writes on a dry run', C, 'if (!write) {', 'if (false) {'],
  ['claude installer parses anything', C, "if (!current || typeof current !== 'object' || Array.isArray(current)) fail(", 'if (false) fail('],
  ['claude installer skips the settings backup', C, 'if (settingsText !== null) fs.writeFileSync(settingsBackup, settingsText);', ''],
  ['claude installer rewrites unchanged settings', C, 'settingsText !== null && JSON.stringify(current) === JSON.stringify(merged)', 'false'],
  ['claude installer replaces your status line', C, 'if (status === undefined || ours(status)) merged.statusLine', 'if (true) merged.statusLine'],
  ['claude installer appends a second block', C, 'else if (MARKED.test(rulesText)) rulesNext', 'else if (false) rulesNext'],
  ['claude installer doubles a pasted convention', C, 'else if (!rulesText.includes(HAND_PASTED))', 'else if (true)'],
  ['claude installer skips the CLAUDE.md backup', C, 'if (rulesText !== null) fs.writeFileSync(rulesBackup, rulesText);', ''],
  ['claude installer ignores the full-system guard', C, "if (fs.existsSync(path.join(home, 'context-guard.mjs')) || /context-guard\\.mjs/.test(read(settingsFile) || ''))", 'if (false)'],
  // A (gap 83): the Windows status-line wiring
  ['grok installer: Windows branch off', K, "const isWindows = platform === 'win32';", 'const isWindows = false;'],
  ['grok installer: .cmd loses its CRLF', K, '@echo off\\r\\nnode "${scriptWin}"', '@echo off\\nnode "${scriptWin}"'],
  // B (gap 84): the deny reason leads with the escape hatch; the allow accepts a single- or double-quoted path
  ['grok: deny reason not command-first', G, '`${resumeCmd} — run only if the user asks', '`Stop. ${resumeCmd} — run only if the user asks'],
  ['grok: deny allow double-quote only', G, "/handoff-guard\\.mjs['\"]?\\s+resume-here/", '/handoff-guard\\.mjs"?\\s+resume-here/'],
  // C: the visible hand-off notice + the "continue here" escape hatch
  ['grok: continue-here not recognised', G, '/^\\s*continue here\\b/i.test(v)', '/^never_match$/i.test(v)'],
  ['grok: hand-off notice loses escape hatch', G, 'Carry on there, or type: continue here', 'Carry on there'],
  ['grok hooks: no UserPromptSubmit hook', 'grok-hooks.json', '"UserPromptSubmit"', '"UserPromptSubmitZ"'],
  ['grok: continue-here only under a known field', G, "Object.values(data).filter((v) => typeof v === 'string')", '[]'],
  // gaps 88 + 89 (the two-tab retest, 2026-10-30)
  ['grok: wrapped step tail ends the Steps list', G, "if (items.length && t && /^\\s/.test(line)) { items[items.length - 1] += ' ' + t; continue; }", ''],
  ['grok: hand-back notice says newer chat', G, "t?.kind === 'handback' ? 'handed back to the chat that started it' : 'handed off to a newer chat'", "'handed off to a newer chat'"],
  ['grok: continue-here does not tell the model', G, "owe(cwd, data.session_id, 'resumed');\n      return;", 'return;'],
  ['grok: the claim lock is not exclusive', G, "fs.closeSync(fs.openSync(lock, 'wx'));", "fs.closeSync(fs.openSync(lock, 'w'));"],
  ['grok: a dead call\'s claim lock never clears', G, 'if (Date.now() - fs.statSync(lock).mtimeMs > CLAIM_STALE_MS) fs.unlinkSync(lock);', 'void 0;'],
  ['grok: the claim lock is never released', G, 'try { fs.unlinkSync(lock); } catch { /* released */ }', 'void 0;'],
  ['grok: stale tool-ran marker survives a new prompt', G, 'claimTurnTool(cwd, data.session_id); // new turn', 'void 0; // new turn'],
  // D: the Grok Stop recap gate
  ['grok: stop recap gate off', G, 'if (GROK && toolRan && !data.stop_hook_active && !hasHandoff(text)) {', 'if (false) {'],
  ['grok: stop ignores whether a tool ran', G, 'const toolRan = GROK ? claimTurnTool(cwd, data.session_id) : false;', 'const toolRan = false;'],
  ['grok: stop once-guard removed', G, 'toolRan && !data.stop_hook_active && !hasHandoff(text)', 'toolRan && !hasHandoff(text)'],
  // E: hand-back on resume
  ['grok: resume hands no work back', G, "writeJson(takeoverPath(cwd, by), { by: sid, at: new Date().toISOString(), kind: 'handback' });", ''],
  // 2026-11-01 Codex live test: a reopen (resume) must keep the mark; the recap gate must neither demand a memory step nor gate a read-only task
  ['codex: resume lifts the mark', G, 'if (CODEX) { // a Codex chat reopened from history', 'if (false) { // a Codex chat reopened from history'],
  ['codex: read-only task still gated', G, 'if (changed !== null && changed.size === 0) return;', ''],
  ['codex: memory step demanded again', G, '    if (docsStep) return;', '    if (docsStep && memoryStep) return;'],
  // 2026-11-01 closing run: the main checkout is never clean (a watcher rewrites 92 tracked JSONs), so the Codex gate counts only files changed since the chat began
  ['codex: dirty-at-start files still gate', G, '    if (ignore.has(file)) continue;', ''],
  ['codex: start snapshot never written', G, 'if (CODEX) snapshotDirty(cwd, data.session_id);', ''],
  ['codex: snapshot not kept alive at turn end', G, 'if (CODEX) touchStart(cwd, data.session_id);', ''],
  ['non-ASCII paths left quoted', G, "['-c', 'core.quotePath=false', ...args]", 'args'],
  ['docs-step regex ignores a non-ASCII doc name', G, '(/[\\p{L}\\p{N}_./\\\\-]{1,256}\\.(?:md|mdx|txt)\\b/iu.test(t)', '(/[\\w./\\\\-]{1,256}\\.(?:md|mdx|txt)\\b/i.test(t)'],
  ['claim regex ignores a non-ASCII doc name', G, '.match(/[\\p{L}\\p{N}_./\\\\-]{1,256}\\.(?:md|mdx|txt)/giu)', '.match(/[\\w./\\\\-]{1,256}\\.(?:md|mdx|txt)/gi)'],
  // 2026-11-04: the snippets end the recap with the Southlodge sign-off; the parser must never save it as data
  ['sign-off mark kept in the parsed recap', G, "recapOf(text).split('\\n').map(unmark).join('\\n')", 'recapOf(text)'],
  ['sign-off strip ignores the two-space gap', G, 's.endsWith(`  ${m}`)', 's.endsWith(m)'],
  ['sign-off strip misses a CRLF line', G, 'const s = line.trimEnd();', 'const s = line;'],
  ['sign-off strip misses the emoji form', G, '[SIGN_OFF, SIGN_OFF_EMOJI].find(', '[SIGN_OFF].find('],
];

// --list: load this file and check that every `from` matches its file exactly once, without running the tests.
// The kit's own test suite runs it (handoff-guard.test.mjs), so a list that cannot load, or has drifted from
// the guard, fails the tests. (2026-10-31: a from-string with an unescaped quote shipped in #1937 and the list
// did not parse; the only "check" that had passed ran a copy of the array, never this file.)
function checkList(verbose) {
  let bad = 0;
  for (const [name, file, from] of mutations) {
    const n = fs.readFileSync(path.join(kit, file), 'utf8').split(from).length - 1;
    if (n !== 1) bad++;
    if (verbose || n !== 1) console.log(`${n === 1 ? 'ok      ' : 'BAD     '} ${name} (${file}) matches=${n}`);
  }
  console.log(`${mutations.length - bad}/${mutations.length} mutations match their file exactly once`);
  return bad;
}
if (LIST) process.exit(checkList(true) ? 1 : 0);

function copyKit() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-'));
  fs.cpSync(kit, dir, { recursive: true });
  return dir;
}
// HANDOFF_KIT_MUTATION_RUN=1 tells the kit's own list-integrity test (handoff-guard.test.mjs) to skip: every copy
// below is deliberately mutated, so that test would fail in all of them and "kill" every mutant for free. The real
// list is checked once, here, before the baseline instead.
const passes = (dir) => spawnSync(process.execPath, ['--test', ...TESTS.map((t) => path.join(dir, t))],
  { encoding: 'utf8', env: { ...process.env, HANDOFF_KIT_MUTATION_RUN: '1' } }).status === 0;
if (checkList(false)) { console.log('the mutation list has drifted from the kit; fix it before measuring'); process.exit(3); }

if (!passes(copyKit())) {
  console.log('BASELINE FAILED: the unmutated kit does not pass its own tests, so no result below would mean anything.');
  process.exit(2);
}
console.log('baseline  unmutated kit passes all three test files');
const selected = ONLY ? mutations.filter(([name]) => ONLY.some((part) => name.includes(part))) : mutations;
if (ONLY && selected.length === 0) { console.log(`no mutation name contains ${ONLY.map((p) => `"${p}"`).join(' or ')}`); process.exit(1); }
let survived = 0;
for (const [name, file, from, to] of selected) {
  const src = fs.readFileSync(path.join(kit, file), 'utf8');
  if (!src.includes(from)) { console.log(`MISSING   ${name} (${file})`); survived++; continue; }
  const dir = copyKit();
  fs.writeFileSync(path.join(dir, file), src.replace(from, to));
  const killed = !passes(dir);
  if (!killed) survived++;
  console.log(`${killed ? 'KILLED   ' : 'SURVIVED '} ${name}`);
}
console.log(`${selected.length - survived}/${selected.length} mutations killed${ONLY ? ` (--only ${ONLY.map((p) => `"${p}"`).join(',')}; the full run is the proof)` : ''}`);
process.exit(survived ? 1 : 0);
