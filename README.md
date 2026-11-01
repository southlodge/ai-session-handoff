<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/southlodge-logo-white.png">
    <img src="assets/southlodge-logo.png" alt="Southlodge.ai" width="320">
  </picture>
</p>

# ai-session-handoff

**Carry AI coding work into the next session.** For Claude Code, OpenAI Codex CLI and xAI Grok Build.

Long chats get summarised, hit their limit, or are simply closed, and the next session starts cold: it does not
know what was done, what was decided, or what comes next. Built-in resume brings back a transcript; it does not
leave a structured note the next chat can act on, and it does not stop the old chat from carrying on. This kit
does both:

- **Every reply ends with a recap.** Task, what is done, the exact next step, the files touched and a progress
  bar, in a fixed shape the hooks can read. The last recap is saved as this chat's note. On Grok Build, a turn
  that ran tools and ended without a recap is sent back for one; on Claude Code and Codex the note simply keeps
  the last recap seen.
- **The next chat reads the notes.** A new session in the same project is shown the recent notes, as data, and
  carries on with the one you pick.
- **The old chat stops.** The session that handed its work over is told so, its tools are refused, and its
  scheduled wake-ups are told to stop.
- **A "100% done" claim is checked against git** before it is accepted: the docs files the recap says were
  updated must really have changed.

One Node script serves all three tools. Node built-ins only, no dependencies, no network calls, no telemetry:
nothing leaves your machine, and the notes are plain JSON files under the tool's own home folder.

## What you will see

Every reply ends like this (the convention the installer adds to your rules file):

```text
HANDOFF
Task: add a per-IP rate limit to the login endpoint.
Done: throttle middleware written and wired (commit 3f2a91c).
Next: write the lockout tests in tests/auth/throttle.test.ts.
Progress: 2/5 ▓▓▓▓░░░░░░ 40% — Login rate limit: per-IP throttle,
  lockout tests and docs for the auth endpoint
ETA: ~25 min this task · ~1 h remaining tasks
Steps:
✓ read the login handler
✓ add the throttle middleware
→ write the lockout tests
○ planning docs updated
○ memory updated
Files:
  src/auth/throttle.ts
  src/auth/login.ts
```

The next chat you open in that folder is told, before you type anything:

```text
Notes from 1 recent chat:
▓▓▓▓░░░░░░ 40% Login rate limit: per-IP throttle, lockout tests and docs … (2 h ago)
Say "what's pending?" for details, "carry on with …" to continue one, or type a new task.
```

On Claude Code and Grok Build the status line shows the context gauge and this chat's own progress bar, and
`HANDED OFF` once another chat has taken the work over:

```text
[Claude] · ctx 120k/200k ▓▓▓▓▓▓░░░░ 60% · ▓▓▓▓░░░░░░ 40% 2/5 → next: write the lockout tests · ETA ~25 min …
```

## How it works

Each tool runs hooks at fixed moments: when a session starts, when you send a prompt, before a tool runs, when
the model stops, and when a long chat is compacted. The installer points those hooks at `handoff-guard.mjs`,
which has one mode per hook. The five diagrams below show the mechanics; each one is a plain SVG in
[assets/diagrams/](assets/diagrams/) that you can open at full size. The small Node scripts that draw them live in
[assets/diagrams/src/](assets/diagrams/src/); `node assets/diagrams/src/build.mjs` regenerates all five.

**1. One script, three tools.** The hook events each tool fires, the modes of the script they reach, the note
files on disk and the one question the script asks git.

<p align="center"><img src="assets/diagrams/01-overview.svg" alt="Overview: Claude Code, Codex CLI and Grok Build each run handoff-guard.mjs at their hook moments; it reads and writes notes under the tool's home folder and asks git about a 100% claim" width="100%"></p>

**2. Claude Code.** Session start shows the notes, every prompt checks whether this chat was handed off, every
tool call is refused once it has been, the Stop hook saves the recap and checks a 100% claim, PostCompact keeps
the compaction summary, and the status line paints the gauge.

<p align="center"><img src="assets/diagrams/02-claude-code.svg" alt="Claude Code: how one chat flows through the hooks" width="100%"></p>

**3. OpenAI Codex CLI.** The same script with `--host codex` and notes under `~/.codex`. Codex has no status
line, so `list` prints the bars; its compact matcher re-attaches the chat's own summary; the docs check at 100%
only applies when git shows files changed since the chat began.

<p align="center"><img src="assets/diagrams/03-codex-cli.svg" alt="OpenAI Codex CLI: how one chat flows through the hooks" width="100%"></p>

**4. xAI Grok Build.** The same script with `--host grok`. Grok cannot show text at session start, so the notes
are owed and delivered after the first tool call; a turn that ran tools must end with a recap; the hand-off
notice blocks the prompt until you type `continue here`.

<p align="center"><img src="assets/diagrams/04-grok-build.svg" alt="xAI Grok Build: how one chat flows through the hooks" width="100%"></p>

**5. The hand-off itself.** Two chats, one piece of work: the recap becomes a note, the next chat sees it, the
`takeover` command marks the old chat, the old chat goes quiet, and the 100% claim is checked against git.

<p align="center"><img src="assets/diagrams/05-handoff-lifecycle.svg" alt="The hand-off lifecycle: chat A's recap becomes a note, chat B reads it and takes the work over, chat A is told to stop, and the 100% claim is checked against git" width="100%"></p>

## Install

