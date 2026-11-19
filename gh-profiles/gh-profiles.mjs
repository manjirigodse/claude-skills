#!/usr/bin/env node
// gh-profiles: manage a WORK and a PERSONAL GitHub identity (SSH keys + git identity + routing).
// Cross-platform (Windows / macOS / Linux), zero dependencies. Never overwrites existing keys.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HOME = os.homedir();
const SSH_DIR = path.join(HOME, '.ssh');
const SSH_CONFIG = path.join(SSH_DIR, 'config');
const GITCONFIG = path.join(HOME, '.gitconfig');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONF = path.join(HERE, 'profiles.json');
const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';
const MARK = ['# >>> gh-profiles (managed - do not edit by hand) >>>', '# <<< gh-profiles (managed) <<<'];
const NAMES = ['work', 'personal'];

const DEFAULTS = {
  work: {
    name: 'Manjiri Godse', email: 'c-mgodse@neogov.net', alias: 'github-work',
    key: 'id_ed25519_github_work', orgs: ['ngv-dev'], dirs: ['D:/Manjiri Workspace/Neogov'], githubUser: '',
  },
  personal: {
    name: 'Manjiri Godse', email: 'manjirigodse@gmail.com', alias: 'github-personal',
    key: 'id_ed25519_github_personal', orgs: [], dirs: [], githubUser: '',
  },
};

// ---------- helpers ----------
const sh = (cmd, args, o = {}) => spawnSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...o });
const git = (cwd, ...args) => sh('git', ['-C', cwd, ...args]);
const out = (r) => (r.stdout || '').trim();
const log = (...a) => console.log(...a);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (p) => p.replace(/\\/g, '/').replace(/\/+$/, '');

function loadConf() {
  if (!fs.existsSync(CONF)) { fs.writeFileSync(CONF, JSON.stringify(DEFAULTS, null, 2) + '\n'); return structuredClone(DEFAULTS); }
  return JSON.parse(fs.readFileSync(CONF, 'utf8'));
}
const saveConf = (c) => fs.writeFileSync(CONF, JSON.stringify(c, null, 2) + '\n');
const keyPath = (p) => path.join(SSH_DIR, p.key);
const owners = (p) => [...p.orgs, p.githubUser].filter(Boolean).map((s) => s.toLowerCase());
const includeFile = (n) => path.join(HOME, `.gitconfig-gh-${n}`);

function writeBlock(file, body) {
  const [S, E] = MARK;
  let cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (cur && !fs.existsSync(file + '.bak-gh-profiles')) fs.writeFileSync(file + '.bak-gh-profiles', cur);
  cur = cur.replace(new RegExp(`\\r?\\n?${esc(S)}[\\s\\S]*?${esc(E)}\\r?\\n?`), '');
  fs.writeFileSync(file, cur.trimEnd() + (cur.trim() ? '\n\n' : '') + `${S}\n${body.trimEnd()}\n${E}\n`);
}

function parseRemote(url) {
  let m = url.match(/^(?:ssh:\/\/)?([^@/]+)@([^:/]+)[:/](.+?)\/([^/]+?)(?:\.git)?\/?$/);
  if (m) return { user: m[1], host: m[2], owner: m[3], repo: m[4] };
  m = url.match(/^https?:\/\/(?:[^@/]+@)?([^/]+)\/(.+?)\/([^/]+?)(?:\.git)?\/?$/);
  if (m) return { user: '', host: m[1], owner: m[2], repo: m[3] };
  return null;
}
function classify(url, conf) {
  const p = parseRemote(url || '');
  if (!p) return null;
  for (const n of NAMES) {
    if (p.host === conf[n].alias) return n;
    if (p.host === 'github.com' && owners(conf[n]).includes(p.owner.toLowerCase())) return n;
  }
  return null;
}
function repoRoot(dir) {
  const r = git(dir, 'rev-parse', '--show-toplevel');
  return r.status === 0 ? out(r) : null;
}
function profileByEmail(email, conf) {
  return NAMES.find((n) => conf[n].email.toLowerCase() === (email || '').toLowerCase()) || null;
}
function need(profile, conf) {
  if (!NAMES.includes(profile)) { console.error(`Profile must be one of: ${NAMES.join(', ')}`); process.exit(2); }
  return conf[profile];
}

