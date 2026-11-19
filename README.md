# My Claude Code user-level skills

Personal skills that load automatically in every Claude Code session (CLI and VS Code extension).
This repo IS the `~/.claude/skills` folder.

## Install on a new device (Windows or macOS)

```bash
# 1. make sure the personal SSH key for this GitHub account is set up (see gh-profiles below)
# 2. clone straight into the skills folder (back up any existing ~/.claude/skills first)
git clone git@github-personal:manjirigodse/claude-skills.git ~/.claude/skills
# 3. restart Claude Code - skills are picked up at startup
```

If the device has no SSH key for this account yet, clone with HTTPS once, then run `/gh-profiles init`:

```bash
git clone https://github.com/manjirigodse/claude-skills.git ~/.claude/skills
node ~/.claude/skills/gh-profiles/gh-profiles.mjs init
```

Update later with `git -C ~/.claude/skills pull`.

## Skills

| Skill | Command | What it does |
|---|---|---|
| `gh-profiles` | `/gh-profiles` | Work + personal GitHub over SSH: generate keys, copy public keys to GitHub, auto-route commit identity per repo, clone/switch, audit, doctor. Needs Node 18+ and git 2.36+. |
| `note` | `/note` | Appends findings from the current chat to a plain-text cheatsheet (`notes/playwright-cheatsheet.txt` in this repo). `/note sync` pulls, commits and pushes it so every device shares the same notes. |

## Notes

- `gh-profiles/profiles.json` is generated per device (folder paths differ) and is git-ignored. Defaults live in `gh-profiles.mjs`; adjust folders with `/gh-profiles route add work <dir>`.
- Never commit private keys or tokens here. The skills only ever read/print `.pub` keys.
- Keep this repo **private**: the defaults mention an employer email and org name.
