#!/usr/bin/env python3
"""Claude Code PreToolUse hook (Bash): no push to main without a vault update.

Enforces CLAUDE.md § "Vault sync rule (CRITICAL)". A `git push` (or `gh pr merge`) is denied
unless a note in the Obsidian vault changed after the last push to origin/main. The baseline is
the reflog time of the last "update by push" of refs/remotes/origin/main, so a fetch or pull does
not reset it.

Allowed without a vault change:
  - nothing to push (HEAD is not ahead of origin/main),
  - branch deletions and dry runs,
  - HEAD's commit message has a line "Vault: none (<reason>)", for changes that need no docs.

ponytail: checks mtimes, not content. Touching a note satisfies it; the rule in CLAUDE.md still
says what the update must contain. Checks this repo only, even if the command pushes another one.
"""
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

VAULT = os.environ.get('COSTFINDERS_VAULT', '/Users/haris/CampusVault/Projects/CostFinders')
PUSH = re.compile(r'\bgit\b[^;&|\n]*\bpush\b')
MERGE = re.compile(r'\bgh\s+pr\s+merge\b')
NO_DOCS_PUSH = re.compile(r'(--delete\b|--dry-run\b|\s-[dn]\b|\s:\S)')
ESCAPE = re.compile(r'(?mi)^Vault:\s*none\b\W*\w')


def git(repo, *args):
    out = subprocess.run(['git', '-C', repo, *args], capture_output=True, text=True)
    return out.stdout.strip() if out.returncode == 0 else None


def last_push_time(repo):
    log = git(repo, 'reflog', 'show', '--date=unix', 'refs/remotes/origin/main') or ''
    for line in log.splitlines():
        m = re.search(r'@\{(\d+)\}: update by push', line)
        if m:
            return int(m.group(1))
    ct = git(repo, 'log', '-1', '--format=%ct', 'origin/main')
    return int(ct) if ct else None


def newest_vault_note(vault):
    newest, path = 0.0, None
    for root, dirs, files in os.walk(vault):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for f in files:
            if f.endswith('.md'):
                p = os.path.join(root, f)
                t = os.path.getmtime(p)
                if t > newest:
                    newest, path = t, p
    return newest, path


def deny(reason):
    print(json.dumps({
        'hookSpecificOutput': {
            'hookEventName': 'PreToolUse',
            'permissionDecision': 'deny',
            'permissionDecisionReason': reason,
        }
    }))
    sys.exit(0)


def main():
    data = json.load(sys.stdin)
    cmd = (data.get('tool_input') or {}).get('command') or ''
    is_push, is_merge = bool(PUSH.search(cmd)), bool(MERGE.search(cmd))
    if not (is_push or is_merge) or (is_push and not is_merge and NO_DOCS_PUSH.search(cmd)):
        return

    repo = os.environ.get('CLAUDE_PROJECT_DIR') or data.get('cwd') or '.'
    if git(repo, 'rev-parse', '--verify', '-q', 'origin/main') is None:
        return
    ahead = git(repo, 'rev-list', '--count', 'origin/main..HEAD')
    if is_push and not is_merge and ahead == '0':
        return
    if ESCAPE.search(git(repo, 'log', '-1', '--format=%B') or ''):
        return

    fix = (
        'Update the affected notes per CLAUDE.md § "Vault sync rule (CRITICAL)" (the change-to-note '
        'table), then push again. If this change truly needs no docs, amend HEAD\'s message with a '
        'line "Vault: none (<reason>)".'
    )
    if not os.path.isdir(VAULT):
        deny(f'Vault sync check: the vault is not at {VAULT} (set COSTFINDERS_VAULT if it moved). {fix}')

    baseline = last_push_time(repo)
    newest, path = newest_vault_note(VAULT)
    if baseline is None or newest > baseline:
        return

    when = datetime.fromtimestamp(baseline, timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    commits = git(repo, 'log', '--oneline', '-10', 'origin/main..HEAD') or '(none)'
    files = git(repo, 'diff', '--stat=100', '--stat-count=15', 'origin/main..HEAD') or ''
    deny(
        f'Vault sync check: no note in {VAULT} changed since the last push to origin/main '
        f'({when}); newest is {os.path.relpath(path, VAULT) if path else "none"}. '
        f'Unpushed commits:\n{commits}\n{files}\n{fix}'
    )


if __name__ == '__main__':
    main()