// ---------- sync: (re)generate every managed file from profiles.json ----------
function sync(conf) {
  fs.mkdirSync(SSH_DIR, { recursive: true });
  for (const n of NAMES) {
    fs.writeFileSync(includeFile(n), `[user]\n    name = ${conf[n].name}\n    email = ${conf[n].email}\n`);
  }
  const sshBody = NAMES.map((n) => [
    `Host ${conf[n].alias}`, '    HostName github.com', '    User git',
    `    IdentityFile ~/.ssh/${conf[n].key}`, '    IdentitiesOnly yes',
  ].join('\n')).join('\n\n');
  writeBlock(SSH_CONFIG, sshBody);

  const folder = [], remote = [];
  for (const n of NAMES) {
    const inc = `~/.gitconfig-gh-${n}`;
    for (const d of conf[n].dirs) folder.push(`[includeIf "gitdir/i:${norm(d)}/"]\n    path = ${inc}`);
    // NOTE: git matches these URL globs path-aware (a bare * never crosses '/'), so each URL
    // style needs its own pattern: `<seg>/**` for the tail, `*/**` for "any owner".
    const urlGlobs = [`*@${conf[n].alias}:*/**`];
    for (const o of owners(conf[n])) {
      urlGlobs.push(`*@github.com:${o}/**`, `https://github.com/${o}/**`, `https://*@github.com/${o}/**`, `ssh://*@github.com/${o}/**`);
    }
    for (const g of urlGlobs) remote.push(`[includeIf "hasconfig:remote.*.url:${g}"]\n    path = ${inc}`);
  }
  // folder rules first, remote rules last => the remote/owner wins when both match
  writeBlock(GITCONFIG, [...folder, ...remote].join('\n'));
}

// ---------- commands ----------
function cmdInit(conf) {
  fs.mkdirSync(SSH_DIR, { recursive: true });
  for (const n of NAMES) {
    const kp = keyPath(conf[n]);
    if (fs.existsSync(kp)) { log(`[keep]    ${n}: key already exists (${kp}) - not touched`); continue; }
    const r = sh('ssh-keygen', ['-t', 'ed25519', '-C', conf[n].email, '-f', kp, '-N', '']);
    if (r.status !== 0) { console.error(`ssh-keygen failed for ${n}: ${r.stderr}`); process.exit(1); }
    log(`[create]  ${n}: ${kp}  (${conf[n].email})`);
  }
  sync(conf);
  log('\n[ok] ssh config + git identity routing written (backups: *.bak-gh-profiles).');
  log('\nNext: activate the keys on GitHub:');
  log('  1) Sign in to the WORK GitHub account  ->  /gh-profiles copy work');
  log('  2) Sign in to the PERSONAL account     ->  /gh-profiles copy personal');
  log('  3) /gh-profiles test');
}

function cmdKeys(conf) {
  for (const n of NAMES) {
    const pub = keyPath(conf[n]) + '.pub';
    log(`--- ${n} (${conf[n].email}) ---`);
    log(fs.existsSync(pub) ? fs.readFileSync(pub, 'utf8').trim() : '(missing - run init)');
  }
}

function copyToClipboard(text) {
  const tries = IS_WIN ? [['clip', []]] : IS_MAC ? [['pbcopy', []]] : [['xclip', ['-selection', 'clipboard']], ['wl-copy', []]];
  for (const [c, a] of tries) { const r = spawnSync(c, a, { input: text, stdio: ['pipe', 'ignore', 'ignore'] }); if (r.status === 0) return true; }
  return false;
}
function openUrl(url) {
  if (IS_WIN) spawnSync('cmd', ['/c', 'start', '', url], { stdio: 'ignore' });
  else spawnSync(IS_MAC ? 'open' : 'xdg-open', [url], { stdio: 'ignore' });
}

