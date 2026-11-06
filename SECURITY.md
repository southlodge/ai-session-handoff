# Security

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private report form:
<https://github.com/southlodge/ai-session-handoff/security/advisories/new>. If that form is not available to
you, use the form at <https://southlodge.ai/contact>, choose Security & Compliance,
and say it concerns this repository.

You will get an acknowledgement within five working days. Fixes ship as a new release with a note in the
advisory; you will be credited unless you ask not to be.

## What the kit does and does not touch

- It runs only as hooks of your own coding tool, as your own user, on your own machine.
- It reads what the tool passes to a hook on standard input and writes hand-off notes as JSON files under the
  tool's home folder (`~/.claude/handoff`, `~/.codex/handoff`, `~/.grok/handoff`).
- It makes no network calls and has no dependencies. There is no telemetry.
- The installers are a dry run until you add `--write`; with it, they back up every file before changing it.

## What counts

Anything that lets a note, a recap or a hook input make the script do something other than read notes, write
notes and print text: for example, a crafted recap that runs a command, escapes the handoff folder, or alters a
file the installer promised to keep. Anything that makes the installer change a file it did not list in its dry
run. Secrets reaching a note: the recap gate strips obvious keys and connection strings, and a way past that is a
bug.

## Supported versions

The latest release and the `main` branch.
