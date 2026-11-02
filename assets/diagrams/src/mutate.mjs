// mutate.mjs - proves the build's checks fail when they should. From the kit root:
//   node assets/diagrams/src/mutate.mjs assets/diagrams/src README.md <a folder that does not exist yet>
// A kit-shaped tree (README.md + assets/diagrams/src) is copied into a fresh folder per case. Each mutation makes ONE
// exact-once edit and builds; it is caught when the build exits 1 AND a PROBLEM line names the expected rule. The clean
// controls must exit 0 with no PROBLEM line. Nothing is deleted: each case keeps its own folder for inspection.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [srcDir, readme, work] = process.argv.slice(2);
if (!work) { console.error('usage: node mutate.mjs <srcDir> <README.md> <newDir>'); process.exit(2); }
if (fs.existsSync(work)) { console.error('work dir exists, pick a new one: ' + work); process.exit(2); }
const S = (f) => path.join('assets', 'diagrams', 'src', f);
const base = path.join(work, 'base');
fs.mkdirSync(path.join(base, 'assets', 'diagrams'), { recursive: true });
fs.cpSync(srcDir, path.join(base, S('')), { recursive: true });
fs.copyFileSync(readme, path.join(base, 'README.md'));

const M = [
  { name: 'lane-40', why: 'the 02 guard lane 40 px shorter', file: S('02-claude-code.mjs'),
    from: "sub: 'the default host', color: C.script, h: 190 }", to: "sub: 'the default host', color: C.script, h: 150 }", expect: ['card-outside-lane:guard'] },
  { name: 'lane-40', theme: 'dark', why: 'the same, dark theme', file: S('02-claude-code.mjs'),
    from: "sub: 'the default host', color: C.script, h: 190 }", to: "sub: 'the default host', color: C.script, h: 150 }", expect: ['card-outside-lane:guard'] },
  { name: 'readable-off', why: 'text colours no longer deepened to AA', file: S('svg-kit.mjs'),
    from: '  if (ok(fg)) return fg;', to: '  return fg;', expect: ['contrast '] },
  { name: 'six-lines', why: 'a 05 card body grows to 6 lines', file: S('05-handoff-lifecycle.mjs'),
    from: "body: ['Read on every tool call.', '`resume-here` lifts it.'] });",
    to: "body: ['Read on every tool call.', '`resume-here` lifts it.', 'One.', 'Two.', 'Three.', 'Four.'] });", expect: ['card-over-5-lines:'] },
  { name: 'font-registry', why: "the 'time' label registered at 11 px", file: S('sequence.mjs'),
    from: "registerText(right - 14, top - 57, 'time', 12.5, 'sans', 'end');", to: "registerText(right - 14, top - 57, 'time', 11, 'sans', 'end');", expect: ['font-under-12:11'] },
  { name: 'font-emitted', why: "the 'time' label drawn at 11 px (registry untouched)", file: S('sequence.mjs'),
    from: "s += text(right - 14, top - 57, 'time', { size: 12.5,", to: "s += text(right - 14, top - 57, 'time', { size: 11,", expect: ['font 11.00px'] },
  { name: 'lane-label-word', why: "03 lane 'Notes on disk' renamed 'Notes'", file: S('03-codex-cli.mjs'),
    from: "{ key: 'disk', label: 'Notes on disk',", to: "{ key: 'disk', label: 'Notes',", expect: ['consistency: lane-label[3]'] },
  { name: 'legend-same-swatch', why: '02 legend: git drawn in the disk colour', file: S('02-claude-code.mjs'),
    from: "{ color: C.git, label: 'git' }", to: "{ color: C.disk, label: 'git' }", expect: ['legend-same-swatch'] },
  { name: 'card-unmarked', why: '03 d5 loses its same flag', file: S('03-codex-cli.mjs'),
    from: "{ ...ch, ...same, rail: true, accent: C.disk, title: 'writes the note'", to: "{ ...ch, rail: true, accent: C.disk, title: 'writes the note'", expect: ['card-unmarked:disk'] },
  { name: 'same-but-differs', why: '03 d5 still marked same, body reworded', file: S('03-codex-cli.mjs'),
    from: "title: 'writes the note', body: ['`<session>.json`: recap and progress.'] });", to: "title: 'writes the note', body: ['`<session>.json`: the recap only.'] });", expect: ['card-same-but-differs:'] },
  { name: 'marked-but-same', why: '03 d5 marked differs, body unchanged', file: S('03-codex-cli.mjs'),
    from: "{ ...ch, ...same, rail: true, accent: C.disk, title: 'writes the note'", to: "{ ...ch, ...differs, rail: true, accent: C.disk, title: 'writes the note'", expect: ['card-marked-but-same:'] },
  { name: 'differs-and-same', why: '03 d5 flagged both ways', file: S('03-codex-cli.mjs'),
    from: "{ ...ch, ...same, rail: true, accent: C.disk, title: 'writes the note'", to: "{ ...ch, ...same, ...differs, rail: true, accent: C.disk, title: 'writes the note'", expect: ['card-differs-and-same:disk'] },
  { name: 'rail-removed', why: '02 d5 drops the rail the guard-to-git arrow runs in', file: S('02-claude-code.mjs'),
    from: "const d5 = q.cell(4, 'disk', { ...ch, rail: true, accent: C.disk,", to: "const d5 = q.cell(4, 'disk', { ...ch, accent: C.disk,", expect: ['arrow-through-card', 'arrow-under-card'] },
  { name: 'pill-over-card', why: "01 'hook JSON on stdin' pill moved onto the tool cards", file: S('01-overview.mjs'),
    from: "s += pill(gapCx, fanY - spread / 2, 'hook JSON on stdin',", to: "s += pill(LX + LW / 2, fanY - spread / 2, 'hook JSON on stdin',", expect: ['pill-over-card'] },
  { name: 'arrow-too-short', why: '01 git arrow cut to 18 px', file: S('01-overview.mjs'),
    from: 's += arrow([[HX + HW, git.cy], [RX - 2, git.cy]],', to: 's += arrow([[RX - 20, git.cy], [RX - 2, git.cy]],', expect: ['arrow-too-short'] },
  { name: 'label-on-short-shaft', why: 'a short arrow keeps its label on the shaft (side-move off)', file: S('svg-kit.mjs'),
    from: 'if (L - along - half < headLen + 4 || along - half < tailLen + 6) {', to: 'if (false) {', expect: ['arrow-head-crowded', 'arrow-tail-crowded'] },
  { name: 'fan-collapsed', why: "01 fan spread 0: an arrow runs under the 'hook JSON' pill", file: S('01-overview.mjs'),
    from: 'const fanY = c2.cy, spread = 72;', to: 'const fanY = c2.cy, spread = 0;', expect: ['arrow-under-pill'] },
  { name: 'readme-alt', why: 'README alt text for 01 drifts from its aria-label', file: 'README.md',
    from: 'alt="Claude Code, OpenAI Codex CLI and xAI Grok Build', to: 'alt="Claude Code, Codex CLI and xAI Grok Build', expect: ['readme: readme-alt 01-overview'] },
  { name: 'wrap-too-wide', why: 'card text wrapped 60 px wider than the card', file: S('svg-kit.mjs'),
    from: '  const innerW = w - pad * 2 - indent;', to: '  const innerW = w - pad * 2 - indent + 60;', expect: ['text-outside-card'] },
  { name: 'band-low', why: '01 band moved 124 px down', file: S('01-overview.mjs'),
    from: "s += band(contentBottom + 24, 'INSTALL, PROOF AND WHAT IT NEVER DOES',", to: "s += band(contentBottom + 148, 'INSTALL, PROOF AND WHAT IT NEVER DOES',", expect: ['below-984:band'] },
  { name: 'footer-crowded', why: 'legend placed 10 px after the credit', file: S('svg-kit.mjs'),
    from: 'let lx = o.legendX ?? Math.round((creditEnd + pageX) / 2 - total / 2);', to: 'let lx = o.legendX ?? creditEnd + 10;', expect: ['footer-crowded'] },
  { name: 'label-on-cards', why: 'lane labels registered 300 px right, over column 1', file: S('sequence.mjs'),
    from: "registerText(labelX + 16, g.cy - (l.sub ? 4 : -6), l.label, 17,", to: "registerText(labelX + 316, g.cy - (l.sub ? 4 : -6), l.label, 17,", expect: ['text-over-card'] },
  { name: 'band-limit', why: 'band blocks limited to 200 px less than their column', file: S('svg-kit.mjs'),
    from: 'const limit = { x0: bx, x1: bx + colW };', to: 'const limit = { x0: bx, x1: bx + colW - 200 };', expect: ['text-past-limit'] },
];

