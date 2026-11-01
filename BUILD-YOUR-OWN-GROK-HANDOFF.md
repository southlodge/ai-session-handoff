# Build your own chat handoff for Grok Build

This guide shows you how to set up the chat handoff system for xAI's Grok Build CLI (`grok`). It uses the same
script as the Claude Code and Codex versions. Once it is in place:

- every Grok chat leaves a short note when it finishes a turn;
- a new chat in the same project folder is given those notes and can carry on where one stopped;
- the chat that handed its work over sees a visible notice on its next prompt and has its tools refused;
- a turn that runs a tool but forgets the `HANDOFF` recap is stopped once and asked to add it;
- resuming a handed-off chat hands the work back, so the newer chat is then the one told to stop;
- a reply that claims a task is 100% done is checked before Grok accepts it;
- after Grok compacts a chat, that chat gets its own last recap back;
- the status line shows how full the context window is, and the chat's progress bar (on Windows through a small
  `.cmd` wrapper, because a `config.toml` command there cannot carry the inner quotes the call needs).

You need one Node script, one hooks file in `~/.grok/hooks/`, one rules file in `~/.grok/rules/` and a status
line entry in `~/.grok/config.toml`. There is no server or database, and nothing to install from npm.

**Where this fits.** The design and the reasons behind it are explained once, in
[BUILD-YOUR-OWN-CHAT-HANDOFF.md](BUILD-YOUR-OWN-CHAT-HANDOFF.md) (the Claude Code guide), phases 1 to 8. This
guide covers what is different on Grok, how to install it, and how to test it.

> **Status (2026-10-30).** Every Grok behaviour this kit relies on comes from the Grok Build documentation
> (section 9), and the tests run the script exactly as that documentation says Grok calls it. A follow-up round
> on 2026-10-30 closed four Grok-only gaps: the Windows status line (a `.cmd` wrapper), the deny reason leading
> with the escape-hatch command so a clip cannot cut it, a visible hand-off notice on `UserPromptSubmit` with a
> `continue here` escape, and a `Stop` recap gate; resuming a handed-off chat now also hands the work back. The
> kit **was run live on Windows 11 on 2026-10-30** in two real Grok chats (note, status line, menu, takeover,
> recap bar, refusal, resume), which is what found those gaps; the fixes themselves are test-proven and have not
> yet been re-run live. Do the checks in section 6, "Before you rely on it", the first time you install it.
>
> **Two-tab retest (2026-10-30 22:31-22:57, Windows 11, Build 1.0.70): 7/7 PASS** — status row, 50% note, takeover from the notes menu, visible block in the old chat, `continue here` hand-back, block in the other chat. It surfaced two small gaps, fixed in this kit state (we number findings from our own use, and the matching tests carry the same numbers): a step wrapped onto an indented second line hid the steps after it from the recap gate (gap 88), and after a hand-back the notice still said "a newer chat" (gap 89). The full retest record is in the Southlodge runbook.

---

## Contents

