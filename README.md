<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/southlodge-logo-white.png">
    <img src="assets/southlodge-logo.png" alt="Southlodge.ai" width="320">
  </picture>
</p>

# ai-session-handoff

**Carry AI coding work into the next session.** For Claude Code, OpenAI Codex CLI and xAI Grok Build.

Long chats get summarised, hit their limit, or are simply closed, and the next session starts cold: it does not
know what was done, what was decided, or what comes next. This kit gives AI coding chats a memory of each other:

- **Every reply ends with a recap.** Task, what is done, the exact next step, the files touched and a progress
  bar. A reply that drops the recap is sent back for one.
- **The next chat reads the notes.** A new session in the same project is shown the hand-off notes and carries on.
- **The old chat stops.** The session that handed its work over is told so, and stops working on it.
- **A "100% done" claim is checked against git** before it is accepted.

One Node script serves all three tools. Node built-ins only, no dependencies, no network calls: nothing leaves
your machine.

## Install

| You use          | Start here                                                         | Install                                   |
| ---------------- | ------------------------------------------------------------------ | ----------------------------------------- |
| Claude Code      | [BUILD-YOUR-OWN-CHAT-HANDOFF.md](BUILD-YOUR-OWN-CHAT-HANDOFF.md)   | `node install-claude.mjs`, then `--write` |
| OpenAI Codex CLI | [BUILD-YOUR-OWN-CODEX-HANDOFF.md](BUILD-YOUR-OWN-CODEX-HANDOFF.md) | `node install-codex.mjs`, then `--write`  |
| xAI Grok Build   | [BUILD-YOUR-OWN-GROK-HANDOFF.md](BUILD-YOUR-OWN-GROK-HANDOFF.md)   | `node install-grok.mjs`, then `--write`   |

Each installer is a dry run first: it says what it would change and writes nothing until you add `--write`. It
backs up every file it changes, keeps your own settings, and is safe to run again. You need Node 18 or later.

The Claude Code guide explains the whole design, phase by phase. The Codex and Grok guides cover what differs on
each tool and point back to it for the reasons.

## Check it before you install it

```sh
node --test handoff-guard.test.mjs handoff-guard.codex.test.mjs handoff-guard.grok.test.mjs   # 71 tests; never touches your real home folder
node mutate.mjs                                                                               # 96 mutations; every one must be KILLED
```

Run all three test files even if you use only one tool: they share one script. The mutation run breaks each
guard in turn and checks that a test notices, so a passing suite means the tests are real.

## Tested with

| Tool             | Version |
| ---------------- | ------- |
| Claude Code      | 2.1.252 |
| OpenAI Codex CLI | 0.166.0 |
| xAI Grok Build   | 1.0.70  |

Both commands above pass on Windows 11 (Node 24) and Ubuntu 26.04 (Node 22). Each guide records its own live
two-session test.

## How it works

Each tool runs hooks at fixed moments: when a session starts, when you send a prompt, when the model stops, and
when a long chat is compacted. The installer points those hooks at `handoff-guard.mjs`, which has one mode per
hook. On stop it reads the recap from the reply and saves it as a note under the tool's own home folder; on start
it shows the notes for the current project; on a prompt it checks whether this chat has been handed off; and the
status line shows the live progress bar. The notes are plain JSON files you can read, copy or delete.

## Files

| File                           | For         | What it does                                                                                |
| ------------------------------ | ----------- | ------------------------------------------------------------------------------------------- |
| `handoff-guard.mjs`            | all three   | The script: one mode per hook, plus `takeover`, `resume-here`, `list` and `notes`           |
| `settings.fragment.json`       | Claude Code | Hook and status line entries to merge into `~/.claude/settings.json`                        |
| `CLAUDE.snippet.md`            | Claude Code | The recap convention, definition of done and compaction instructions                        |
| `install-claude.mjs`           | Claude Code | Copies the script, merges the hooks and adds the convention; dry run unless `--write`       |
| `codex-hooks.json`             | Codex       | Hook entries for `~/.codex/hooks.json` (the installer fills in the path)                    |
| `install-codex.mjs`            | Codex       | Copies the script and merges the hooks; dry run unless `--write`                            |
| `AGENTS.snippet.md`            | Codex       | The recap convention, handoff rules and definition of done                                  |
| `grok-hooks.json`              | Grok        | Hook entries for `~/.grok/hooks/handoff-guard.json` (the installer fills in the path)       |
| `install-grok.mjs`             | Grok        | Copies the script, hooks file and rules file; dry run unless `--write`                      |
| `GROK.snippet.md`              | Grok        | The recap convention and handoff rules, for `~/.grok/rules/`                                |
| `handoff-guard.test.mjs`       | Claude Code | 21 tests, including the installer's merge into your own settings                            |
| `handoff-guard.codex.test.mjs` | Codex       | 20 tests, including every JSON shape Codex accepts                                          |
| `handoff-guard.grok.test.mjs`  | Grok        | 30 tests: the Windows status line, the hand-off notice, the Stop recap gate and more        |
| `mutate.mjs`                   | all three   | Breaks each guard in turn and checks that a test notices                                    |
| `package.json`                 | all three   | `npm test` and `npm run mutate`; no dependencies                                            |
| `.github/workflows/test.yml`   | all three   | Runs the tests on Ubuntu and Windows for Node 20, 22 and 24, and the mutation run on Ubuntu |
| `SECURITY.md`                  | all three   | How to report a vulnerability, and what the kit does and does not touch                     |
| `CONTRIBUTING.md`              | all three   | The rules a change has to keep                                                              |
| `LICENSE`                      | all three   | The Apache License 2.0 text, unchanged from apache.org                                      |
| `NOTICE`                       | all three   | Copyright notice to keep with any copy or fork                                              |
| `assets/`                      | all three   | The Southlodge logo (light + dark) shown at the top of this README; not installed anywhere  |

## Status

Early public release. The layout is flat on purpose: it is the exact tree the 71 tests and 96 mutations were
proven on. A folder per tool is planned next, with the same proof re-run.

## Where it came from

This is the open version of the hand-off system Southlodge runs on its own AI coding sessions. The full version
adds more; section 6 of the Claude Code guide lists what, so you can build the parts you want.

## Licence

Apache License 2.0. Copyright 2026 Southlodge.ai. See [LICENSE](LICENSE) and [NOTICE](NOTICE). The script, installers, tests, guides and snippets are all under the same licence: use it, change it and ship it, keep the notice, and do not use the Southlodge name to endorse your version. The Southlodge name and logo are trademarks of Southlodge.ai and are not covered by the licence.

## Contact

Built at [Southlodge.ai](https://southlodge.ai); start at [southlodge.ai/welcome](https://southlodge.ai/welcome). To connect with the author: [LinkedIn](https://www.linkedin.com/in/jamie-underwood-principal-consultant/).
