# Build your own chat handoff for OpenAI Codex

This guide shows you how to set up the chat handoff system for the OpenAI Codex CLI. It uses the same script as
the Claude Code version. Once it is in place:

- every Codex chat leaves a short note when it finishes a turn;
- a new chat in the same project folder is shown those notes and can carry on where one stopped;
- the chat that handed its work over is told to stop, and its tools are refused;
- a reply that claims a task is 100% done is checked before Codex accepts it;
- after Codex compacts a chat, that chat gets its own last recap back.

You need one Node script, four hook entries in `~/.codex/hooks.json` and a reply convention in
`~/.codex/AGENTS.md`. There is no server or database, and nothing to install from npm.

**Where this fits.** The design and the reasons behind it are explained once, in
[BUILD-YOUR-OWN-CHAT-HANDOFF.md](BUILD-YOUR-OWN-CHAT-HANDOFF.md) (the Claude Code guide), phases 1 to 8. This
guide covers what is different on Codex, how to install it, and how to test it. Read the Claude Code guide
when you want to know why a rule exists.

---

## Contents

1. [What maps to what](#1-what-maps-to-what)
2. [What is in the kit](#2-what-is-in-the-kit)
3. [Quick start](#3-quick-start)
4. [How each part works on Codex](#4-how-each-part-works-on-codex)
5. [What Codex cannot do here, and what replaces it](#5-what-codex-cannot-do-here-and-what-replaces-it)
6. [Testing it properly](#6-testing-it-properly)
7. [Reference](#7-reference)
8. [Troubleshooting](#8-troubleshooting)
9. [Sources](#9-sources)

---

## 1. What maps to what

| Piece                      | Claude Code                      | Codex                                                                 |
| -------------------------- | -------------------------------- | --------------------------------------------------------------------- |
| Reply convention           | `~/.claude/CLAUDE.md`            | `~/.codex/AGENTS.md` (or `AGENTS.override.md`)                        |
| Hook wiring                | `~/.claude/settings.json`        | `~/.codex/hooks.json` (or an inline `[hooks]` table in `config.toml`) |
| Script location            | `~/.claude/handoff-guard.mjs`    | `~/.codex/handoff-guard.mjs`                                          |
| Note store                 | `~/.claude/handoff/`             | `~/.codex/handoff/` (moves with `$CODEX_HOME`)                        |
| Save a note                | `Stop` (async)                   | `Stop`                                                                |
| Completion gate            | `Stop` (sync)                    | `Stop`, in the same group as the note writer                          |
| Menu for a new chat        | `SessionStart`                   | `SessionStart`                                                        |
| Handed-off message         | `UserPromptSubmit`               | `UserPromptSubmit`                                                    |
| Refuse tools after handoff | `PreToolUse`                     | `PreToolUse`                                                          |
| Keep compaction context    | `PostCompact` stores the summary | `SessionStart` with source `compact` re-attaches the recap            |
| Progress at a glance       | a command status line            | `handoff-guard.mjs list` (Codex has no command status line)           |
| Turn a hook on             | edit settings, restart           | edit hooks.json, then **trust** it in `/hooks`                        |

The script decides which host it is serving from one flag. Every Codex hook command ends with `--host codex`;
without it the script behaves as the Claude Code version. The flag changes three things:

- **where it keeps files**: `$CODEX_HOME`, else `~/.codex`, instead of `~/.claude`;
- **the commands it tells the model to run**: they point at `~/.codex/handoff-guard.mjs` and carry `--host codex`,
  so the next chat's command reaches the same note store;
- **the wording**: Codex has no `ScheduleWakeup` or loop tools, so the handed-off message just says "reply in
  one line and stop".

---

## 2. What is in the kit

| File                           | What it does                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `handoff-guard.mjs`            | The script, shared with Claude Code and Grok: Node built-ins only                |
| `codex-hooks.json`             | The four Codex hook entries, with a `__HANDOFF_GUARD__` placeholder for the path |
| `install-codex.mjs`            | Copies the script into `~/.codex` and merges the hooks; dry run by default       |
| `AGENTS.snippet.md`            | The recap convention, the handoff rules and the definition of done, for Codex    |
| `handoff-guard.codex.test.mjs` | 16 tests for the Codex side, including every JSON shape the hooks print          |
| `handoff-guard.test.mjs`       | 21 tests for the Claude Code side (run all three; they share one script)         |
| `mutate.mjs`                   | Breaks each guard in turn and checks that a test notices (section 6)             |

---

## 3. Quick start

**You need:** a recent Codex CLI (hooks are on by default in current versions), Node.js 18 or later, and git.

1. **Run the tests** from the kit folder. They use a throwaway home folder and never touch your real
   `~/.codex`:

   ```sh
   node --test handoff-guard.test.mjs handoff-guard.codex.test.mjs handoff-guard.grok.test.mjs
   ```

   All 67 should pass. (The Grok file is there because the Grok version shares the same script.)

2. **See what the installer would change.** With no flags it only reports:

   ```sh
   node install-codex.mjs
   ```

   It prints where the script will go, whether `hooks.json` will be created or merged, how many of your own
   hooks it keeps, and a warning if `config.toml` switches hooks off.

3. **Install:**

   ```sh
   node install-codex.mjs --write
   ```

   - It copies `handoff-guard.mjs` to `~/.codex/handoff-guard.mjs`.
   - It merges our four entries into `~/.codex/hooks.json`, writing the script's absolute path into each command.
   - Before changing an existing `hooks.json` it saves a copy next to it (`hooks.json.bak-<date>-<time>`).
   - It keeps every hook that is not ours. It replaces any earlier entry of ours, even one that points at an
     old location.
   - Running it again changes nothing ("up to date").

   Use `--codex-home <dir>` if your Codex home is not `~/.codex` and `$CODEX_HOME` is not set.

4. **Trust the hooks.** Start Codex and run `/hooks`. Review the four handoff-guard entries and trust them.
   Codex skips a hook it has not been told to trust. Trust is recorded against each hook entry, so a changed
   entry has to be trusted again. `codex exec` (a headless run) uses the same record and has no prompt of its
   own, so trust the hooks in the interactive app before testing headless.

   In VS Code the same trust lives in a panel. The hook icon with an orange dot, beside "Ask for approval"
   (its tooltip reads "Review hooks · N need approval"), opens a "Review hooks" dialog. Tick **only** the
   entries named "Handoff: …" — that name is the `statusMessage` on each of our hooks — and click "Allow
   selected". Never "Allow all": other installed plugins add their own untrusted hooks to the same list. The
   GitKraken `gitkraken-hooks` plugin, for one, brings 22 `gk.exe ai hook run` hooks, which have hung chats for
   hours. Codex ties each approval to the hook's exact text, so a changed hook comes back marked "Modified" and
   has to be approved again — re-running `install-codex.mjs` after an update therefore re-asks.

5. **Add the convention.** Paste `AGENTS.snippet.md` into `~/.codex/AGENTS.md`, the global instructions file that
   applies in every project. If you keep a `~/.codex/AGENTS.override.md`, Codex reads that file instead, so paste
   the snippet there.

6. **Optional: let the takeover command run without a prompt.** In the `workspace-write` sandbox the model
   cannot write outside the project, and the takeover command writes to `~/.codex/handoff`. Either approve it
   when asked, or add the folder to `config.toml`:

   ```toml
   [sandbox_workspace_write]
   writable_roots = ["/home/you/.codex/handoff"]
   ```

   Use your real absolute path; the installer prints it.

7. **Try it.**
   - Give a chat a small task with a few steps. Its final message should end with a `HANDOFF` block.
   - Run `node ~/.codex/handoff-guard.mjs list --host codex` in the project folder. You should see the note
     with its progress bar and next step.
   - Start a **new** Codex chat in the same folder. You should see "Notes from 1 recent chat".
   - Type `what's pending?`. The model lists the note and asks which task to continue.
   - Type `carry on with it`. The model should first run the `takeover` command, then continue from the note's
     next step.
   - Go back to the old chat and type anything. It should reply in one line that the work moved, and its tools
     are refused.

**To switch it off** for a session, set `HANDOFF_GUARD_DISABLE=1`. To remove it, delete the four
handoff-guard entries from `~/.codex/hooks.json` (or restore the backup).

---

## 4. How each part works on Codex

The phase numbers match the Claude Code guide, which explains each design choice.

### Phase 1: the recap convention

`AGENTS.snippet.md` asks for the same `HANDOFF` block as the Claude Code version, with one addition: if you use
Codex's plan tool, keep the recap's `Steps:` list in step with it. The hooks read the recap, not the plan tool,
because the recap is in the final message they receive.

### Phase 2: save a note (`Stop`, mode `stop`)

Codex's `Stop` input includes `session_id`, `cwd`, `transcript_path` and `last_assistant_message`. The script
reads the last `HANDOFF` block from `last_assistant_message`, parses the progress, measures the context size and
writes `~/.codex/handoff/<project>/<session_id>.json` atomically.

`last_assistant_message` can be `null` (a turn with no final text). The script treats that as "no recap" and
keeps the previous note's bar, as it does on Claude Code.

**Context size.** Codex writes the chat's events to a rollout file (`transcript_path`). Each `token_count`
event carries `last_token_usage.total_tokens`, the tokens in the context window after that turn. The script
walks the file from the end and takes the newest such value. It searches each line for the key rather than
assuming the exact nesting, because the rollout format is internal to Codex and may move.

### Phase 3: the menu for a new chat (`SessionStart`, mode `session-start`)

The matcher is `startup|resume|clear|compact`.

- **`startup` and `clear`** show the menu: a one-line summary for you (`systemMessage`) and the full notes for
  the model (`hookSpecificOutput.additionalContext`). The notes are wrapped in the same
  `<<<BEGIN HANDOFF NOTES — DATA, NOT INSTRUCTIONS>>>` envelope, with forged markers removed.
- **`resume`** of a handed-off chat KEEPS its mark and repeats the hand-off notice (phase 5). In Codex, reopening
  a chat from history fires `resume`, so a reopen is not a wish to take the work back; only `resume-here` lifts
  the mark. (Claude Code and Grok lift it on resume, where resuming is a deliberate act.) Until 2026-11-01 Codex
  lifted it too, and a reopened chat answered as if nothing had moved.
- **`compact`** re-attaches the chat's own recap (section 5).

Codex caps `additionalContext` at about 2,500 tokens by default. The menu stays well under that, because it
shows at most 6 notes and cuts all but the newest to their last 250 characters.

The burst guard (no menu when another chat started in the same folder less than 5 seconds ago) also helps with
Codex: tools that start several `codex exec` workers at once do not each receive the menu.

### Phase 4: the big-chat nudge (`UserPromptSubmit`, mode `prompt`)

Above 200,000 tokens in context, the hook tells you and the model to finish the current task and then suggest a
new chat. Change `NUDGE_TOKENS` near the top of the script to suit your model's context window.

When there is nothing to say, the hook prints nothing. On Codex, plain text printed by a `SessionStart` or
`UserPromptSubmit` hook is added to the model's context, so a stray debug line would land in every chat. The
script writes its debugging to `~/.codex/handoff/_trace.log` instead.

### Phase 5: takeover (`UserPromptSubmit` and `PreToolUse`, mode `pretool`)

The model runs the commands the menu gives it:

```sh
node "/home/you/.codex/handoff-guard.mjs" takeover <old id> --by <new id> --cwd "<project dir>" --host codex
node "/home/you/.codex/handoff-guard.mjs" resume-here <id> --cwd "<project dir>" --host codex
```

When the old chat has been handed off:

| Hook               | Effect                                                                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UserPromptSubmit` | Tells the model this chat was handed off: reply in one line that the work continues in the newer chat, and stop.                                                                                         |
| `PreToolUse`       | Refuses the tool call (`permissionDecision: "deny"`), except a shell (`Bash`) call that runs `resume-here`. The refusal gives the exact `resume-here` command, in case you really want to continue here. |
| `SessionStart`     | On a reopen from history (`resume`): keeps the mark and repeats the notice, so the reply to your first message says the work moved. A reopen is not `resume-here`.                                       |

On recent Codex versions `PreToolUse` runs before shell commands (reported as `Bash`), `apply_patch` edits and
MCP tool calls. Some older versions sent only shell commands through it, so on those the prompt message is the
only guard for file edits. Upgrade if that matters to you.

`PreToolUse` runs before every tool call, so the script returns at once when the project has no takeover folder.

### Phase 6: compaction (`SessionStart`, source `compact`)

See section 5.

### Phase 7: the completion gate (`Stop`, mode `complete-check`)

The gate is the same code as on Claude Code, with two Codex differences. When the recap's bar is at 100%:

- on every pass, each doc named in the docs step must have really changed, according to git;
- on the first pass only, a missing docs step blocks once with a reminder — but only when git shows files changed
  since this chat began (outside a git repo nothing can be verified, so the step is still asked for). Codex keeps
  no memory store, so no memory step is ever asked for.

"Since this chat began" works from a snapshot. At `SessionStart` (`startup` or `clear`) the guard writes the paths git
already shows as changed to `<store>/<project>/_start/<session-id>.json`. Files on that list — a dashboard watcher's
outputs, your own uncommitted edits — are not this chat's work, however often they change afterwards; a file that
appears or changes after the start counts. The claim check (a `planning docs updated: <file.md>` step) still looks at
every real change, so a doc you had already started editing before the chat counts as changed. A chat with no snapshot
(started before this version) counts every change. Each turn end refreshes the chat's snapshot, and a snapshot
untouched for 72 hours (the notes' age limit) is swept at the next chat start, so a chat silent for three days falls
back to counting every change. The snapshot costs one `git status` at chat start; if git fails or takes over ten
seconds, no snapshot is written and that chat counts every change.

It blocks by printing `{"decision": "block", "reason": "..."}`. Codex then keeps the turn going and gives the
model the reason. On the re-issued turn the input has `stop_hook_active: true`, which the gate uses to block
only once for the reminder.

Both `Stop` entries sit in one group with no `async` flag. Codex starts all matching hooks for an event at the
same time, so the note writer does not hold up the gate, and the gate can still block.

Dry-run the gate before you trust it with a real recap (empty output means it passes):

```sh
printf '%s' '{"session_id":"dry","cwd":"/path/to/repo","stop_hook_active":true,"last_assistant_message":"<recap>"}' \
  | node ~/.codex/handoff-guard.mjs complete-check --host codex
```

### Phase 8: hardening

Everything in the Claude Code checklist applies unchanged: every mode exits 0, writes are atomic, credentials
are redacted before a note is written, the regular expressions are bounded, file names are made safe, the log
rotates at 1 MB and `HANDOFF_GUARD_DISABLE=1` switches it all off.

Three Codex-specific points:

- **Only allowed keys.** Codex checks each hook's JSON output against a fixed list of fields and rejects unknown
  ones. The Codex tests check every JSON the script prints against those lists (section 7).
- **Quoted absolute paths.** The installer writes `node "<absolute path>"` with forward slashes, which works in
  bash, zsh, PowerShell and cmd. Codex runs hook commands in the session's working folder, so a relative path
  would break in every other project. Codex also accepts a `commandWindows` field for a Windows-only command;
  the kit does not need it.
- **Project hooks.** Codex also loads `<project>/.codex/hooks.json`, but only for projects you have trusted.
  Keep these hooks in your user-level `hooks.json`, so they run in every project.

---

## 5. What Codex cannot do here, and what replaces it

**No compaction summary hook.** Claude Code's `PostCompact` hook passes the compaction summary, and the kit
stores it on the note. Codex's compaction events do not hand the hook a summary to store. Instead, when Codex
starts the compacted chat again (`SessionStart` with `source: "compact"`), the script gives the chat its **own**
last recap back, inside the data envelope and labelled as orientation only. A chat with no note yet gets
nothing.

To steer what Codex keeps when it compacts, set `compact_prompt` in `config.toml` (or point
`experimental_compact_prompt_file` at a file). The "Compact instructions" section of `CLAUDE.snippet.md` is a
good starting text: keep the task, what is done with commit ids, the exact next step, the decisions made and
rejected, and numbers that came from tool output.

**No command status line.** Codex's `tui.status_line` setting chooses from built-in items only; it cannot run
a script. Use the `list` command instead. This is real output from the kit, for the example recap in
`AGENTS.snippet.md`:

```text
$ node ~/.codex/handoff-guard.mjs list --host codex
▓▓▓▓░░░░░░ 40% Login rate limit: per-IP throttle, lockout tests and docs for the auth endpoint
  session 019a3c7e-5b1f-7d20-9c4e-demo · 0 min ago · 143k tokens
  next: write the lockout tests
```

After a takeover, the second line ends with `· HANDED OFF to <new session id>`. A shell alias saves typing:
`alias handoffs='node ~/.codex/handoff-guard.mjs list --host codex'`.

**No loop or scheduled-wakeup tools.** Codex chats do not wake themselves up, so the Claude Code upgrade
"auto-continue" (section 6.10 of that guide) has no Codex counterpart. The takeover mark still matters: it stops
an old chat that you, or a script, come back to.

**`notify` is not a hook.** Codex's `notify` setting runs a program after each turn (`agent-turn-complete`) but
cannot block or add context. It suits a desktop notification; leave the handoff work to the hooks.

---

## 6. Testing it properly

```sh
node --test handoff-guard.test.mjs handoff-guard.codex.test.mjs handoff-guard.grok.test.mjs   # 64 tests
node mutate.mjs                                                                               # proves the tests can fail
```

The Codex tests run the real script as a child process with `--host codex`, exactly as Codex does, against a
throwaway home folder and a throwaway git repo. They check:

- notes live under `~/.codex/handoff` (or `$CODEX_HOME/handoff`), never under `~/.claude`;
- **every** JSON the script prints for Codex (menu, compact re-attach, nudge, handed-off message, tool refusal,
  resume, gate block) uses only the fields Codex accepts for that event;
- the menu's takeover command names `~/.codex/handoff-guard.mjs`, the right session ids and `--host codex`;
- compaction re-attaches the chat's own recap inside exactly one envelope, with forged markers removed;
- takeover, refusal and `resume-here` work end to end, with no Claude Code-only tool named;
- the nudge reads Codex `token_count` events;
- `list` output, the completion gate, and a `null` final message;
- the example in `AGENTS.snippet.md` parses (title, 2/5, 40%, no line over 80 characters);
- `codex-hooks.json` has the documented shape and names only real modes;
- the installer's dry run writes nothing; a real run merges, keeps other hooks, replaces stale entries, backs up
  once and is idempotent; and it refuses a `hooks.json` it cannot parse.

**Mutation testing.** `mutate.mjs` copies the whole kit to a temporary folder and first checks that the
unmutated copy passes all three test files; if it does not, it stops, because a "kill" against a copy that
already fails proves nothing. It then applies 99 mutations one at a time (the 14 shared guards, 12 Codex guards,
1 Codex hooks guard, 5 Codex installer guards, 12 Claude installer guards, and the 55 Grok guards described in
the Grok guide) and reports `KILLED` (a test failed, good), `SURVIVED` (no test noticed, bad) or `MISSING` (the
code it targets has changed; update the mutation). When you add a guard, add a mutation for it.

**Before you rely on it, check one real rollout file.** The token reader assumes the `token_count` event shape
described in phase 2. Open a file under `~/.codex/sessions/`, find a line containing `last_token_usage`, and
check that `total_tokens` is there. If your version differs, adjust `contextFromTranscript()`.

---

## 7. Reference

### Hooks: input used and output printed

| Event (mode)                     | Input fields used                                                 | Output                                                               |
| -------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| `Stop` (`stop`)                  | `session_id`, `cwd`, `transcript_path`, `last_assistant_message`  | none (writes the note)                                               |
| `Stop` (`complete-check`)        | `session_id`, `cwd`, `stop_hook_active`, `last_assistant_message` | `{ decision: "block", reason }` or nothing                           |
| `SessionStart` (`session-start`) | `session_id`, `cwd`, `source`                                     | `systemMessage` + `hookSpecificOutput.additionalContext`, or nothing |
| `UserPromptSubmit` (`prompt`)    | `session_id`, `cwd`, `transcript_path`                            | `systemMessage` + `hookSpecificOutput.additionalContext`, or nothing |
| `PreToolUse` (`pretool`)         | `session_id`, `cwd`, `tool_name`, `tool_input.command`            | `hookSpecificOutput.permissionDecision: "deny"` + reason, or nothing |

### Output fields Codex accepts (checked by the tests)

| Event              | Top-level fields                                                                  | `hookSpecificOutput` fields                                                                            |
| ------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `SessionStart`     | `continue`, `hookSpecificOutput`, `stopReason`, `suppressOutput`, `systemMessage` | `additionalContext`, `hookEventName`                                                                   |
| `UserPromptSubmit` | the above, plus `decision`, `reason`                                              | `additionalContext`, `hookEventName`                                                                   |
| `PreToolUse`       | as `UserPromptSubmit`                                                             | `additionalContext`, `hookEventName`, `permissionDecision`, `permissionDecisionReason`, `updatedInput` |
| `Stop`             | `continue`, `decision`, `reason`, `stopReason`, `suppressOutput`, `systemMessage` | (none)                                                                                                 |

### Files

| Path                                                    | Meaning                                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `~/.codex/handoff-guard.mjs`                            | The installed script                                                         |
| `~/.codex/hooks.json`                                   | The hook wiring (backups: `hooks.json.bak-<date>-<time>`)                    |
| `~/.codex/handoff/<project>/<session_id>.json`          | One note per chat; the fields are listed in the Claude Code guide, section 8 |
| `~/.codex/handoff/<project>/takeover/<session_id>.json` | The handed-off mark `{ by, at }`; expires after 7 days                       |
| `~/.codex/handoff/<project>/_starts.json`               | Recent chat start times, for the burst guard                                 |
| `~/.codex/handoff/_trace.log`                           | One line per hook run; rotates at 1 MB                                       |

All of these move with `$CODEX_HOME`.

---

## 8. Troubleshooting

| Symptom                                                                                 | Likely cause and fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nothing happens at all                                                                  | The hooks are not trusted yet (run `/hooks`), or `config.toml` has `[features] hooks = false`. The installer warns about the second.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| It worked, then stopped after a reinstall                                               | A changed hook entry must be trusted again in `/hooks`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| The old chat answers normally after you reopen it                                       | Your installed copy predates 2026-11-01, when a reopen (`resume`) still lifted the mark. Re-run `node install-codex.mjs --write` from the kit folder. The hook entries do not change, so trust should carry over; if nothing happens afterwards, trust them again in `/hooks`.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| You want to force the reopen event without quitting the app                             | Archive the chat in the app, then from the repo folder run the app's bundled binary: `codex.exe --no-daemon resume <session-id>` and choose "Unarchive and resume" — that reopen fires `SessionStart` with `source=resume`. If a "Hooks need review" prompt lists hooks that are not yours (a plugin such as GitKraken), do not press Esc (it means "continue without trusting"); rerun with `-c 'plugins."<plugin-id>".enabled=false'` so only your trusted hooks load. "This conversation is open in another app" means the app still has it open — close or archive it there first. Live-tested 2026-11-01.                                                                                                                        |
| Your 100% recap did not trigger the completion gate (the note shows a lower percentage) | The guard scores the Steps list over the `Progress:` line whenever steps are present: a `→` or `○` step keeps the chat below 100%, so `Progress: 3/3 100%` above a dangling `→ await the user's choice…` line is read as 75% and the gate never runs. At 100% every step is `✓`; the next action belongs in the `Next:` line, not in Steps. Seen live 2026-11-01.                                                                                                                                                                                                                                                                                                                                                                     |
| The gate says git shows changed files, but the chat changed nothing                     | Something else keeps the tree dirty: a dashboard or build watcher rewriting tracked files, or your own uncommitted edits. The guard counts only files changed since the chat began (the snapshot in `_start/<session-id>.json`, taken at `SessionStart`), so this happens for a chat that started before that snapshot existed, a chat silent for more than 72 hours (its snapshot was swept), a watcher that rewrote a file that was still clean when the chat started, or outside a git repo (nothing can be verified, so the step is asked for). The honest answer is one line: `✓ planning docs: none affected (checked <what>)`. Never create a document for it. Seen live 2026-11-01: 92 watcher-written JSONs in the checkout. |
| Each hook seems to run twice                                                            | The same entries are also in an inline `[hooks]` table in `config.toml`. Keep one copy; the installer warns about this.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| A new chat shows no notes                                                               | The notes are older than 72 hours; you opened a different folder; another chat started within 5 seconds (burst guard); or no earlier reply had a `HANDOFF` block.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| No note is written                                                                      | The final message had no `HANDOFF` block. Check `~/.codex/handoff/_trace.log` for `stop` lines.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| The takeover command asks for approval                                                  | The sandbox blocks writes outside the project. Approve it, or add `~/.codex/handoff` to `writable_roots` (quick start, step 6).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Notes land in `~/.claude/handoff`                                                       | A hook command is missing `--host codex`. Re-run `node install-codex.mjs --write`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| The nudge never fires in a huge chat                                                    | Your Codex version writes token counts in a different shape. Check a rollout file (section 6) and adjust `contextFromTranscript()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| The old chat edits a file after a takeover                                              | Your Codex version only sends shell commands through `PreToolUse`. Upgrade; until then, the prompt message is the only guard for edits.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| The gate keeps blocking                                                                 | The docs step names a file git says did not change. Edit it, tick the commit that changed it, or use "none affected" if that is true.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Shell commands hang, then fail (Windows)                                                | The sandbox setup is still granting access to all of `%TEMP%`. Use the Windows sandbox settings below this table.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Commands fail to write temp files (`EPERM`)                                             | `%TEMP%` is kept out of the sandbox but no temp folder replaced it. Add the `writable_roots`, `TEMP` and `TMP` lines below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| A hook times out                                                                        | Each entry has a short `timeout` (10 to 30 seconds). Raise it in `hooks.json` if your machine is slow, then trust the changed entry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Hooks never run in VS Code                                                              | They are untrusted. Open the Review hooks panel (the hook icon with an orange dot), tick the "Handoff:" entries and click Allow selected, never Allow all.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Hooks show as Hook 1, Hook 2 ...                                                        | Hook names come from each entry's `statusMessage`; the kit's five entries all carry one. Re-run `install-codex.mjs` to refresh an old copy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

**Windows sandbox settings that work.** Tested on 2026-10-30 with codex-cli 0.166.0-alpha.5.1 and
`[windows] sandbox = "elevated"`. Without the first two lines, every shell command waited 30 to 100 seconds, or
hung, while the sandbox setup granted access across all of `%TEMP%`. With them, setup took under a second per
command, but commands could no longer write to `%TEMP%`. The `writable_roots` line and the `TEMP` and `TMP`
lines give them a small temp folder of their own; create it first. The second `writable_roots` entry is the
optional handoff folder from quick start, step 6.

```toml
[sandbox_workspace_write]
exclude_tmpdir_env_var = true
exclude_slash_tmp = true
writable_roots = ['C:\Users\you\AppData\Local\CodexSandboxTemp', 'C:\Users\you\.codex\handoff']

[shell_environment_policy.set]
TEMP = 'C:\Users\you\AppData\Local\CodexSandboxTemp'
TMP = 'C:\Users\you\AppData\Local\CodexSandboxTemp'
```

If `config.toml` already has a `[shell_environment_policy.set]` table (the Codex desktop app adds one), put the
two lines in that table. A second copy of the same table header makes the file invalid. In the test run, the
model could write to the project, the temp folder and the handoff folder, and a write to the home folder was
still refused (`EPERM`).

In the VS Code panel the hooks run under the `:workspace` permission profile, which ignores the
`[sandbox_workspace_write]` block above, so its `writable_roots` lines have no effect there. The `TEMP` and
`TMP` values in `[shell_environment_policy.set]` still apply, so keep those two lines even when you work only in
the panel.

---

## 9. Sources

The Codex behaviour this kit relies on comes from the official documentation, checked on 2026-10-29:

- Hooks: events, matchers, input and output fields, trust, timeouts and concurrency:
  <https://learn.chatgpt.com/docs/hooks> (the older address `developers.openai.com/codex/hooks` redirects there).
- `config.toml` keys (`[features] hooks`, `[sandbox_workspace_write] writable_roots`, `compact_prompt`,
  `experimental_compact_prompt_file`, `tui.status_line`, `notify`):
  <https://learn.chatgpt.com/docs/config-file/config-reference> and
  <https://learn.chatgpt.com/docs/config-file/config-advanced>.
- Where `AGENTS.md` is read from: <https://learn.chatgpt.com/docs/agent-configuration/agents-md>.
- Token counts in the rollout file (`TokenUsageInfo`, `last_token_usage`) and the hook output schemas: the
  `openai/codex` repository on GitHub.

Codex changes quickly. If something here disagrees with the documentation for your version, trust the
documentation, and update the test that encodes the old behaviour.
