#!/usr/bin/env node
// install-grok.mjs — installs handoff-guard for xAI Grok Build. Run it from the kit folder:
//   node install-grok.mjs            dry run: says what it would change and writes nothing
//   node install-grok.mjs --write    copies the script, the hooks file and the rules file (backs up any it changes)
// Option: --grok-home <dir>         default: $GROK_HOME, else ~/.grok
//
// It writes three files of its own and edits nothing else. config.toml is never touched: the status line it needs
// is printed for you to paste. Re-running is safe; a file whose content would not change is not touched.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const write = args.includes('--write');
// A (gap 83): the status line is wired differently on Windows (see the .cmd wrapper below). Platform is injectable
// via HANDOFF_GUARD_PLATFORM so the tests cover both branches from one OS; it defaults to the real platform.
const platform = process.env.HANDOFF_GUARD_PLATFORM || process.platform;
const isWindows = platform === 'win32';
const at = args.indexOf('--grok-home');
const home = path.resolve(at >= 0 && args[at + 1] ? args[at + 1] : process.env.GROK_HOME || path.join(os.homedir(), '.grok'));
const kit = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const script = path.join(home, 'handoff-guard.mjs');
const scriptArg = script.replace(/\\/g, '/'); // forward slashes work in every shell
const fill = (text) => text.replaceAll('__HANDOFF_GUARD__', scriptArg);

// Our three files, each written whole: Grok loads every *.json in hooks/ and every *.md in rules/, so ours sit
// beside the user's own files instead of being merged into them.
const targets = [
  { label: 'script', file: script, content: read(path.join(kit, 'handoff-guard.mjs')) },
  { label: 'hooks', file: path.join(home, 'hooks', 'handoff-guard.json'), content: `${JSON.stringify(JSON.parse(fill(read(path.join(kit, 'grok-hooks.json')))), null, 2)}\n` },
  { label: 'rules', file: path.join(home, 'rules', 'chat-handoff.md'), content: fill(read(path.join(kit, 'GROK.snippet.md'))) },
];
// A (gap 83): on Windows a config.toml status command cannot carry the inner double quotes `node "<path>" …` needs,
// so the command there is a bare path to this .cmd wrapper (no inner quotes — see statusCommand). The wrapper holds
// the quoted node invocation and CRLF line endings. The guard path inside it is backslashed, as Windows expects.
const statusCmdFile = path.join(home, 'handoff-statusline.cmd');
const scriptWin = script.replace(/\//g, '\\');
if (isWindows) targets.push({ label: 'cmd', file: statusCmdFile, content: `@echo off\r\nnode "${scriptWin}" statusline --host grok\r\n` });
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
for (const t of targets) {
  t.now = read(t.file);
  t.backup = `${t.file}.bak-${stamp}`; // does not end in .json / .md, so Grok does not load it
  t.action = t.now === null ? 'create' : t.now === t.content ? 'up to date' : `update (backup first to ${path.basename(t.backup)})`;
}

console.log(`Grok home: ${home}`);
for (const t of targets) console.log(`  ${t.label.padEnd(7)} ${t.file}: ${t.action}`);

const config = read(path.join(home, 'config.toml')) || '';
// A: on Windows the command is the bare forward-slash path to the .cmd wrapper, single-quoted with NO inner quotes;
// elsewhere it is today's quoted node invocation. Both are wrapped in the TOML single quotes below.
const statusCommand = isWindows ? statusCmdFile.replace(/\\/g, '/') : `node "${scriptArg}" statusline --host grok`;
const statusToml = `[ui.status_line]\ntype = "command"\ncommand = '${statusCommand}'`;
const hasStatus = /^\s*\[ui\.status_line\]/m.test(config);
if (hasStatus && /handoff-guard\.mjs/.test(config)) console.log('  status  config.toml already runs handoff-guard for the status line');
else if (hasStatus) console.log('  status  config.toml already has a [ui.status_line] section. To use this kit\'s, replace that section (see Next).');
else console.log('  status  not set: add it to config.toml by hand (see Next)');

const section = (name) => new RegExp(`^\\s*\\[${name.replace('.', '\\.')}\\]([^[]*)`, 'm').exec(config)?.[1] || '';
const compatOff = (cell) => new RegExp(`^\\s*${cell}\\s*=\\s*false\\b`, 'm').test(section('compat.claude'));
for (const f of fs.existsSync(path.join(home, 'hooks')) ? fs.readdirSync(path.join(home, 'hooks')) : []) {
  if (f.endsWith('.json') && f !== 'handoff-guard.json' && /handoff-guard\.mjs/.test(read(path.join(home, 'hooks', f)) || '')) {
    console.log(`  WARNING hooks/${f} also names handoff-guard.mjs. Remove those entries, or each hook runs twice.`);
  }
}
if (/^\s*\[\[hooks\./m.test(config) && /handoff-guard\.mjs/.test(config.replace(/\[ui\.status_line\][^[]*/, ''))) {
  console.log('  WARNING config.toml also names handoff-guard.mjs in a [[hooks.…]] table. Remove those entries, or each hook runs twice.');
}
const claude = path.join(os.homedir(), '.claude');
if (/handoff-guard\.mjs/.test(read(path.join(claude, 'settings.json')) || '') && !compatOff('hooks')) {
  console.log(`  NOTE    ${path.join(claude, 'settings.json')} has Claude Code handoff-guard hooks, and Grok runs those too.`
    + '\n          They do nothing under Grok (they carry no --host grok). To stop Grok loading them, add'
    + '\n          hooks = false under [compat.claude] in config.toml.');
}
if (/handoff-guard/.test(read(path.join(claude, 'CLAUDE.md')) || '') && !compatOff('agents')) {
  console.log(`  NOTE    ${path.join(claude, 'CLAUDE.md')} has Claude Code handoff instructions, and Grok reads that file too.`
    + '\n          The Grok rules file tells the model to ignore them. To stop Grok reading ~/.claude/CLAUDE.md at all,'
    + '\n          add agents = false under [compat.claude] in config.toml.');
}

if (!write) {
  console.log('\nDry run: nothing was written. Run again with --write to apply.');
  process.exit(0);
}
for (const t of targets) {
  if (t.action === 'up to date') continue;
  fs.mkdirSync(path.dirname(t.file), { recursive: true });
  if (t.now !== null) fs.writeFileSync(t.backup, t.now);
  const tmp = `${t.file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, t.content);
  fs.renameSync(tmp, t.file);
}
console.log(`
Done. Next:
  1. ${hasStatus && /handoff-guard\.mjs/.test(config) ? 'The status line is already set.' : `Add the status line to ${path.join(home, 'config.toml')}${hasStatus ? ', in place of your current [ui.status_line] section' : ''}:`}
${hasStatus && /handoff-guard\.mjs/.test(config) ? '' : `${statusToml.split('\n').map((l) => `       ${l}`).join('\n')}\n`}     It shows the gauge, and it is how the notes learn each chat's token count.
  2. Restart Grok (or press r in /hooks to reload). In the interactive app Grok holds hooks back in a folder
     you have not trusted: say yes when it asks, or run /hooks-trust once per project. Headless runs (-p)
     need no trust step.
  3. Run /hooks and check the handoff-guard entries are listed under Global.`);
