#!/usr/bin/env node
// no-saved-pages.mjs: keeps saved web pages, office documents and links to hosted Claude pages out of this repo.
//
// This repo holds code and guides. A public repo's whole history is public, so deleting a page later does not
// undo the slip. That is why this looks at every file in every commit, not only at the final state.
//
//   node .github/fence/no-saved-pages.mjs --range <base>..<head>   every commit a pull request adds
//   node .github/fence/no-saved-pages.mjs --history <rev>          every commit reachable from <rev>
//
// Exit codes: 0 clean, 1 refused, 2 could not check. Looking at nothing is a failure, never a pass.
//
// It only reads git objects. It never checks out or runs what it reads, so it is safe on a stranger's pull
// request. It names the file and the reason but never repeats the matched text, so a refused link does not end
// up in a public log.
//
// What it cannot see: words copied by hand from a page into an ordinary file, and text inside a binary file.
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REFUSED_TYPE = /\.(?:html?|xhtml|shtml|mhtml?|mht|pdf|docx?|pptx?|xlsx?|odt|odp|ods|rtf)$/i;

// A page saved under another name still starts like a page.
const PAGE_START = /^[\s﻿]*<(?:!doctype\s+html|html[\s>])/i;

const HOSTS = String.raw`claude\.(?:ai|site)|claudeusercontent\.com`;
const HOSTED_LINK = new RegExp(
  String.raw`\/\/(?:[a-z0-9-]+\.)*(?:${HOSTS})(?![a-z0-9-]|\.[a-z0-9])` +
    String.raw`|(?<![a-z0-9.-])(?:[a-z0-9-]+\.)*(?:${HOSTS})\/`,
  'i',
);

// The one web page this repo needs: a helper the diagram build opens to measure text. It is pinned by its exact
// content, so changing it, or putting anything else at that path, is refused until a pull request edits this list.
export const ALLOWED = new Map([
  ['assets/diagrams/src/metrics/measure.html', new Set(['6b0db35f23eb55e6b330e4b4082cd0c2df77c181'])],
]);

const git = (cwd, args) =>
  execFileSync('git', args, { cwd, maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'] });

// Windows tools often write UTF-16, and its zero bytes would otherwise make a page look like a binary file.
function decode(blob) {
  if (blob[0] === 0xff && blob[1] === 0xfe) return blob.toString('utf16le');
  if (blob[0] === 0xfe && blob[1] === 0xff) return Buffer.from(blob).swap16().toString('utf16le');
  if (blob.includes(0)) return null;
  return blob.toString('utf8');
}

function contentProblem(blob) {
  const text = decode(blob);
  if (text === null) return null;
  if (PAGE_START.test(text.slice(0, 512))) return 'it is a web page under another name';
  if (HOSTED_LINK.test(text)) return 'it has a link to a hosted Claude page';
  return null;
}

// revArgs is what git rev-list should walk, such as ['base..head'] or ['main'].
export function scan(cwd, revArgs, allowed = ALLOWED) {
  const commits = git(cwd, ['rev-list', ...revArgs]).toString('utf8').split('\n').filter(Boolean);
  const refused = new Map();
  const contentChecked = new Map();
  const files = new Set();
  for (const commit of commits) {
    for (const entry of git(cwd, ['ls-tree', '-r', '-z', '--full-tree', commit]).toString('utf8').split('\0')) {
      if (!entry) continue;
      const tab = entry.indexOf('\t');
      const [, type, id] = entry.slice(0, tab).split(' ');
      const file = entry.slice(tab + 1);
      if (type !== 'blob' || files.has(`${id} ${file}`)) continue;
      files.add(`${id} ${file}`);
      if (allowed.get(file)?.has(id)) continue;
      let why = REFUSED_TYPE.test(file) ? 'web pages and office documents do not belong in this repo' : null;
      if (!why) {
        if (!contentChecked.has(id)) contentChecked.set(id, contentProblem(git(cwd, ['cat-file', 'blob', id])));
        why = contentChecked.get(id);
      }
      if (why && !refused.has(`${file} ${why}`)) refused.set(`${file} ${why}`, { commit: commit.slice(0, 10), file, why });
    }
  }
  return { commits: commits.length, files: files.size, refused: [...refused.values()] };
}

function main(argv) {
  const [mode, value] = argv;
  const range = mode === '--range' && /^\w[\w./-]*\.\.\w[\w./-]*$/.test(value || '');
  const history = mode === '--history' && /^\w[\w./-]*$/.test(value || '');
  if (!range && !history) {
    console.log('could not check: use --range <base>..<head> or --history <rev>');
    return 2;
  }
  let result;
  try {
    result = scan(process.cwd(), [value]);
  } catch (err) {
    console.log(`could not check: git could not read ${value}: ${String(err.message).split('\n')[0]}`);
    return 2;
  }
  if (result.commits === 0) {
    console.log(`could not check: ${value} holds no commits, so nothing was looked at`);
    return 2;
  }
  console.log(`looked at ${result.commits} commit(s) and ${result.files} file version(s)`);
  if (result.refused.length === 0) {
    console.log('clean: no saved web pages, office documents or links to hosted Claude pages');
    return 0;
  }
  console.log(`REFUSED ${result.refused.length} file(s):`);
  for (const { commit, file, why } of result.refused) console.log(`  ${file} (commit ${commit}): ${why}`);
  console.log('Take these out of every commit in this change, not just the last one, then push again.');
  return 1;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
