// check-cites.mjs [prefix] : prints every line a diagram module's header cites, so each citation can be read against
// its claim. The modules are the NN-*.mjs files beside this one; the kit is three folders up. STRICT reading: a
// bare :N is always handoff-guard.mjs; a file name applies only to the token it is written in. Also checks every
// test "..." name is a substring of one of the kit's test files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const srcDir = path.dirname(fileURLToPath(import.meta.url));
const kitDir = path.resolve(srcDir, '../../..');
const [only] = process.argv.slice(2);
const cache = {};
const lines = (f) => (cache[f] ??= fs.existsSync(path.join(kitDir, f)) ? fs.readFileSync(path.join(kitDir, f), 'utf8').split(/\r?\n/) : null);
const tests = ['handoff-guard.test.mjs', 'handoff-guard.codex.test.mjs', 'handoff-guard.grok.test.mjs']
  .map((f) => (lines(f) ?? []).join('\n')).join('\n');
const show = (s) => s.trim().replace(/\s+/g, ' ').slice(0, 104);
let bad = 0;
const mods = fs.readdirSync(srcDir).filter((f) => /^\d\d-.*\.mjs$/.test(f) && (!only || f.startsWith(only))).sort();
for (const m of mods) {
  const src = fs.readFileSync(path.join(srcDir, m), 'utf8').split(/\r?\n/);
  const head = [];
  for (const l of src) { if (!l.startsWith('//')) break; head.push(l); }
  console.log(`\n===== ${m} (${head.length} header lines)`);
  for (const h of head) {
    const cites = [...h.matchAll(/([\w./-]+\.(?:mjs|md|json|yml))?:(\d+)(?:-(\d+))?/g)];
    const names = [...h.matchAll(/test "([^"]+)"/g)].map((x) => x[1]);
    if (!cites.length && !names.length) continue;
    console.log(`# ${show(h.replace(/^\/\/\s*/, ''))}`);
    for (const c of cites) {
      const file = c[1] ?? 'handoff-guard.mjs';
      const a = +c[2], b = c[3] ? +c[3] : a;
      const L = lines(file);
      if (!L) { console.log(`   !! ${file}: file not found`); bad++; continue; }
      if (b < a || b > L.length) { console.log(`   !! ${file}:${a}-${b} out of range (${L.length} lines)`); bad++; continue; }
      console.log(`   ${file === 'handoff-guard.mjs' ? '' : file}:${a}  ${show(L[a - 1])}`);
      if (b > a) console.log(`   ${file === 'handoff-guard.mjs' ? '' : file}:${b}  ${show(L[b - 1])}`);
    }
    for (const n of names) {
      const ok = tests.includes(n);
      console.log(`   ${ok ? 'test ok' : '!! TEST NOT FOUND'}: "${n}"`);
      if (!ok) bad++;
    }
  }
}
console.log(`\n${bad} hard problem(s) (missing file, out-of-range line, unknown test name)`);
process.exit(bad ? 1 : 0);
