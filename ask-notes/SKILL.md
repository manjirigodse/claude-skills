---
name: ask-notes
description: Answer a question from the user's personal cheatsheet notes using semantic (meaning-based, not just keyword) retrieval, with citations to the entries used. Use when the user types /ask-notes <question>, or asks "what did I note about X", "how did I do X before", "do my notes say...". Read-only - never edits the notes (use /note to write).
---

# /ask-notes - ask questions of your own notes

Source: `$HOME/.claude/skills/notes/playwright-cheatsheet.txt` (written by `/note`).
Entry format: a `====` line, a `[YYYY-MM-DD] TOPIC` header, a `----` line, then `- ` bullet lines.

## Principle

The notes are the ONLY source of truth. Answer from them, cite them, and say so plainly when they do not contain the answer. Never fill gaps from general knowledge without labelling it as such.

## Steps

1. **Refresh** (ignore failure, mention "may be stale" if it fails):
   `git -C ~/.claude/skills pull --rebase --autostash`
2. **Size check**: `wc -c` on the notes file.
   - Under about 60 KB: read the whole file with Read. The model does the semantic matching itself (synonyms, paraphrase, intent). This is the default and needs no index.
   - Over that: go to "Large file mode" below.
3. **Understand the question.** Restate it internally as intent, not keywords. Consider synonyms and related terms (e.g. "healing" = fix, repair, self-heal, flaky; "login problem" = auth, credentials, OTP, SSO). If the question is ambiguous, answer the most likely reading and state the assumption.
4. **Select entries.** Pick every entry that is relevant by meaning, not only those containing the question's words. Prefer newer entries when two conflict, and say that they conflict. A later entry marked "REVISION" or "Fix:" supersedes earlier claims.
5. **Answer**, in this shape:
   - Direct answer first, 1-5 lines, in your own words, synthesised across entries when more than one applies.
   - **Sources**: list each entry used as `[date] TOPIC (line N)`. Get line numbers with `grep -n '^\[20' <file>`.
   - **Caveats** only if needed: items the notes mark `(unverified)`, conflicts between entries, or a stale pull.
6. **No match**: say "Your notes don't cover this", list the closest entries (topic + line) in case they help, and offer `/note` to record the answer once found. Do not invent an answer.
7. **Never write to the notes file** and never commit or push. Reading only.

## Large file mode (only when the file outgrows one read)

1. Build the candidate set with a wide grep, using 8-15 expanded terms from step 3:
   `grep -n -i -E 'term1|term2|...' <file>`
2. Map each hit line to its entry (the nearest `^\[20` header above it) and read only those entries with `sed -n 'A,Bp'`.
3. If fewer than 2 entries come back, widen the terms once; if still nothing, apply step 6.
4. Optional upgrade when keyword expansion keeps missing: build a local embedding index over entries (one vector per entry, stored outside the repo, e.g. `~/.claude/skills/notes/.index/`, git-ignored) and rank by cosine similarity. Not needed at current size.

## Rules

- Quote sparingly; paraphrase and cite. Commands and paths from the notes may be quoted exactly.
- Do not reveal or reconstruct anything that looks like a secret; notes should not contain any, but if one is found, flag it and suggest removing it.
- If the user wants the answer saved, hand off to `/note` instead of writing here.

## Examples

- `/ask-notes how do I fix the gh push being rejected?` -> matches gh-profiles / sync entries even though "rejected" is not in them.
- `/ask-notes which tools overlap in test healing?` -> synthesises the healer-overlap gotcha across the OVERVIEW and REVISION entries and notes the later one wins.
- `/ask-notes what do I know about kubernetes?` -> "Your notes don't cover this."
