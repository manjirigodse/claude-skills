---
name: note
description: Append findings from the current conversation to a personal cheatsheet text file, and sync it across devices. Use when the user types /note, optionally followed by a topic, the exact text to record, or a sub-command (show, find, sync).
---

# /note - personal cheatsheet writer

Cheatsheet file: `$HOME/.claude/skills/notes/playwright-cheatsheet.txt`
(Windows: `C:\Users\<you>\.claude\skills\notes\playwright-cheatsheet.txt`; macOS: `~/.claude/skills/notes/...`)

It lives inside the private skills repo (`~/.claude/skills` is a git repo), so it is never part of any work repo.
Writing a note only edits the local file. Nothing is pushed until the user runs `/note sync`.

## Steps

1. Decide what to record:
   - If the user gave text or a topic after `/note`, record that (expand it into a short, accurate note).
   - If they typed `/note` alone, record the most recent findings from this conversation: what was learned, commands that worked, file paths, gotchas.
2. Only write facts that were verified in this conversation (a command that ran, a file that was read). Do not invent. If something was a guess, mark it "(unverified)".
3. Create the folder and file if missing. Never overwrite existing content - APPEND only (e.g. `cat >> file <<'EOF'`).
4. Append one entry in this exact plain-text format, newest at the bottom:

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
5. If the same topic already exists in the file, append a new dated entry rather than editing old text (keeps merges between devices clean).
6. Never write secrets: no passwords, tokens, API keys or resolved `op://` values. `op://` reference paths are fine. This file is pushed to GitHub on sync.
7. Reply with one line: the file path and the topic written. Do not paste the whole file back.

## Sub-commands

- `/note show` - print the last 40 lines of the file.
- `/note find <word>` - grep the file for the word and show matches.
- `/note sync` - share the cheatsheet across devices:
  1. `git -C ~/.claude/skills pull --rebase --autostash` (the `.gitattributes` union rule keeps lines from both devices)
  2. `git -C ~/.claude/skills add notes/` then commit `Update notes` only if there are changes
  3. `git -C ~/.claude/skills push`
  4. Report: pulled N new lines / pushed / already up to date. If the pull fails, show the error and stop - do not force-push.
