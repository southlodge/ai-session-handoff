#!/usr/bin/env node
// install-codex.mjs — installs handoff-guard for OpenAI Codex. Run it from the kit folder:
//   node install-codex.mjs            dry run: says what it would change and writes nothing
//   node install-codex.mjs --write    copies the script and merges the hooks (backs up hooks.json first)
// Option: --codex-home <dir>          default: $CODEX_HOME, else ~/.codex
//
// Re-running is safe. Our earlier entries (any hook whose command names handoff-guard.mjs) are replaced, every
// other hook is kept, and a file whose content would not change is not touched.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const write = args.includes('--write');
const at = args.indexOf('--codex-home');
const home = path.resolve(at >= 0 && args[at + 1] ? args[at + 1] : process.env.CODEX_HOME || path.join(os.homedir(), '.codex'));
const kit = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(home, 'handoff-guard.mjs');
const hooksFile = path.join(home, 'hooks.json');
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const ours = (h) => /handoff-guard\.mjs/.test(`${h?.command || ''} ${h?.commandWindows || ''}`);
const fail = (msg) => { console.log(`${msg}\nNothing was written.`); process.exit(1); };

// The template, with the placeholder replaced by the absolute path (forward slashes work in every shell).
const template = JSON.parse(read(path.join(kit, 'codex-hooks.json')));
for (const groups of Object.values(template.hooks)) {
  for (const g of groups) for (const h of g.hooks) h.command = h.command.replace('__HANDOFF_GUARD__', script.replace(/\\/g, '/'));
}

const existingText = read(hooksFile);
const current = existingText === null ? {} : (() => { try { return JSON.parse(existingText); } catch { return undefined; } })();
if (!current || typeof current !== 'object' || Array.isArray(current)) fail(`${hooksFile} is not a JSON object. Fix or move it, then run this again.`);
if (current.hooks !== undefined && (typeof current.hooks !== 'object' || Array.isArray(current.hooks))) fail(`"hooks" in ${hooksFile} is not an object. Fix it by hand, then run this again.`);

const merged = { ...(existingText === null ? { description: template.description } : {}), ...current, hooks: { ...(current.hooks || {}) } };
let kept = 0;
for (const [event, groups] of Object.entries(merged.hooks)) {
  if (!Array.isArray(groups)) fail(`hooks.${event} in ${hooksFile} is not a list. Fix it by hand, then run this again.`);
  merged.hooks[event] = groups.map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !ours(h)) })).filter((g) => g.hooks.length);
  kept += merged.hooks[event].reduce((n, g) => n + g.hooks.length, 0);
}
for (const [event, groups] of Object.entries(template.hooks)) merged.hooks[event] = [...(merged.hooks[event] || []), ...groups];
for (const event of Object.keys(merged.hooks)) if (!merged.hooks[event].length) delete merged.hooks[event];

const scriptSource = read(path.join(kit, 'handoff-guard.mjs'));
const scriptNow = read(script);
const scriptAction = scriptNow === null ? 'copy (new)' : scriptNow === scriptSource ? 'up to date' : 'update (changed)';
const hooksSame = existingText !== null && JSON.stringify(current) === JSON.stringify(merged);
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const backup = `${hooksFile}.bak-${stamp}`;
const hooksAction = existingText === null ? 'create' : hooksSame ? 'up to date' : `merge (backup first to ${path.basename(backup)})`;

console.log(`Codex home: ${home}`);
console.log(`  script  ${script}: ${scriptAction}`);
console.log(`  hooks   ${hooksFile}: ${hooksAction}`);
console.log(`          ours: ${Object.keys(template.hooks).join(', ')}; other hooks kept: ${kept}`);
const config = read(path.join(home, 'config.toml')) || '';
if (/^\s*(?:codex_)?hooks\s*=\s*false\b/m.test(config)) console.log('  WARNING config.toml switches hooks off ([features] hooks = false). Remove that line or nothing will run.');
if (/handoff-guard\.mjs/.test(config)) console.log('  WARNING config.toml also names handoff-guard.mjs in an inline [hooks] table. Remove those entries, or each hook runs twice.');

if (!write) {
  console.log('\nDry run: nothing was written. Run again with --write to apply.');
  process.exit(0);
}
fs.mkdirSync(home, { recursive: true });
if (scriptAction !== 'up to date') fs.writeFileSync(script, scriptSource);
if (!hooksSame) {
  if (existingText !== null) fs.writeFileSync(backup, existingText);
  const tmp = `${hooksFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(merged, null, 2)}\n`);
  fs.renameSync(tmp, hooksFile);
}
console.log(`
Done. Next:
  1. Start Codex and run /hooks. Review and trust the handoff-guard hooks: Codex skips a new or changed hook
     until you trust it.
  2. Paste AGENTS.snippet.md into ${path.join(home, 'AGENTS.md')} (your instructions for every project).
  3. Optional: so the model's takeover command needs no approval in the workspace-write sandbox, add
     "${path.join(home, 'handoff').replace(/\\/g, '/')}" to writable_roots under [sandbox_workspace_write] in config.toml.`);