function cmdCopy(conf, profile, flags) {
  const p = need(profile, conf);
  const pub = keyPath(p) + '.pub';
  if (!fs.existsSync(pub)) { console.error('Key missing - run: init'); process.exit(1); }
  const text = fs.readFileSync(pub, 'utf8').trim();
  const ok = copyToClipboard(text + '\n');
  log(ok ? `[copied] ${profile} PUBLIC key is on your clipboard.` : '[warn] could not use clipboard - copy the key below manually.');
  log(`\n${text}\n`);
  log(`Title to use on GitHub:  ${os.hostname()} - ${profile}`);
  log('Key type: Authentication Key');
  if (!flags.includes('--no-open')) { openUrl('https://github.com/settings/ssh/new'); log('Opened: https://github.com/settings/ssh/new'); }
  log(`\nMake sure you are signed in as the ${profile.toUpperCase()} GitHub account (tip: use a separate browser profile / private window).`);
  if (profile === 'work') log('If your org enforces SAML SSO: Settings > SSH keys > "Configure SSO" next to this key > Authorize the org.');
}

function sshTest(p) {
  const r = sh('ssh', ['-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=10', `git@${p.alias}`]);
  const txt = `${r.stdout}${r.stderr}`;
  const m = txt.match(/Hi ([^!]+)!/);
  if (m) return { ok: true, user: m[1] };
  if (/Permission denied/i.test(txt)) return { ok: false, why: 'key not added to GitHub yet (Permission denied)' };
  return { ok: false, why: txt.trim().split('\n').pop() || 'no response' };
}

function cmdTest(conf) {
  let changed = false;
  for (const n of NAMES) {
    const t = sshTest(conf[n]);
    if (t.ok) {
      log(`[ OK ] ${n.padEnd(8)} authenticated as GitHub user "${t.user}"`);
      if (conf[n].githubUser !== t.user) { conf[n].githubUser = t.user; changed = true; }
    } else log(`[FAIL] ${n.padEnd(8)} ${t.why}`);
  }
  if (changed) { saveConf(conf); sync(conf); log('\n[ok] learned GitHub usernames; routing rules refreshed.'); }
}

function fingerprint(p) {
  const pub = keyPath(p) + '.pub';
  if (!fs.existsSync(pub)) return null;
  return out(sh('ssh-keygen', ['-lf', pub])).split(' ').slice(1, 2).join('');
}

function cmdStatus(conf) {
  log('PROFILE   EMAIL                         KEY       GITHUB USER');
  for (const n of NAMES) {
    const fp = fingerprint(conf[n]);
    log(`${n.padEnd(9)} ${conf[n].email.padEnd(29)} ${fp ? 'present ' : 'MISSING '} ${conf[n].githubUser || '(unknown - run test)'}`);
  }
  log('');
  cmdWhich(conf, process.cwd());
}

function cmdWhich(conf, dir) {
  const root = repoRoot(dir);
  if (!root) { log('Not inside a git repository (no repo identity to show).'); return; }
  const email = out(git(root, 'config', 'user.email'));
  const name = out(git(root, 'config', 'user.name'));
  const origin = out(git(root, 'remote', 'get-url', 'origin'));
  const byId = profileByEmail(email, conf), byRemote = classify(origin, conf);
  log(`Repo:     ${root}`);
  log(`Remote:   ${origin || '(none)'}  ${byRemote ? `[${byRemote}]` : ''}`);
  log(`Identity: ${name} <${email}>  ${byId ? `[${byId}]` : '[no profile match]'}`);
  if (byRemote && byId && byRemote !== byId) log(`!! MISMATCH: remote looks ${byRemote} but commits will be authored as ${byId}. Fix: use ${byRemote}`);
}

function cmdUse(conf, profile, dir, flags) {
  const p = need(profile, conf);
  const root = repoRoot(dir);
  if (!root) { console.error('Not inside a git repository.'); process.exit(1); }
  git(root, 'config', '--local', 'user.name', p.name);
  git(root, 'config', '--local', 'user.email', p.email);
  log(`[ok] ${root}\n     commits will be authored as ${p.name} <${p.email}>`);
  if (flags.includes('--no-remote')) return;
  const url = out(git(root, 'remote', 'get-url', 'origin'));
  const r = parseRemote(url);
  if (!r) { log('     (no parsable origin remote - identity only)'); return; }
  if (/^org-\d+$/.test(r.user)) { log(`     origin uses org SSH user "${r.user}" - left unchanged (use --remote-force to override)`); if (!flags.includes('--remote-force')) return; }
  const next = `git@${p.alias}:${r.owner}/${r.repo}.git`;
  if (url !== next) { git(root, 'remote', 'set-url', 'origin', next); log(`     origin: ${url}\n          -> ${next}`); }
}

