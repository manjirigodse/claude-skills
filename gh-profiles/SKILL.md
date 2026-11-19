---
name: gh-profiles
description: Manage two GitHub accounts (work + personal) over SSH on Windows or macOS - generate keys, copy public keys to GitHub, switch identity, auto-route commits to the right name/email by repo, clone with the right key, audit mismatches. Use when the user types /gh-profiles or asks about switching GitHub accounts, SSH keys per account, or wrong commit author.
---

# /gh-profiles - work + personal GitHub profiles

Everything is done by one script. Run it with Bash and show the user the output:

```
node "$HOME/.claude/skills/gh-profiles/gh-profiles.mjs" <command> [args]
```

(On Windows Git Bash `$HOME` works. The script and `profiles.json` live next to this file, outside every repo.)

## Map the user's words to commands

| User says | Run |
|---|---|
| set up / first time | `init` then tell them to run `copy work` and `copy personal` |
| copy work key / personal key | `copy work` or `copy personal` (clipboard + opens GitHub add-key page) |
| show keys | `keys` |
| does it work / activate check | `test` |
| who am I here / which profile | `which` (or `status` for the full table) |
| switch this repo to work/personal | `use work` / `use personal` (run from inside the repo; add `--no-remote` to change identity only) |
| clone as work/personal | `clone <profile> owner/repo [dir]` |
| always use work for this folder | `route add work <dir>` |
| this GitHub org is work | `org add work <org>` |
| check my repos for wrong author | `audit <dir>` |
| something is broken | `doctor` |
| regenerate config | `sync` |

With no argument, show `status` and list the commands above.

## How routing works (explain briefly if asked)

1. `init` writes two SSH host aliases (`github-work`, `github-personal`), each bound to its own key with `IdentitiesOnly yes`, into a marked block in `~/.ssh/config`.
2. It writes a marked block of `includeIf` rules in `~/.gitconfig`. A repo gets the work or personal name/email automatically when its folder is registered (`route`), its remote uses that alias, or its remote owner is a registered org/user. No manual switching is needed for normal use.
3. `~/.gitconfig` global identity is left as it was (the work identity) so existing repos keep working.

## Rules for the agent

- Never overwrite an existing key, never print a PRIVATE key. Only `.pub` files are shown or copied.
- Do not change a repo's remote or identity unless the user asked (`use`, `clone`). `use` leaves `org-<id>@github.com` SSH-certificate remotes alone unless `--remote-force`.
- Keys are generated with an empty passphrase so they work without ssh-agent (the Windows agent service is often disabled). `doctor` reports this; mention `ssh-keygen -p -f <key>` to add one.
- Work org repos may need SAML SSO authorisation of the new key - remind the user after `copy work`.
- `copy` can hold only one key on the clipboard. Do it in two steps, signed in to the matching GitHub account each time (separate browser profile or private window recommended).
- Backups of edited files are kept as `*.bak-gh-profiles` next to the originals.
