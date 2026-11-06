// mutate.mjs for the fence: proves its tests can fail. Run with:  node .github/fence/mutate.mjs
// It copies this folder to a temporary place and first checks that the unbroken copy passes. Then it breaks one
// rule at a time, and at least one test must fail ("KILLED"). "SURVIVED" means a rule could stop working unseen.
// Keep each `from` string matching the current text of no-saved-pages.mjs; a missing one counts as a failure.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const F = 'no-saved-pages.mjs';

const mutations = [
  ['file types not checked', "let why = REFUSED_TYPE.test(file) ?", 'let why = false ?'],
  ['file type case matters', 'rtf)$/i;', 'rtf)$/;'],
  ['pdf and office files allowed', '|pdf|docx?|pptx?|xlsx?|odt|odp|ods|rtf', ''],
  ['renamed pages not checked', "if (PAGE_START.test(text.slice(0, 512))) return 'it is a web page under another name';", ''],
  ['page start case matters', 'html[\\s>])/i;', 'html[\\s>])/;'],
  ['a byte-order mark or spaces hide a page', '/^\\s*<', '/^<'],
  ['links not checked', "if (HOSTED_LINK.test(text)) return 'it has a link to a hosted Claude page';", ''],
  ['link case matters', "\n  'i',\n);", "\n  '',\n);"],
  ['links with no scheme missed', "|(?<![a-z0-9.-])(?:[a-z0-9-]+\\.)*(?:${HOSTS})\\/`", '`'],
  ['links with a scheme missed', 'String.raw`\\/\\/(?:[a-z0-9-]+\\.)*(?:${HOSTS})(?![a-z0-9-]|\\.[a-z0-9])` +\n    String.raw`|', 'String.raw`'],
  ['subdomains missed', 'String.raw`\\/\\/(?:[a-z0-9-]+\\.)*(?:${HOSTS})', 'String.raw`\\/\\/(?:${HOSTS})'],
  ['longer host names refused', '(?![a-z0-9-]|\\.[a-z0-9])', ''],
  ['longer names refused too', '(?<![a-z0-9.-])', ''],
  ['older page host missed', 'claude\\.(?:ai|site)|', 'claude\\.ai|'],
  ['content host missed', '|claudeusercontent\\.com', ''],
  ['UTF-16 page missed', "if (blob[0] === 0xff && blob[1] === 0xfe) return blob.toString('utf16le');", ''],
  ['big-endian UTF-16 page missed', "if (blob[0] === 0xfe && blob[1] === 0xff) return Buffer.from(blob).swap16().toString('utf16le');", ''],
  ['binary files read as text', 'if (blob.includes(0)) return null;', ''],
  ['any content allowed at the pinned path', 'if (allowed.get(file)?.has(id)) continue;', 'if (allowed.get(file)) continue;'],
  ['pinned list ignored', 'if (allowed.get(file)?.has(id)) continue;', ''],
  ['only the newest commit looked at', "toString('utf8').split('\\n').filter(Boolean);", "toString('utf8').split('\\n').filter(Boolean).slice(0, 1);"],
  ['looking at nothing passes', 'if (result.commits === 0) {', 'if (false) {'],
  ['git errors pass', 'return 2;\n  }\n  if (result.commits', 'return 0;\n  }\n  if (result.commits'],
  ['an option passed as a revision', "mode === '--history' && /^\\w[\\w./-]*$/.test", "mode === '--history' && /^[\\w./-]+$/.test"],
  ['bad arguments pass', "--history <rev>');\n    return 2;", "--history <rev>');\n    return 0;"],
  ['a refusal still exits 0', "then push again.');\n  return 1;", "then push again.');\n  return 0;"],
  ['the log repeats the link', 'console.log(`  ${file} (commit ${commit}): ${why}`);', 'console.log(`  ${file} (commit ${commit}): ${why} ${git(process.cwd(), ["show", `${commit}:${file}`])}`);'],
  ['same content under a second name skipped', 'if (type !== \'blob\' || files.has(`${id} ${file}`)) continue;\n      files.add(`${id} ${file}`);', "if (type !== 'blob' || files.has(id)) continue;\n      files.add(id);"],
  ['the helper page unpinned', "'6b0db35f23eb55e6b330e4b4082cd0c2df77c181'", "'0000000000000000000000000000000000000000'"],
];

const copy = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fence-mut-'));
  for (const name of fs.readdirSync(HERE)) fs.copyFileSync(path.join(HERE, name), path.join(dir, name));
  return dir;
};
const passes = (dir) =>
  spawnSync(process.execPath, ['--test', path.join(dir, 'no-saved-pages.test.mjs')], {
    encoding: 'utf8',
    env: { ...process.env, FENCE_REAL_REPO: REPO },
  }).status === 0;

if (!passes(copy())) {
  console.log('BASELINE FAILED: the unbroken check does not pass its own tests, so no result below would mean anything');
  process.exit(2);
}
console.log('baseline  the unbroken check passes its tests');
const source = fs.readFileSync(path.join(HERE, F), 'utf8');
let survived = 0;
for (const [name, from, to] of mutations) {
  if (!source.includes(from)) {
    console.log(`MISSING   ${name}`);
    survived++;
    continue;
  }
  const dir = copy();
  fs.writeFileSync(path.join(dir, F), source.replace(from, () => to));
  const killed = !passes(dir);
  if (!killed) survived++;
  console.log(`${killed ? 'KILLED   ' : 'SURVIVED '} ${name}`);
}
console.log(`${mutations.length - survived}/${mutations.length} mutations killed`);
process.exit(survived ? 1 : 0);