function cmdClone(conf, profile, repoArg, target) {
  const p = need(profile, conf);
  if (!repoArg) { console.error('Usage: clone <work|personal> <owner/repo | url> [dir]'); process.exit(2); }
  const r = /^[^/\s:@]+\/[^/\s:@]+$/.test(repoArg) ? { owner: repoArg.split('/')[0], repo: repoArg.split('/')[1].replace(/\.git$/, '') } : parseRemote(repoArg);
  if (!r) { console.error('Cannot parse repo'); process.exit(2); }
  const url = `git@${p.alias}:${r.owner}/${r.repo}.git`;
  const dest = target || r.repo;
  log(`git clone ${url} ${dest}`);
  const c = spawnSync('git', ['clone', url, dest], { stdio: 'inherit' });
  if (c.status !== 0) process.exit(c.status || 1);
  git(dest, 'config', '--local', 'user.name', p.name);
  git(dest, 'config', '--local', 'user.email', p.email);
  log(`[ok] cloned with the ${profile} key; commits authored as ${p.email}`);
}

function cmdRoute(conf, sub, profile, dir) {
  if (sub === 'list' || !sub) { for (const n of NAMES) log(`${n}: orgs=[${conf[n].orgs}] user=${conf[n].githubUser || '-'} dirs=[${conf[n].dirs}]`); return; }
  const p = need(profile, conf);
  if (!dir) { console.error('Usage: route add|rm <profile> <dir>'); process.exit(2); }
  const d = norm(path.resolve(dir));
  if (sub === 'add' && !p.dirs.map(norm).includes(d)) p.dirs.push(d);
  if (sub === 'rm') p.dirs = p.dirs.filter((x) => norm(x) !== d);
  saveConf(conf); sync(conf);
  log(`[ok] ${profile} dirs: ${p.dirs.join(', ') || '(none)'}`);
}

function cmdOrg(conf, sub, profile, org) {
  const p = need(profile, conf);
  if (!org) { console.error('Usage: org add|rm <profile> <github-org-or-user>'); process.exit(2); }
  if (sub === 'add' && !p.orgs.includes(org)) p.orgs.push(org);
  if (sub === 'rm') p.orgs = p.orgs.filter((x) => x !== org);
  saveConf(conf); sync(conf);
  log(`[ok] ${profile} orgs: ${p.orgs.join(', ') || '(none)'}`);
}

function walk(dir, depth, found) {
  if (depth < 0) return;
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  if (ents.some((e) => e.name === '.git')) { found.push(dir); return; }
  for (const e of ents) if (e.isDirectory() && !['node_modules', '.git', 'AppData'].includes(e.name)) walk(path.join(dir, e.name), depth - 1, found);
}
function cmdAudit(conf, dir) {
  const repos = []; walk(path.resolve(dir || '.'), 4, repos);
  let bad = 0;
  for (const r of repos) {
    const origin = out(git(r, 'remote', 'get-url', 'origin'));
    const email = out(git(r, 'config', 'user.email'));
    const want = classify(origin, conf), have = profileByEmail(email, conf);
    if (want && want !== have) { bad++; log(`MISMATCH ${r}\n         remote=${want}  commits-as=${email || '(none)'}`); }
  }
  log(`\nScanned ${repos.length} repo(s): ${bad} mismatch(es).`);
}

