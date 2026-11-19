---
name: note
description: Append findings from the current conversation to a personal cheatsheet text file. Use when the user types /note, optionally followed by a topic or the exact text to record.
---

# /note — personal cheatsheet writer

Cheatsheet file: `C:\Users\User\Documents\ClaudeNotes\playwright-cheatsheet.txt`
(outside every repo, so it is never committed).

## Steps

1. Decide what to record:
   - If the user gave text or a topic after `/note`, record that (expand it into a short, accurate note).
   - If they typed `/note` alone, record the most recent findings from this conversation: what was learned, commands that worked, file paths, gotchas.
2. Only write facts that were verified in this conversation (a command that ran, a file that was read). Do not invent. If something was a guess, mark it "(unverified)".
3. Create the folder and file if missing (the Write/Bash tools can do this). Never overwrite existing content — read the file first and APPEND.
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

   Use today's date. Keep each entry under about 12 lines. Plain ASCII, no markdown, no tables.
5. If the same topic already exists in the file, append the new lines under a new dated entry rather than editing old text.
6. Never write secrets: no passwords, tokens, API keys or resolved `op://` values. `op://` reference paths are fine.
7. Reply with one line: the file path and the topic written. Do not paste the whole file back.

## Optional sub-commands

- `/note show` — print the last 40 lines of the file.
- `/note find <word>` — grep the file for the word and show matches.