1. [What maps to what](#1-what-maps-to-what)
2. [What is in the kit](#2-what-is-in-the-kit)
3. [Quick start](#3-quick-start)
4. [How each part works on Grok](#4-how-each-part-works-on-grok)
5. [What Grok cannot do here, and what replaces it](#5-what-grok-cannot-do-here-and-what-replaces-it)
6. [Testing it properly](#6-testing-it-properly)
7. [Reference](#7-reference)
8. [Troubleshooting](#8-troubleshooting)
9. [Sources](#9-sources)

---

## 1. What maps to what

| Piece                      | Claude Code                      | Grok Build                                                              |
| -------------------------- | -------------------------------- | ----------------------------------------------------------------------- |
| Reply convention           | `~/.claude/CLAUDE.md`            | `~/.grok/rules/chat-handoff.md` (every `*.md` there is always loaded)   |
| Hook wiring                | `~/.claude/settings.json`        | `~/.grok/hooks/handoff-guard.json` (a file of its own)                  |
| Script location            | `~/.claude/handoff-guard.mjs`    | `~/.grok/handoff-guard.mjs`                                             |
| Note store                 | `~/.claude/handoff/`             | `~/.grok/handoff/` (moves with `$GROK_HOME`)                            |
| Save a note                | `Stop` (async)                   | `Stop`, only when `reason` is `end_turn` and not inside a subagent      |
| Completion gate            | `Stop` (sync)                    | `Stop`, in the same group as the note writer                            |
| Menu for a new chat        | `SessionStart`                   | `SessionStart` leaves it owed; the first `PostToolUse` delivers it      |
| Handed-off message         | `UserPromptSubmit`               | `UserPromptSubmit` blocks with a visible notice, plus `PreToolUse`      |
| Refuse tools after handoff | `PreToolUse`                     | `PreToolUse`                                                            |
| Keep compaction context    | `PostCompact` stores the summary | `PostCompact` leaves the recap owed; the next tool result carries it    |
| Context size for the note  | read from the transcript         | cached by the status line, from `context_window.context_tokens`         |
| Progress at a glance       | a command status line            | a command status line (`[ui.status_line]` in `config.toml`)             |
| Big-chat nudge             | `UserPromptSubmit`               | none: Grok discards an _allowing_ hook's text; the status line shows it |
| Turn a hook on             | edit settings, restart           | add the file, restart Grok or press `r` in `/hooks`; trust each folder  |

Every Grok hook command ends with `--host grok`. The flag changes four things:

- **where it keeps files**: `$GROK_HOME`, else `~/.grok`, instead of `~/.claude`;
- **how it reads hook input**: Grok sends camelCase keys (`sessionId`, `lastAssistantMessage`, `toolName`,
  `stopHookActive`), which the script maps to the names it uses;
- **how it hands text to the model**: Grok ignores what `SessionStart` and `PostCompact` hooks print, so those
  modes leave a marker and the `posttool` mode delivers the text with the next tool result (phase 3);
- **the commands and wording it gives the model**: they point at `~/.grok/handoff-guard.mjs`, carry
  `--host grok`, and name Grok's `scheduler_list` and `scheduler_delete` tools for finding and cancelling a
  `/loop`.

---

## 2. What is in the kit

| File                           | What it does                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `handoff-guard.mjs`            | The script, shared with Claude Code and Codex: 8 hook modes and 4 commands, Node built-ins |
| `grok-hooks.json`              | The Grok hook entries, with a `__HANDOFF_GUARD__` placeholder for the script's path        |
| `GROK.snippet.md`              | The recap convention, the handoff rules and the definition of done, for Grok               |
| `install-grok.mjs`             | Copies the script, the hooks file and the rules file into `~/.grok`; dry run by default    |
| `handoff-guard.grok.test.mjs`  | 28 tests for the Grok side                                                                 |
| `handoff-guard.test.mjs`       | 21 tests for the Claude Code side                                                          |
| `handoff-guard.codex.test.mjs` | 16 tests for the Codex side (run all three; they share one script)                         |
| `mutate.mjs`                   | Breaks each guard in turn and checks that a test notices (section 6)                       |

---

## 3. Quick start

**You need:** Grok Build, Node.js 18 or later, and git.

1. **Run the tests** from the kit folder. They use a throwaway home folder and never touch your real
   `~/.grok`:

   ```sh
   node --test handoff-guard.test.mjs handoff-guard.codex.test.mjs handoff-guard.grok.test.mjs
   ```

   All 67 should pass.

2. **See what the installer would change.** With no flags it only reports:

   ```sh
   node install-grok.mjs
   ```

   It prints where each of its three files will go and whether each is new, unchanged or will be updated. It
   also says whether `config.toml` already has a status line, and warns about anything that would make a hook
   run twice.

3. **Install:**

   ```sh
   node install-grok.mjs --write
   ```

   - It copies `handoff-guard.mjs` to `~/.grok/handoff-guard.mjs`.
   - It writes `~/.grok/hooks/handoff-guard.json` and `~/.grok/rules/chat-handoff.md`, with the script's
     absolute path filled in. Grok loads every `*.json` in `hooks/` and every `*.md` in `rules/`, so these sit
     beside your own files; nothing of yours is merged or edited.
   - Before it changes one of its own files that you have edited, it saves a copy beside it
     (`chat-handoff.md.bak-<date>-<time>`). The backup names do not end in `.json` or `.md`, so Grok does not
     load them.
   - It never edits `config.toml`.
   - Running it again changes nothing ("up to date").

   Use `--grok-home <dir>` if your Grok home is not `~/.grok` and `$GROK_HOME` is not set.

4. **Add the status line.** The installer prints the exact lines. Paste them into `~/.grok/config.toml`:

   ```toml
   [ui.status_line]
   type = "command"
   command = 'node "/home/you/.grok/handoff-guard.mjs" statusline --host grok'
   ```

   This is not only for show: it is the only place Grok reports how full the context window is, and the script
   records that number for the notes (phase 2). A `[ui.status_line]` section only works in your own
   `~/.grok/config.toml`; a project's config cannot set one. If you already have a status line, you have to
   choose one of the two.

   **On Windows** the installer writes a small `~/.grok/handoff-statusline.cmd` wrapper and the `command` it
   prints is a bare path to that file, with no inner quotes:

   ```toml
   [ui.status_line]
   type = "command"
   command = 'C:/Users/you/.grok/handoff-statusline.cmd'
   ```

   A `config.toml` command string there cannot carry the inner double quotes `node "<path>" …` needs, so the
   quoted call lives inside the `.cmd` file instead. Paste whichever block the installer prints for your system.

5. **Reload, then trust the folder.** Restart Grok, or open `/hooks` and press `r`. Check that `/hooks` lists
   the handoff-guard entries under Global.

   In the interactive app, Grok holds back even your own hooks in a folder you have not trusted, and the kit
   then does nothing there, silently. The first time you open a project, Grok asks; say yes, or run
   `/hooks-trust` (or start Grok with `--trust`). The answer is kept in `~/.grok/trusted_folders.toml` and
   covers the whole repository. Your home folder and drive roots count as trusted. A headless run (`grok -p`)
   counts the folder as trusted for your own hooks, so it needs no trust step.

6. **Try it.**
   - Give a chat a small task with a few steps. Its final message should end with a `HANDOFF` block.
   - Run `node ~/.grok/handoff-guard.mjs list --host grok` in the project folder. You should see the note with
     its progress bar and next step.
   - Start a **new** Grok chat in the same folder and type `what's pending?`. The model should run the `notes`
     command (the rules file tells it to), list the note and ask which task to continue.
   - Type `carry on with it`. The model should first run the `takeover` command, then continue from the note's
     next step.
   - Go back to the old chat and ask it to edit a file. The edit should be refused, with a message saying the
     work moved and giving the `resume-here` command. Type into the chat that is still open: reopening it
     with `grok --resume` counts as coming back on purpose and lifts the mark (phase 5).

   **To run the same test headless**, as a script or another agent would, give each run a few narrow
   permissions. A headless run cannot ask you to approve a tool, and `--permission-mode acceptEdits` did not
   cover Grok's `write` tool when this was tested (Grok 1.0.70), so the run stopped. These are enough:

   ```sh
   grok -p "<prompt>" --allow Write --allow Edit --allow "Bash(node *)"
   ```

   `Bash(node *)` lets the model run the `notes` and `takeover` commands. Continue a chat with
   `grok -r <session id> -p "<prompt>" …`. For the last check, fire the `takeover` command while the old
   chat's `-r` run is already going, after its `session-start … source=resume` line appears in the trace
   log; taken over before the run starts, the resume lifts the mark and nothing is refused.

**To switch it off** for a session, set `HANDOFF_GUARD_DISABLE=1`. To remove it, delete
`~/.grok/hooks/handoff-guard.json`, `~/.grok/rules/chat-handoff.md` and the `[ui.status_line]` section.

### If you also use Claude Code

Grok reads Claude Code's files too: it runs the hooks in `~/.claude/settings.json` and reads
`~/.claude/CLAUDE.md`. If you installed the Claude Code version of this kit, both reach your Grok chats.

- **The Claude Code hooks do nothing under Grok.** Grok sets `GROK_HOOK_EVENT` for every hook it runs; the
  script sees it on a command without `--host grok` and exits at once. Your Claude Code setup keeps working.
- **The Claude Code instructions are ignored.** The Grok rules file tells the model to ignore any handoff
  instruction that names `~/.claude/handoff-guard.mjs`.
- To stop Grok loading them at all, add this to `~/.grok/config.toml` (the installer suggests it when it finds
  them):

  ```toml
  [compat.claude]
  hooks = false   # do not run ~/.claude/settings.json hooks
  agents = false  # do not read ~/.claude/CLAUDE.md
  ```

---

## 4. How each part works on Grok

The phase numbers match the Claude Code guide, which explains each design choice.

### Phase 1: the recap convention

`GROK.snippet.md` asks for the same `HANDOFF` block as the other versions. The installer writes it to
`~/.grok/rules/chat-handoff.md`. Grok loads every `*.md` directly inside `$GROK_HOME/rules/` in every project,
whether or not the folder is trusted.

### Phase 2: save a note (`Stop`, mode `stop`)

Grok's `Stop` input has `sessionId`, `cwd`, `reason`, `stopHookActive` and `lastAssistantMessage`. The script
reads the last `HANDOFF` block from `lastAssistantMessage` and writes
`~/.grok/handoff/<project>/<sessionId>.json` atomically.

Grok fires `Stop` in three cases the note must ignore:

- **at session end**, with `reason: "channel_closed"` or `"shutdown"` (Grok's documentation says a script that
  counts stops should check for `"end_turn"`);
- **inside a subagent**, where the input carries `subagentType`;
- **again after a blocking hook**, for each continuation round (see phase 7).

The script saves a note only for `end_turn` (or no `reason` at all) outside a subagent. A continuation round is
still a turn end, so the note is simply rewritten with the newest recap.

**Context size.** Grok's `transcript_path` is its own update stream, not a transcript the script can read. The
live context size reaches only the status line, as `context_window.context_tokens`. So the `statusline` mode
writes it to `~/.grok/handoff/_ctx/<sessionId>.json` each time it runs, and the `stop` mode reads it from there.
Without the status line, notes show 0 tokens.

**Recap gate.** On Grok the same `Stop` mode also makes sure a working turn ends with a recap. Grok's `Stop`
input names no "tool ran" field (`10-hooks.md` line 666 lists only `backgroundTasks` and `sessionCrons`), so the
`PostToolUse` mode drops a per-session marker under `~/.grok/handoff/<project>/_toolran/` and `stop` claims (and
deletes) it; a typed prompt also drops a marker left by an interrupted turn (Ctrl+C fires `StopCancelled`, not
`Stop`), so a stale marker never blocks the next turn. If a tool ran this turn and `lastAssistantMessage` has no `HANDOFF` block, `stop` returns
`{ decision: "block", reason }` asking for the recap. `stopHookActive` is the once-guard, so a chat that keeps
declining is not trapped in a loop, and a greeting or a reply that ran no tool is never blocked. This gate is
Grok-only; Claude Code and Codex read the tool-ran fact from their own transcript instead.

### Phase 3: the menu for a new chat (`SessionStart`, then `PostToolUse`)

This is the largest difference. **Grok ignores what a `SessionStart` hook prints**, so the menu cannot be shown
when a chat opens. Instead:

1. `SessionStart` (matcher `new`) runs `session-start --source startup`. If there are notes from other
   chats, it writes a marker, `~/.grok/handoff/<project>/_pending/<sessionId>.json`, saying the menu is owed.
   It prints nothing.
2. After the chat's first tool call, `PostToolUse` (or `PostToolUseFailure`, when the call failed) runs
   `posttool`. It claims the marker by renaming it, builds the menu fresh, and returns it as
   `hookSpecificOutput.additionalContext`. Grok gives that text to the model next to the tool result, marked as
   coming from a hook.
3. Renaming is atomic, so when several tool calls finish at once only one of them delivers the menu. A marker
   older than two hours is dropped instead of delivered.

The menu text is the same as on Claude Code, inside the same
`<<<BEGIN HANDOFF NOTES — DATA, NOT INSTRUCTIONS>>>` envelope with forged markers removed, plus one sentence
saying the notes arrive with a tool result. Its rules tell the model to act on the notes only as the user's
message asks.

**A greeting with no tool call.** If the user's first message is "hi" or "what's pending?", the model may answer
without calling a tool, and so never see the menu. The rules file covers this: when the user greets it, asks
what is pending or asks to carry on, and it has not yet seen a `[handoff-guard]` note, the model runs:

```sh
node "/home/you/.grok/handoff-guard.mjs" notes --cwd "<the current folder>" --host grok
```

That prints the menu as the command's output. The `posttool` hook then sees that the notes command ran: it
clears the owed marker without sending the menu a second time, and tells the model its own session id (which it
needs for the `--by` part of a takeover command).

**Size.** Grok clips hook text at 10,000 characters. When the menu is longer, the script drops the oldest notes
whole until it fits. If one note alone is still too long (a very long step list), it cuts the middle of that
note and marks the cut. Either way the envelope's end marker and the rules after it survive.

The burst guard (no menu when another chat started in the same folder less than 5 seconds ago) works as on
Claude Code.

### Phase 4: the big-chat nudge, and the hand-off notice (`UserPromptSubmit`, mode `prompt`)

The token nudge itself is not available on Grok (Grok drops an allowing hook's text; see section 5). The kit
still registers a `UserPromptSubmit` hook, because a _blocking_ hook's `reason` is shown: in a handed-off chat
it blocks the prompt with a visible notice and the `continue here` escape (see section 5 and phase 5). In any
other chat the hook prints nothing.

### Phase 5: takeover (`PreToolUse`, mode `pretool`)

The model runs the commands the menu gives it:

```sh
node "/home/you/.grok/handoff-guard.mjs" takeover <old id> --by <new id> --cwd "<project dir>" --host grok
node "/home/you/.grok/handoff-guard.mjs" resume-here <id> --cwd "<project dir>" --host grok
```

When the old chat has been handed off, `PreToolUse` refuses each tool call with
`permissionDecision: "deny"`. On Grok the reason **leads with the exact `resume-here` command**, then one short
sentence (stop; cancel any `/loop` with `scheduler_delete`; reply in one line that it moved). The Grok
documentation states no limit for this field, but in a live run (2026-10-30) the model saw about 330 of a
540-character reason, so the command goes first and the whole reason stays under 300 characters (283 for an
80-character working directory). Three calls are let through:
`scheduler_list` and `scheduler_delete` (so a `/loop` can be found and cancelled) and a `run_terminal_command`
call that runs `resume-here`; the path may be single- or double-quoted (`['"]?` in the allow pattern).

When you come back to a handed-off chat with `grok --resume`, `SessionStart` (matcher `load`) lifts the mark,
and the next tool result tells the model it may continue. **Lifting the mark hands the work back:** the chat
that took over (`by` in the old mark) is itself marked handed-off to this one, so the two never both run. The
same hand-back happens from `resume-here` and from the `continue here` prompt escape. This is Grok-only — on
Claude Code and Codex, resuming just lifts the mark, exactly as before.

### Phase 6: compaction (`PostCompact`, mode `compacted`)

Grok's documentation names `PostCompact` and its matcher (`manual` or `auto`) but does not list its input
fields. The `compacted` mode therefore does two things:

- it always marks the chat's own last recap as owed, so the next tool result carries it back, inside the data
  envelope and labelled as orientation only;
- if the input does carry a summary (it looks for `summary`, `compact_summary`, `compaction_summary`,
  `summary_text`, then the longest text field), it stores that on the note, as on Claude Code.

The trace log records the field names it received (`keys=…`), so you can see what your Grok version sends.

### Phase 7: the completion gate (`Stop`, mode `complete-check`)

The gate is the same code as on Claude Code. When the recap's bar is at 100%:

- on every pass, each doc named in the docs step must have really changed, according to git;
- on the first pass only, a missing docs step or memory step blocks once with a reminder.

It blocks by printing `{"decision": "block", "reason": "..."}`. Grok then keeps the turn going and gives the
model the reason; on that round `stopHookActive` is true. Grok overrides a `Stop` gate after 8 continuations in
one turn, so a gate that keeps blocking cannot hold a turn open for ever. Like the note writer, the gate ignores
session-end and subagent stops.

Both `Stop` entries sit in one group. Their timeouts are set explicitly (15 and 30 seconds).

### Phase 8: hardening

Everything in the Claude Code checklist applies unchanged: every mode exits 0, writes are atomic, credentials
are redacted before a note is written, the regular expressions are bounded, file names are made safe, the log
rotates at 1 MB and `HANDOFF_GUARD_DISABLE=1` switches it all off.

Grok-specific points:

- **Explicit timeouts.** `PostToolUse` hooks default to a 600-second timeout in Grok. The `posttool` entry sets
  10 seconds, and returns at once when nothing is owed, because it runs after every tool call.
- **No double run.** The Claude Code hooks that Grok runs through its compatibility layer exit at once (see
  "If you also use Claude Code" in section 3).
- **Quoted absolute paths** with forward slashes, which work in every shell Grok may use.
- **Policy can switch it off.** An organisation's managed policy (`allowManagedHooksOnly`) disables hooks in
  `~/.grok/hooks/`. If `/hooks` shows the entries as disabled by policy, the kit cannot run there.

---

## 5. What Grok cannot do here, and what replaces it

**The menu cannot be shown when a chat opens.** Grok ignores `SessionStart` output. The menu reaches the model
with its first tool result, or as the output of the `notes` command (phase 3). You, the person, do not see the
"Notes from 1 recent chat" line Claude Code shows; ask "what's pending?" instead.

**No big-chat nudge.** On Claude Code and Codex, `UserPromptSubmit` warns when a chat passes 200,000 tokens. Grok
discards the text of a `UserPromptSubmit` hook that _lets the prompt through_ (`10-hooks.md` line 689), so the
token nudge cannot be shown and the kit does not raise it on Grok. Watch the status line gauge instead; Grok
also compacts on its own as the window fills.

**The handed-off message is shown — by blocking.** A hook that _blocks_ a prompt does have its `reason`
surfaced, so the kit does register a `UserPromptSubmit` hook (mode `prompt`) for the one case that matters: in a
handed-off chat it blocks your prompt with a visible `This chat was handed off to a newer chat (<age>). Carry on
there, or type: continue here` (after a hand-back: `This chat was handed back to the chat that started it (<age>)…`, gap 89). The old chat is now told before it touches a tool, not only when a tool is
refused. Typing `continue here` lifts the mark (and hands the work back); any other prompt is blocked again. In
a chat that was _not_ handed off the hook prints nothing — it never carries the token nudge.

**Token counts come only from the status line.** If you do not install the status line, notes record 0 tokens
and the gauge is missing; everything else still works.

**Grok's start sources have their own names.** Grok's `SessionStart` matcher is `new` for a fresh chat
(including `/new` and `/clear`) and `load` for a saved one reopened with `--resume`, `--continue` or
`/resume`. Claude Code's `startup` and `resume` never match, so a hook file copied from Claude Code runs
nothing at chat start, with no error. An earlier version of this kit had exactly that bug.

**Two input fields are not documented.** Grok's documentation does not name the `SessionStart` field that holds
the start source, or list the `PostCompact` fields. The kit does not depend on either: each `SessionStart`
entry passes the source on the command line (`--source startup` for `new`, `--source resume` for `load`),
and `PostCompact` always re-attaches the chat's own recap.

---

## 6. Testing it properly

```sh
node --test handoff-guard.test.mjs handoff-guard.codex.test.mjs handoff-guard.grok.test.mjs   # 64 tests
node mutate.mjs                                                                               # proves they can fail
```

The Grok tests run the real script as a child process with `--host grok`, with Grok's camelCase input, against
a throwaway home folder and a throwaway git repo. They check:

- notes live under `~/.grok/handoff` (or `$GROK_HOME/handoff`), never under `~/.claude` or `~/.codex`;
- session-end and subagent stops are ignored by both the note writer and the gate;
- `session-start` prints nothing, and the first tool result (success or failure) carries the menu exactly once,
  including when four tool calls finish at once; a marker older than two hours is dropped;
- the `notes` command prints the menu, and the next tool result then adds only the session id;
- after compaction the next tool result carries the chat's own recap inside exactly one envelope, with forged
  markers removed;
- takeover refuses tools with Grok wording, leads the deny reason with the `resume-here` command and keeps it
  within 300 characters for an 80-character working directory, lets `scheduler_list`, `scheduler_delete` and a
  single- or double-quoted `resume-here` through, and resuming hands the work back to the chat that took over;
- in a handed-off chat the `prompt` hook blocks with a visible notice; `continue here` lifts the mark (and
  hands the work back); with no mark the `prompt` hook prints nothing (no token nudge on Grok);
- a turn that ran a tool but has no `HANDOFF` recap is blocked once by the `stop` gate; `stopHookActive`
  suppresses a second block; a recap, or a reply that ran no tool, is never blocked;
- the status line reads Grok's `context_window` fields (and computes the percentage when Grok omits it), never
  reads Grok's update stream as a transcript, and caches the size that the next note records;
- a menu over 10,000 characters drops its oldest notes whole, and a single oversized note is cut in the middle,
  keeping the rules in both cases;
- the Claude Code hooks do nothing when Grok runs them;
- the example in `GROK.snippet.md` parses (title, 2/5, 40%, no line over 80 characters);
- `grok-hooks.json` has the documented shape, names only real modes, uses Grok's `SessionStart` matchers
  (`new`, `load`) rather than Claude Code's, and gives each the matching `--source`;
- the installer's dry run writes nothing; a real run writes its three files and never `config.toml`, is
  idempotent, backs up a changed file under a name Grok does not load, prints the status line to add, and
  reports Claude Code files and duplicate hook entries;
- on Windows the installer writes a fourth file, the `handoff-statusline.cmd` wrapper (exact bytes: `@echo off`,
  CRLF, the backslashed node call), and the status line it prints is a bare quoted path to it with no inner
  quotes; off Windows there is no `.cmd` and the status line is the quoted node call.

**Mutation testing.** `mutate.mjs` copies the whole kit to a temporary folder, checks that the unmutated copy
passes all three test files, then applies 96 mutations one at a time (14 shared guards, 12 Codex guards, 1 Codex
hooks guard, 39 Grok guards, 3 Grok hook-file guards, and 5 Codex, 10 Grok and 12 Claude installer guards). Each
must be `KILLED` (a test failed). `SURVIVED` means no test
noticed; `MISSING` means the code it targets has changed. One guard is not covered by a mutation: the atomic
claim when tool calls finish at once. The test runs four `posttool` calls at the same moment and checks that the
menu arrives once, but it cannot force the two processes to collide, so a weaker claim could still pass it.

### Before you rely on it

These are the parts no test can check, because they depend on the Grok version you run. Do them once:

1. Run `/hooks` and check the handoff-guard entries are listed under Global and are not disabled by policy,
   and that the folder is trusted (quick start, step 5).
2. Start a chat, ask it to read a file, then open `~/.grok/handoff/_trace.log`. You should see a
   `session-start … source=startup` line and a `posttool` line.
3. Leave a recap in one chat, start a second chat and ask it to read a file. The model should mention the note.
   This confirms Grok passes `PostToolUse` context to the model.
4. Run `/compact` in a chat with a note, then check the trace log's `compacted … keys=` line to see which fields
   your Grok version sends.
5. Check that the status line shows `ctx` with a real number and that `~/.grok/handoff/_ctx/` gains a file.

If any of these fails, the trace log is the first place to look (section 8).

---

## 7. Reference

### Hooks: input used and output printed

| Event (mode)                                      | Input fields used                                                                      | Output                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `Stop` (`stop`)                                   | `sessionId`, `cwd`, `reason`, `subagentType`, `stopHookActive`, `lastAssistantMessage` | writes the note; (Grok) `{ decision: "block", reason }` if a tool ran but no recap |
| `Stop` (`complete-check`)                         | `cwd`, `reason`, `subagentType`, `stopHookActive`, `lastAssistantMessage`              | `{ decision: "block", reason }` or nothing                                         |
| `UserPromptSubmit` (`prompt`)                     | `sessionId`, `cwd`, `prompt`                                                           | (Grok, handed off) `{ decision: "block", reason }`; else nothing                   |
| `SessionStart` (`session-start --source startup`) | `sessionId`, `cwd`                                                                     | none (writes the owed marker)                                                      |
| `SessionStart` (`session-start --source resume`)  | `sessionId`, `cwd`                                                                     | none (lifts the mark, hands the work back, writes the owed marker)                 |
| `PreToolUse` (`pretool`)                          | `sessionId`, `cwd`, `toolName`, `toolInput.command`                                    | `hookSpecificOutput.permissionDecision: "deny"` + reason, or nothing               |
| `PostToolUse`, `PostToolUseFailure` (`posttool`)  | `sessionId`, `cwd`, `hook_event_name`, `toolInput.command`                             | `additionalContext` (with `hookEventName`); (Grok) marks that a tool ran           |
| `PostCompact` (`compacted`)                       | `sessionId`, `cwd`, any summary field                                                  | none (writes the owed marker, stores a summary if one is sent)                     |
| status line (`statusline`)                        | `session_id`, `workspace.current_dir`, `model.display_name`, `context_window`          | one line of text                                                                   |

### Files

| Path                                                  | Meaning                                                                      |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| `~/.grok/handoff-guard.mjs`                           | The installed script                                                         |
| `~/.grok/hooks/handoff-guard.json`                    | The hook wiring                                                              |
| `~/.grok/rules/chat-handoff.md`                       | The recap convention and handoff rules                                       |
| `~/.grok/handoff-statusline.cmd`                      | Windows only: the status-line wrapper the `config.toml` command points at    |
| `~/.grok/handoff/<project>/<sessionId>.json`          | One note per chat; the fields are listed in the Claude Code guide, section 8 |
| `~/.grok/handoff/<project>/takeover/<sessionId>.json` | The handed-off mark `{ by, at }`; expires after 7 days                       |
| `~/.grok/handoff/<project>/_pending/<sessionId>.json` | Text owed to the chat's next tool call `{ kind, at }`; dropped after 2 hours |
| `~/.grok/handoff/<project>/_toolran/<sessionId>.json` | Grok only: marks that a tool ran this turn, for the `stop` recap gate        |
| `~/.grok/handoff/_ctx/<sessionId>.json`               | The chat's context size, as the status line last saw it                      |
| `~/.grok/handoff/<project>/_starts.json`              | Recent chat start times, for the burst guard                                 |
| `~/.grok/handoff/_trace.log`                          | One line per hook run; rotates at 1 MB                                       |

All of these move with `$GROK_HOME`.

---

## 8. Troubleshooting

| Symptom                                     | Likely cause and fix                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Nothing happens at all                      | The folder is not trusted (run `/hooks-trust`), Grok was not restarted after the install, or a managed policy disables `~/.grok/hooks`. `/hooks` shows which.            |
| A new chat never mentions the notes         | It has not called a tool yet, and the user did not greet it or ask what is pending. Ask "what's pending?". Also: notes older than 72 hours, another folder, or no recap. |
| The menu arrives twice                      | The model ran the `notes` command through something other than `run_terminal_command`, so the hook did not recognise it. Harmless.                                       |
| No note is written                          | The final message had no `HANDOFF` block, or the turn did not end normally. Check `_trace.log` for `stop` lines.                                                         |
| Notes show 0 tokens                         | The status line is not installed, or it points at another script. Add the `[ui.status_line]` section (quick start, step 4).                                              |
| Notes land in `~/.claude/handoff`           | A hook command is missing `--host grok`. Re-run `node install-grok.mjs --write`.                                                                                         |
| Each hook seems to run twice                | Another file in `~/.grok/hooks/`, or a `[[hooks.…]]` table in `config.toml`, also names `handoff-guard.mjs`. The installer warns about both.                             |
| The old chat still answers after a takeover | Expected: Grok cannot add text to a prompt (section 5). Its tool calls are refused.                                                                                      |
| The gate keeps blocking                     | The docs step names a file git says did not change. Edit it, tick the commit that changed it, or use "none affected" if that is true. Grok ends the turn after 8 rounds. |
| The compacted chat does not get its recap   | It has not called a tool since compacting, or it has no note yet.                                                                                                        |

---

## 9. Sources

The Grok behaviour this kit relies on comes from the Grok Build user guide, checked on 2026-10-29. The guide
ships inside Grok (Grok extracts it to `~/.grok/docs/user-guide/` on launch) and is published in the
`xai-org/grok-build` repository under `crates/codegen/xai-grok-pager/docs/user-guide/`, and at
<https://docs.x.ai/build>:

- `10-hooks.md` (<https://docs.x.ai/build/features/hooks>): hook locations and folder trust, events and
  matchers (including the `new` and `load` start sources),
  camelCase input, `SessionStart` output being ignored, `PostToolUse` and `PostToolUseFailure` output, the
  10,000-character clip, the `Stop` `reason` values and `subagentType`, the 8-continuation limit, timeouts,
  `GROK_HOOK_EVENT`, and `allowManagedHooksOnly`.
- `25-status-line.md` (<https://docs.x.ai/build/features/status-line>): the `[ui.status_line]` setting, its
  10-second timeout, the `context_window` fields, and `transcript_path` being Grok's own update stream.
- `12-project-rules.md`: `$GROK_HOME/rules/*.md` loaded in every project, and the Claude compatibility cells.
- `05-configuration.md` (<https://docs.x.ai/build/settings>): `$GROK_HOME` and `[compat.claude]`.
- `04-slash-commands.md` and `17-sessions.md`: `/hooks`, `/hooks-trust`, `/compact`, `--resume`,
  `scheduler_list` and `scheduler_delete`.

Grok changes quickly. If something here disagrees with the documentation for your version, trust the
documentation, and update the test that encodes the old behaviour.
