#!/usr/bin/env node
// install-claude.mjs — installs handoff-guard for Claude Code. Run it from the kit folder:
//   node install-claude.mjs            dry run: says what it would change and writes nothing
//   node install-claude.mjs --write    copies the script, merges the hooks and status line into settings.json and adds
//                                      the convention to CLAUDE.md (backs up each file it changes)
//
// Everything goes under ~/.claude, the folder Claude Code reads. Re-running is safe. Our earlier entries (any hook or
// status line whose command names handoff-guard.mjs) are replaced and every other setting is kept. The convention
// sits between two marker lines in CLAUDE.md and is replaced in place; the rest of the file is left as it is. A file
// whose content would not change is not touched.
//
// If ~/.claude already runs the full hand-off system (context-guard.mjs), this refuses rather than overwrite its
// notes: the two write the same note files in different shapes, so only one can own ~/.claude/handoff.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const write = process.argv.slice(2).includes('--write');
const home = path.join(os.homedir(), '.claude');
const kit = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(home, 'handoff-guard.mjs');
const settingsFile = path.join(home, 'settings.json');
const rulesFile = path.join(home, 'CLAUDE.md');
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const ours = (h) => /handoff-guard\.mjs/.test(h?.command || '');
const fail = (msg) => { console.log(`${msg}\nNothing was written.`); process.exit(1); };
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

// The full hand-off system (context-guard.mjs, with its own hooks in settings.json) writes the same note files in a
// different shape, so the two cannot share ~/.claude. If it is already here, refuse — there is no override flag.
if (fs.existsSync(path.join(home, 'context-guard.mjs')) || /context-guard\.mjs/.test(read(settingsFile) || ''))
  fail('~/.claude already runs the full hand-off system (context-guard.mjs). This starter kit writes the same note files, so it will not install beside it.');

// The template, with ~/.claude/handoff-guard.mjs replaced by the quoted absolute path (forward slashes work in
// every shell, and the quotes keep a home folder with a space in its name in one piece).
const scriptArg = `"${script.replace(/\\/g, '/')}"`;
const fill = (h) => { h.command = h.command.replace('~/.claude/handoff-guard.mjs', scriptArg); };
const template = JSON.parse(read(path.join(kit, 'settings.fragment.json')));
fill(template.statusLine);
for (const groups of Object.values(template.hooks)) for (const g of groups) g.hooks.forEach(fill);

// settings.json: drop our old entries, keep everything else, then add ours at the end of each event's list.
const settingsText = read(settingsFile);
const current = settingsText === null ? {} : (() => { try { return JSON.parse(settingsText); } catch { return undefined; } })();
if (!current || typeof current !== 'object' || Array.isArray(current)) fail(`${settingsFile} is not a JSON object. Fix or move it, then run this again.`);
if (current.hooks !== undefined && (typeof current.hooks !== 'object' || Array.isArray(current.hooks))) fail(`"hooks" in ${settingsFile} is not an object. Fix it by hand, then run this again.`);

const merged = { ...current, hooks: { ...(current.hooks || {}) } };
let kept = 0;
for (const [event, groups] of Object.entries(merged.hooks)) {
  if (!Array.isArray(groups)) fail(`hooks.${event} in ${settingsFile} is not a list. Fix it by hand, then run this again.`);
  merged.hooks[event] = groups.map((g) => ({ ...g, hooks: (Array.isArray(g?.hooks) ? g.hooks : []).filter((h) => !ours(h)) })).filter((g) => g.hooks.length);
  kept += merged.hooks[event].reduce((n, g) => n + g.hooks.length, 0);
}
for (const [event, groups] of Object.entries(template.hooks)) merged.hooks[event] = [...(merged.hooks[event] || []), ...groups];
for (const event of Object.keys(merged.hooks)) if (!merged.hooks[event].length) delete merged.hooks[event];

// The status line: ours goes in only where there is none, or where the one there is ours.
const status = current.statusLine;
const keepYours = status !== undefined && !ours(status);
if (status === undefined || ours(status)) merged.statusLine = template.statusLine;
const statusAction = keepYours ? 'kept yours (see Next)' : status === undefined ? 'add ours' : 'ours';

