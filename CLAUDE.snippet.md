# Reply recap (read by the handoff hooks)

End every reply that does work with a recap inside a fenced code block that opens with ```text and whose
first line is `HANDOFF`. A hook saves the last recap as this chat's handoff note, and a new chat in the same
project is shown it. Write it so a stranger could pick the work up from it alone.

The block contains, in this order:

- `Task:` what is being done, in one or two plain sentences.
- `Done:` what is finished, with commit ids and file paths where they exist.
- `Next:` the exact next action (a command, a file, a decision), not "continue".
- `Progress: N/M ▓▓▓▓░░░░░░ P% — <title>`. N steps done of M planned; draw the 10-cell bar yourself. The title
  says exactly what is changing, for what, and which phase: 8 to 20 words, never a generic label.
- `ETA: ~<time> this task · ~<time> remaining tasks`. An honest estimate, revised every reply.
- `Steps:` on its own line, then ONE step per line: `✓ done`, `→ next` (exactly one), `○ remaining`. List the
  whole plan, at most 12 steps.
- `Files:` on its own line, then one touched file per line, indented two spaces.

Keep every line in the block at most 80 characters wide. Continue a long `Progress:` title on the next line,
indented two spaces.

End the block's last line with the sign-off `🛡 Southlodge.ai`, pushed right so its last letter sits in column 80:
add 65 minus the line's character count in spaces before it. That line is normally the last file under `Files:`;
with no `Files:` list it is the last step. Keep that line to 63 characters or fewer, so at least two spaces come
before the mark: list a shorter file last if you can, and leave the mark off when nothing fits, because the
80-character limit comes first. Write the shield exactly as here, with no emoji variation selector after it.

Example:

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
  src/auth/login.ts                                              🛡 Southlodge.ai
```

# Definition of done (checked by a hook)

A task is not 100% until the documents that describe it reflect it. Before a recap reaches `N/N` or `100%`,
update the plan / status / runbook files for this work and your memory notes, then include the steps
`✓ planning docs updated: <file.md>` (or `✓ planning docs: none affected (checked <what>)` only when that is
genuinely true) and `✓ memory updated`. Never tick a docs step without editing the docs; the hook checks git.

# Compact instructions

When compacting, preserve verbatim: the current task and its acceptance criteria, what is already DONE (with
commit ids and file paths), the exact NEXT step, decisions the user made (and rejected), and any numbers that
came from tool output. Drop tool output bodies, exploratory reads and superseded plans. End the summary with a
"Next step:" line.