| You use          | Start here                                                         | Install                                   |
| ---------------- | ------------------------------------------------------------------ | ----------------------------------------- |
| Claude Code      | [BUILD-YOUR-OWN-CHAT-HANDOFF.md](BUILD-YOUR-OWN-CHAT-HANDOFF.md)   | `node install-claude.mjs`, then `--write` |
| OpenAI Codex CLI | [BUILD-YOUR-OWN-CODEX-HANDOFF.md](BUILD-YOUR-OWN-CODEX-HANDOFF.md) | `node install-codex.mjs`, then `--write`  |
| xAI Grok Build   | [BUILD-YOUR-OWN-GROK-HANDOFF.md](BUILD-YOUR-OWN-GROK-HANDOFF.md)   | `node install-grok.mjs`, then `--write`   |

Each installer is a dry run first: it says what it would change and writes nothing until you add `--write`. It
backs up every file it changes, keeps your own settings, and is safe to run again. You need Node 20 or later.

Hooks run code on your machine, so read the script before you install it: `handoff-guard.mjs` is one file, and
the "Files" table below says what every other file is for. Each tool also asks you to trust new hooks the first
time they run.

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

As of 1 November 2026:

| Tool             | Version |
| ---------------- | ------- |
| Claude Code      | 2.1.252 |
| OpenAI Codex CLI | 0.166.0 |
| xAI Grok Build   | 1.0.70  |

Both commands above pass on Windows 11 (Node 24) and Ubuntu 26.04 (Node 22), and in CI on Ubuntu and Windows for
Node 20, 22 and 24. Each guide records its own live two-session test. The kit relies only on each tool's
documented hook events and JSON shapes; if a tool changes those, the tests here are the first thing to run.

## Files

| File                            | For         | What it does                                                                                |
| ------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `handoff-guard.mjs`             | all three   | The script: one mode per hook, plus `takeover`, `resume-here`, `list` and `notes`           |
| `settings.fragment.json`        | Claude Code | Hook and status line entries to merge into `~/.claude/settings.json`                        |
| `CLAUDE.snippet.md`             | Claude Code | The recap convention, definition of done and compaction instructions                        |
| `install-claude.mjs`            | Claude Code | Copies the script, merges the hooks and adds the convention; dry run unless `--write`       |
| `codex-hooks.json`              | Codex       | Hook entries for `~/.codex/hooks.json` (the installer fills in the path)                    |
| `install-codex.mjs`             | Codex       | Copies the script and merges the hooks; dry run unless `--write`                            |
| `AGENTS.snippet.md`             | Codex       | The recap convention, handoff rules and definition of done                                  |
| `grok-hooks.json`               | Grok        | Hook entries for `~/.grok/hooks/handoff-guard.json` (the installer fills in the path)       |
| `install-grok.mjs`              | Grok        | Copies the script, hooks file and rules file; dry run unless `--write`                      |
| `GROK.snippet.md`               | Grok        | The recap convention and handoff rules, for `~/.grok/rules/`                                |
| `handoff-guard.test.mjs`        | Claude Code | 21 tests, including the installer's merge into your own settings                            |
| `handoff-guard.codex.test.mjs`  | Codex       | 20 tests, including every JSON shape Codex accepts                                          |
| `handoff-guard.grok.test.mjs`   | Grok        | 30 tests: the Windows status line, the hand-off notice, the Stop recap gate and more        |
| `mutate.mjs`                    | all three   | Breaks each guard in turn and checks that a test notices                                    |
| `package.json`                  | all three   | `npm test` and `npm run mutate`; no dependencies                                            |
| `.github/workflows/test.yml`    | all three   | Runs the tests on Ubuntu and Windows for Node 20, 22 and 24, and the mutation run on Ubuntu |
| `.github/ISSUE_TEMPLATE/`       | all three   | Bug report and feature request forms; security reports go through `SECURITY.md`             |
| `.github/PULL_REQUEST_TEMPLATE.md` | all three | The checklist a change has to pass: tests, mutation run, built-ins only, dry-run installers |
| `.github/dependabot.yml`        | all three   | Keeps the pinned GitHub Actions current (the kit itself has no dependencies to update)      |
| `CHANGELOG.md`                  | all three   | What changed in each release                                                                |
| `CODE_OF_CONDUCT.md`            | all three   | Contributor Covenant 2.1                                                                    |
| `CONTRIBUTING.md`               | all three   | The rules a change has to keep                                                              |
| `SECURITY.md`                   | all three   | How to report a vulnerability, and what the kit does and does not touch                     |
| `LICENSE`                       | all three   | The Apache License 2.0 text, unchanged from apache.org                                      |
| `NOTICE`                        | all three   | Copyright notice to keep with any copy or fork                                              |
| `assets/`                       | all three   | The Southlodge logo (light + dark) and the five system diagrams; not installed anywhere      |

## Status

Early public release. The layout is flat on purpose: it is the exact tree the 71 tests and 96 mutations were
proven on. A folder per tool is planned next, with the same proof re-run. See [CHANGELOG.md](CHANGELOG.md).

## Where it came from

This is the open version of the hand-off system Southlodge runs on its own AI coding sessions. The full version
adds more; section 6 of the Claude Code guide lists what, so you can build the parts you want.

## Licence

Apache License 2.0. Copyright 2026 Southlodge.ai. See [LICENSE](LICENSE) and [NOTICE](NOTICE). The script,
installers, tests, guides, snippets and diagrams are all under the same licence: use it, change it and ship it,
keep the notice, and do not use the Southlodge name to endorse your version. The Southlodge name and logo are
trademarks of Southlodge.ai and are not covered by the licence. Claude, Codex and Grok are trademarks of their
owners; this kit is not affiliated with or endorsed by Anthropic, OpenAI or xAI.

## Contact

Built at [Southlodge.ai](https://southlodge.ai); start at [southlodge.ai/welcome](https://southlodge.ai/welcome). To connect with the author: [LinkedIn](https://www.linkedin.com/in/jamie-underwood-principal-consultant/).