function build(dest, theme) {
  const args = [path.join(dest, S('build.mjs')), path.join(dest, 'out')];
  if (theme === 'dark') args.push('--theme', 'dark');
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const lines = (r.stdout + r.stderr).split('\n').map((l) => l.trimEnd());
  return { status: r.status, problems: lines.filter((l) => l.startsWith('PROBLEM ') && !l.endsWith(' bytes')) };
}

const rows = [];
let bad = 0;
for (const theme of ['light', 'dark']) {
  const dest = path.join(work, '00-control-' + theme);
  fs.cpSync(base, dest, { recursive: true });
  const r = build(dest, theme);
  const ok = r.status === 0 && r.problems.length === 0;
  if (!ok) bad++;
  rows.push({ k: 0, name: 'control', theme, file: '-', why: 'unchanged sources', expect: 'exit 0, no PROBLEM', status: r.status, problems: r.problems.length, result: ok ? 'clean' : 'FAILED', line: r.problems[0] ?? '' });
}
M.forEach((m, i) => {
  const k = i + 1, theme = m.theme ?? 'light';
  const dest = path.join(work, String(k).padStart(2, '0') + '-' + m.name + (theme === 'dark' ? '-dark' : ''));
  fs.cpSync(base, dest, { recursive: true });
  const p = path.join(dest, m.file);
  const t = fs.readFileSync(p, 'utf8');
  const n = t.split(m.from).length - 1;
  const row = { k, name: m.name, theme, file: m.file.split(path.sep).pop(), why: m.why, expect: m.expect.join(' or ') };
  if (n !== 1) { bad++; rows.push({ ...row, status: null, problems: 0, result: 'ANCHOR x' + n, line: '' }); return; }
  fs.writeFileSync(p, t.replace(m.from, () => m.to));
  const r = build(dest, theme);
  const hit = r.problems.find((l) => m.expect.some((e) => l.includes(e)));
  const caught = r.status === 1 && !!hit;
  if (!caught) bad++;
  rows.push({ ...row, status: r.status, problems: r.problems.length, result: caught ? 'caught' : 'MISSED', line: hit ?? r.problems[0] ?? '' });
});

const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const md = ['| # | Mutation | Theme | File | Expected rule | Exit | PROBLEM lines | Result |', '|---|---|---|---|---|---|---|---|']
  .concat(rows.map((r) => `| ${r.k} | ${r.name}: ${r.why} | ${r.theme} | ${r.file} | ${r.expect} | ${r.status} | ${r.problems} | ${r.result} |`));
fs.writeFileSync(path.join(work, 'results.md'), md.join('\n') + '\n');
fs.writeFileSync(path.join(work, 'results.json'), JSON.stringify(rows, null, 2));
for (const r of rows) console.log(`${String(r.k).padStart(2)} ${r.result.padEnd(9)} exit=${r.status} n=${String(r.problems).padStart(3)} ${r.theme.padEnd(5)} ${r.name.padEnd(18)} ${cut(r.line, 150)}`);
console.log(bad ? `FAILED: ${bad} case(s)` : `ALL ${rows.length} cases as expected`);
process.exit(bad ? 1 : 0);
