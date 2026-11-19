---
name: note
description: Append findings from the current conversation to a personal cheatsheet text file that auto-syncs across devices via a private GitHub repo. Use when the user types /note, optionally followed by a topic, the exact text to record, or a sub-command (show, find, sync).
---

# /note - personal cheatsheet writer (auto-synced)

Cheatsheet file: `$HOME/.claude/skills/notes/playwright-cheatsheet.txt`
(Windows: `C:\Users\<you>\.claude\skills\notes\playwright-cheatsheet.txt`; macOS: `~/.claude/skills/notes/...`)

`~/.claude/skills` is a private personal git repo, so the file is never part of any work repo.
**Every `/note` syncs automatically** - the user never runs a separate sync step.

## Steps

1. **Pull first** (so appends from other devices are included):
   `git -C ~/.claude/skills pull --rebase --autostash`
   If this fails (offline, auth), note the error, continue to step 2 anyway, and say in the reply that sync is pending.
2. Decide what to record:
   - If the user gave text or a topic after `/note`, record that (expand it into a short, accurate note).
   - If they typed `/note` alone, record the most recent findings from this conversation: what was learned, commands that worked, file paths, gotchas.
3. Only write facts that were verified in this conversation (a command that ran, a file that was read). Do not invent. If something was a guess, mark it "(unverified)".
4. Create the folder and file if missing. Never overwrite existing content - APPEND only (e.g. `cat >> file <<'EOF'`).
5. Append one entry in this exact plain-text format, newest at the bottom:

```
================================================================
[YYYY-MM-DD] TOPIC IN CAPS
----------------------------------------------------------------
- Short fact or step (one line each)
- Command:  <command>
- Path:     <file path>
- Gotcha:   <thing that bit us and the fix>
```

   Use today's date. Keep each entry under about 12 lines (a diagram entry may be longer if the user asked for detail). Plain ASCII, no markdown, no tables.
6. If the same topic already exists in the file, append a new dated entry rather than editing old text (keeps merges between devices clean).
7. **Never write secrets**: no passwords, tokens, API keys or resolved `op://` values (`op://` reference paths are fine). The file is pushed to GitHub on every note, so check what you appended before step 8.
8. **Push**, touching only the notes folder:
   ```
   git -C ~/.claude/skills add notes/
   git -C ~/.claude/skills commit -m "note: <topic>"   # skip if nothing changed
   git -C ~/.claude/skills push
   ```
   If the push is rejected, run `git -C ~/.claude/skills pull --rebase --autostash` once and push again. Never force-push. If it still fails, keep the local note and say sync is pending - it will go out with the next `/note`.
9. Reply with one line: the topic written and the sync state (`synced` or `saved locally, sync pending: <reason>`). Do not paste the whole file back.

## Sub-commands

- `/note show` - print the last 40 lines of the file (pull first).
- `/note find <word>` - grep the file for the word and show matches (pull first).
- `/note sync` - only do the pull + commit + push, with no new entry. Use after being offline.

## Notes for the agent

- Commit identity comes from git routing and should be the personal profile. If `git -C ~/.claude/skills config user.email` is not the personal email, warn the user and stop before committing (run `/gh-profiles which` from that folder).
- Only `notes/` is auto-committed. Skill file edits are committed by hand, never by this skill.