const settingsSame = settingsText !== null && JSON.stringify(current) === JSON.stringify(merged);
const settingsBackup = `${settingsFile}.bak-${stamp}`;
const settingsAction = settingsText === null ? 'create' : settingsSame ? 'up to date' : `merge (backup first to ${path.basename(settingsBackup)})`;

// CLAUDE.md: the convention between two marker lines, replaced in place on a re-run. A convention pasted in by
// hand (no markers) is left alone rather than added a second time.
const MARKED = /<!-- handoff-guard: begin[^\n]*-->[\s\S]*?<!-- handoff-guard: end -->/;
const HAND_PASTED = '# Reply recap (read by the handoff hooks)';
const rulesText = read(rulesFile);
const eol = rulesText?.includes('\r\n') ? '\r\n' : '\n';
const snippet = read(path.join(kit, 'CLAUDE.snippet.md')).replace(/\r\n/g, '\n').trimEnd();
const block = ['<!-- handoff-guard: begin (written by install-claude.mjs; edit CLAUDE.snippet.md and re-run it instead) -->', snippet, '<!-- handoff-guard: end -->'].join('\n').replace(/\n/g, eol);
let rulesNext = null;
if (rulesText === null || !rulesText.trim()) rulesNext = `${block}${eol}`;
else if (MARKED.test(rulesText)) rulesNext = rulesText.replace(MARKED, () => block);
else if (!rulesText.includes(HAND_PASTED)) rulesNext = `${rulesText.trimEnd()}${eol}${eol}${block}${eol}`;
const rulesBackup = `${rulesFile}.bak-${stamp}`;
const rulesAction = rulesNext === null ? 'has the convention pasted in by hand: left alone (delete it and run this again to let the installer keep it up to date)'
  : rulesText === null ? 'create'
  : rulesNext === rulesText ? 'up to date'
  : `${MARKED.test(rulesText) ? 'update the convention' : 'add the convention'} (backup first to ${path.basename(rulesBackup)})`;

const scriptSource = read(path.join(kit, 'handoff-guard.mjs'));
const scriptNow = read(script);
const scriptAction = scriptNow === null ? 'copy (new)' : scriptNow === scriptSource ? 'up to date' : 'update (changed)';

console.log(`Claude Code home: ${home}`);
console.log(`  script   ${script}: ${scriptAction}`);
console.log(`  settings ${settingsFile}: ${settingsAction}`);
console.log(`           ours: ${Object.keys(template.hooks).join(', ')}; other hooks kept: ${kept}`);
console.log(`  status   ${statusAction}`);
console.log(`  rules    ${rulesFile}: ${rulesAction}`);
if (current.disableAllHooks === true) console.log('  WARNING settings.json has "disableAllHooks": true, so no hook runs. Remove it or set it to false.');
if (/handoff-guard\.mjs/.test(read(path.join(home, 'settings.local.json')) || '')) {
  console.log('  WARNING settings.local.json also names handoff-guard.mjs. Remove those entries, or each hook runs twice.');
}

if (!write) {
  console.log('\nDry run: nothing was written. Run again with --write to apply.');
  process.exit(0);
}
const put = (file, text) => {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
};
fs.mkdirSync(home, { recursive: true });
if (scriptAction !== 'up to date') fs.writeFileSync(script, scriptSource);
if (!settingsSame) {
  if (settingsText !== null) fs.writeFileSync(settingsBackup, settingsText);
  put(settingsFile, `${JSON.stringify(merged, null, 2)}\n`);
}
if (rulesNext !== null && rulesNext !== rulesText) {
  if (rulesText !== null) fs.writeFileSync(rulesBackup, rulesText);
  put(rulesFile, rulesNext);
}
console.log(`
Done. Next:
  1. Restart Claude Code: hooks are read when a session starts. In a new chat, run /hooks and check that the
     handoff-guard entries are listed.${keepYours ? `
  2. Your own status line was kept. To show this kit's gauge instead, set "statusLine" in settings.json to:
       ${JSON.stringify(template.statusLine)}` : ''}
  ${keepYours ? 3 : 2}. Try it: section 4, step 4 of BUILD-YOUR-OWN-CHAT-HANDOFF.md.`);
