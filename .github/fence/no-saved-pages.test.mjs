// Tests for no-saved-pages.mjs. Each one builds a small real git repo in a temporary folder.
//   node --test .github/fence/no-saved-pages.test.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ALLOWED, scan } from './no-saved-pages.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'no-saved-pages.mjs');
// The mutation run copies this folder out of the repo, so it says where the real repo is.
const REAL_REPO = process.env.FENCE_REAL_REPO || path.resolve(HERE, '../..');

// Built from parts so that this test file does not itself hold a link the check would refuse.
const host = ['claude', 'ai'].join('.');
const LINK = `https://${host}/artifact/abc123`;

const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'core.autocrlf=false', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fence-'));
  git(dir, 'init', '-q', '-b', 'main');
  return dir;
}

function commit(dir, files, remove = []) {
  for (const [name, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), body);
  }
  for (const name of remove) fs.rmSync(path.join(dir, name));
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'c');
  return git(dir, 'rev-parse', 'HEAD');
}

const run = (dir, ...args) => {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
};

// One clean commit, then one commit holding the given files, checked as a pull request would be.
function pullRequest(files) {
  const dir = repo();
  const base = commit(dir, { 'README.md': 'hello\n' });
  const head = commit(dir, files);
  return { dir, ...run(dir, '--range', `${base}..${head}`) };
}

test('a clean change passes and says how much it looked at', () => {
  const { code, out } = pullRequest({ 'guide.md': 'plain words\n', 'tool.mjs': 'export const a = 1;\n' });
  assert.equal(code, 0, out);
  assert.match(out, /looked at 1 commit\(s\) and 3 file version\(s\)/);
});

for (const name of ['page.html', 'deep/er/page.htm', 'PAGE.HTML', 'saved.mhtml', 'report.pdf', 'plan.docx', 'deck.pptx', 'sums.xlsx']) {
  test(`refuses a file called ${name}`, () => {
    const { code, out } = pullRequest({ [name]: 'anything\n' });
    assert.equal(code, 1, out);
    assert.ok(out.includes(name), out);
  });
}

for (const [label, body] of [
  ['a doctype', '<!doctype html>\n<title>x</title>\n'],
  ['an html tag', '\n  <HTML lang="en"><body>x</body></html>\n'],
  ['a byte-order mark', '﻿<!DOCTYPE html>\n'],
]) {
  test(`refuses a page renamed to .txt that starts with ${label}`, () => {
    const { code, out } = pullRequest({ 'notes.txt': body });
    assert.equal(code, 1, out);
    assert.match(out, /web page under another name/);
  });
}

test('refuses a page saved as UTF-16, which holds zero bytes like a binary file', () => {
  const body = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('<!doctype html>\n', 'utf16le')]);
  const { code, out } = pullRequest({ 'notes.txt': body });
  assert.equal(code, 1, out);
});

test('refuses a page saved as big-endian UTF-16', () => {
  const body = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from('<!doctype html>\n', 'utf16le').swap16()]);
  const { code, out } = pullRequest({ 'notes.txt': body });
  assert.equal(code, 1, out);
});

for (const [label, text] of [
  ['with https', `See ${LINK} for it.\n`],
  ['with capitals', `See HTTPS://${host.toUpperCase()}/Artifact/Abc.\n`],
  ['with no scheme', `See ${host}/code/artifact/abc.\n`],
  ['on a subdomain', `See https://www.${host}/share/abc.\n`],
  ['with no path', `See https://${host}.\n`],
  ['on the older page host', `See https://abc.${['claude', 'site'].join('.')}/x.\n`],
  ['on the content host', `See https://www.${['claudeusercontent', 'com'].join('.')}/x.\n`],
]) {
  test(`refuses a link ${label}`, () => {
    const { code, out } = pullRequest({ 'guide.md': text });
    assert.equal(code, 1, out);
    assert.match(out, /link to a hosted Claude page/);
  });
}

for (const [label, text] of [
  ['the plain words', `A ${host} link is not allowed here.\n`],
  ['a longer name ending the same way', `https://my${host}/x\n`],
  ['a host that only starts the same way', `https://${host}.example.com/x\n`],
  ['a different Anthropic site', 'https://claude.com/claude-code\n'],
]) {
  test(`allows ${label}`, () => {
    const { code, out } = pullRequest({ 'guide.md': text });
    assert.equal(code, 0, out);
  });
}

