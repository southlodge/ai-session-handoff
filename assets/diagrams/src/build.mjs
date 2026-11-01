// build.mjs — renders every NN-*.mjs diagram module in this folder to ../<name>.svg (or the folder given as argv[2]).
// Usage: node build.mjs [outDir] [prefix]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(here, '..');
const only = process.argv[3];
fs.mkdirSync(outDir, { recursive: true });
const files = fs.readdirSync(here).filter((f) => /^\d\d-.*\.mjs$/.test(f) && (!only || f.startsWith(only))).sort();
let bad = 0;
for (const f of files) {
  const mod = await import(pathToFileURL(path.join(here, f)).href + '?t=' + Date.now());
  const svg = mod.render();
  const problems = [];
  for (const tag of ['text', 'g', 'svg', 'tspan', 'defs', 'marker', 'filter']) {
    const open = (svg.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
    const close = (svg.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (open !== close) problems.push(`${tag}: ${open} open / ${close} close`);
  }
  if (/__[A-Z_]+__/.test(svg)) problems.push('placeholder left in output');
  if (/<script|<style|<foreignObject/.test(svg)) problems.push('forbidden element');
  const out = path.join(outDir, f.replace(/\.mjs$/, '.svg'));
  fs.writeFileSync(out, svg);
  console.log(`${problems.length ? 'PROBLEM' : 'OK'} ${path.basename(out)} ${svg.length} bytes${problems.length ? ' — ' + problems.join('; ') : ''}`);
  if (problems.length) bad++;
}
process.exit(bad ? 1 : 0);