function cmdDoctor(conf) {
  const ok = (b, m, fix) => log(`${b ? '[ ok ]' : '[FAIL]'} ${m}${!b && fix ? `\n         fix: ${fix}` : ''}`);
  const gv = out(sh('git', ['--version'])).match(/(\d+)\.(\d+)/);
  ok(gv && (+gv[1] > 2 || +gv[2] >= 36), `git ${gv ? gv[0] : '?'} (need >= 2.36 for remote-based routing)`, 'upgrade git');
  ok(sh('ssh', ['-V']).status === 0 || /OpenSSH/.test(sh('ssh', ['-V']).stderr), 'ssh client found', 'install OpenSSH');
  for (const n of NAMES) {
    const kp = keyPath(conf[n]);
    ok(fs.existsSync(kp), `${n} key exists (${path.basename(kp)})`, 'run: init');
    if (fs.existsSync(kp)) {
      const nopass = sh('ssh-keygen', ['-y', '-P', '', '-f', kp]).status === 0;
      log(`        passphrase: ${nopass ? 'NONE (convenient; anyone with the file can use it - add one: ssh-keygen -p -f "' + kp + '")' : 'set'}`);
      if (!IS_WIN) ok((fs.statSync(kp).mode & 0o077) === 0, `${n} key permissions are private`, `chmod 600 "${kp}"`);
    }
  }
  const sc = fs.existsSync(SSH_CONFIG) ? fs.readFileSync(SSH_CONFIG, 'utf8') : '';
  ok(sc.includes(MARK[0]), '~/.ssh/config has managed host aliases', 'run: sync');
  const gc = fs.existsSync(GITCONFIG) ? fs.readFileSync(GITCONFIG, 'utf8') : '';
  ok(gc.includes(MARK[0]), '~/.gitconfig has identity routing rules', 'run: sync');
  if (IS_WIN) {
    const s = out(sh('powershell', ['-NoProfile', '-Command', '(Get-Service ssh-agent).Status']));
    ok(s === 'Running', `ssh-agent service: ${s || 'unknown'} (only needed if keys have a passphrase)`,
      'admin PowerShell: Set-Service ssh-agent -StartupType Manual; Start-Service ssh-agent');
  } else {
    const a = sh('ssh-add', ['-l']);
    ok(a.status !== 2, 'ssh-agent reachable (only needed if keys have a passphrase)', IS_MAC ? 'add "UseKeychain yes" + "AddKeysToAgent yes" to Host entries' : 'eval "$(ssh-agent -s)"');
  }
}

function usage() {
  log(`gh-profiles <command>
  init                          generate both keys (never overwrites), write ssh + git routing
  copy <work|personal> [--no-open]   copy PUBLIC key to clipboard + open GitHub "add SSH key" page
  keys                          print both public keys
  test                          check each key authenticates (learns GitHub usernames)
  status | which                profiles + identity of the repo in the current folder
  use <profile> [--no-remote]   force this repo to a profile (identity + remote alias)
  clone <profile> <owner/repo|url> [dir]   clone with the right key + identity
  route add|rm|list <profile> <dir>        folders that always use a profile
  org add|rm <profile> <github-org>        GitHub orgs/users that belong to a profile
  audit [dir]                   find repos whose commit identity does not match their remote
  doctor                        health checks (git version, keys, passphrase, agent, config)
  sync                          regenerate managed ssh/git config from profiles.json`);
}

// ---------- dispatch ----------
const [cmd, ...rest] = process.argv.slice(2);
const flags = rest.filter((a) => a.startsWith('--'));
const args = rest.filter((a) => !a.startsWith('--'));
const conf = loadConf();
switch (cmd) {
  case 'init': cmdInit(conf); break;
  case 'sync': sync(conf); log('[ok] synced'); break;
  case 'keys': cmdKeys(conf); break;
  case 'copy': cmdCopy(conf, args[0], flags); break;
  case 'test': cmdTest(conf); break;
  case 'status': cmdStatus(conf); break;
  case 'which': case 'whoami': cmdWhich(conf, process.cwd()); break;
  case 'use': cmdUse(conf, args[0], process.cwd(), flags); break;
  case 'clone': cmdClone(conf, args[0], args[1], args[2]); break;
  case 'route': cmdRoute(conf, args[0], args[1], args[2]); break;
  case 'org': cmdOrg(conf, args[0], args[1], args[2]); break;
  case 'audit': cmdAudit(conf, args[0]); break;
  case 'doctor': cmdDoctor(conf); break;
  default: usage();
}