test('the log never repeats a refused link', () => {
  const { code, out } = pullRequest({ 'guide.md': `${LINK}\n` });
  assert.equal(code, 1, out);
  assert.ok(!out.includes('abc123'), out);
  assert.ok(!out.includes(host), out);
});

test('refuses a page added in one commit and removed in the next, because history is kept', () => {
  const dir = repo();
  const base = commit(dir, { 'README.md': 'hello\n' });
  commit(dir, { 'page.html': 'x\n' });
  const head = commit(dir, { 'guide.md': 'tidy\n' }, ['page.html']);
  const { code, out } = run(dir, '--range', `${base}..${head}`);
  assert.equal(code, 1, out);
  assert.ok(out.includes('page.html'), out);
});

test('--history finds an old page that a pull request range would not reach', () => {
  const dir = repo();
  commit(dir, { 'page.html': 'x\n' });
  const base = commit(dir, { 'README.md': 'hello\n' }, ['page.html']);
  const head = commit(dir, { 'guide.md': 'more\n' });
  assert.equal(run(dir, '--range', `${base}..${head}`).code, 0);
  assert.equal(run(dir, '--history', head).code, 1);
});

test('a binary file is not read as text, which is the limit the header states', () => {
  const body = Buffer.concat([Buffer.from([0x89, 0x50, 0x00]), Buffer.from(LINK)]);
  const { code, out } = pullRequest({ 'logo.png': body });
  assert.equal(code, 0, out);
});

test('a range with no commits fails, because looking at nothing is not a pass', () => {
  const dir = repo();
  const only = commit(dir, { 'README.md': 'hello\n' });
  const { code, out } = run(dir, '--range', `${only}..${only}`);
  assert.equal(code, 2, out);
  assert.match(out, /nothing was looked at/);
});

test('a revision git cannot read fails', () => {
  const dir = repo();
  commit(dir, { 'README.md': 'hello\n' });
  assert.equal(run(dir, '--range', 'nothing..neither').code, 2);
});

for (const args of [[], ['--range'], ['--range', 'no-dots'], ['--history', '--all'], ['--other', 'x']]) {
  test(`bad arguments fail: ${JSON.stringify(args)}`, () => {
    const dir = repo();
    commit(dir, { 'README.md': 'hello\n' });
    assert.equal(run(dir, ...args).code, 2);
  });
}

test('the allowed page passes only with its exact pinned content', () => {
  const dir = repo();
  const first = commit(dir, { 'tools/helper.html': 'first\n' });
  const id = git(dir, 'rev-parse', `${first}:tools/helper.html`);
  const allowed = new Map([['tools/helper.html', new Set([id])]]);
  assert.deepEqual(scan(dir, [first], allowed).refused, []);
  assert.equal(scan(dir, [first]).refused.length, 1, 'not allowed without the list');
  const second = commit(dir, { 'tools/helper.html': 'changed\n' });
  assert.equal(scan(dir, [`${first}..${second}`], allowed).refused.length, 1, 'changed content is refused');
  const moved = repo();
  const elsewhere = commit(moved, { 'tools/other.html': 'first\n' });
  assert.equal(scan(moved, [elsewhere], allowed).refused.length, 1, 'the same content at another path is refused');
});

test('the same content under two names is judged for each name', () => {
  const dir = repo();
  const only = commit(dir, { 'a.md': `${LINK}\n`, 'b.md': `${LINK}\n` });
  assert.deepEqual(scan(dir, [only]).refused.map((r) => r.file).sort(), ['a.md', 'b.md']);
});

test("this repo's own tip passes, and its pinned helper page is really the one in the repo", () => {
  const tip = git(REAL_REPO, 'rev-parse', 'HEAD');
  const result = scan(REAL_REPO, ['-1', tip]);
  assert.ok(result.commits === 1 && result.files > 10, 'looked at the real repo');
  assert.deepEqual(result.refused, []);
  const [[file, ids]] = [...ALLOWED];
  assert.ok(ids.has(git(REAL_REPO, 'rev-parse', `${tip}:${file}`)));
});
