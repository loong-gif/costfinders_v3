#!/bin/sh
# The quality gate. The pre-push hook (.husky/pre-push) runs it; `npm run gate` runs it by hand.
#
# Stops at the first failing step and prints each step's elapsed seconds. The two live-database
# steps read NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY from .env.local; without them they SKIP and say
# so, which means "unverified", not "passed".
#
# The build goes to .next-gate (NEXT_DIST_DIR, read in next.config.ts), so it can run while
# `next dev` owns .next.
#
# Bypass: `HUSKY=0 git push` skips the hook. Forbidden outside an incident: this gate is the only
# thing between a push and a production deploy.

cd "$(dirname "$0")/.." || exit 1

if [ -f .env.local ]; then
  set -a
  . ./.env.local
  set +a
fi

gate_start=$(date +%s)

step() {
  label=$1
  shift
  echo "gate: $label"
  start=$(date +%s)
  "$@"
  code=$?
  echo "gate: $label $( [ "$code" -eq 0 ] && echo ok || echo FAILED ) in $(($(date +%s) - start))s"
  if [ "$code" -ne 0 ]; then
    echo "gate: FAILED at \"$label\" after $(($(date +%s) - gate_start))s"
    exit "$code"
  fi
}

step lint npm run lint
step error-logging npx tsx scripts/check-error-logging.ts
step schema:check npm run schema:check
# tsconfig.json includes .next-gate/types (next build insists on it), so a route deleted since the
# last gate run would fail tsc on its stale validator entry. The build regenerates them.
rm -rf .next-gate/types
step typegen npx next typegen
step tsc npx tsc --noEmit
step test npm test
step build env NEXT_DIST_DIR=.next-gate npm run build
step prices:check npm run prices:check
# Every guide file has the sections and content it must, and the FAQ questions say "cost".
step guides:check npx tsx scripts/generate-guides.ts --check
# Never fails: lists the treatment/city pairs the live data now qualifies for a cost guide that
# have none, so the gap is printed on every push instead of found by hand months later.
step guides:coverage npx tsx scripts/generate-guides.ts --dry-run

echo "gate: passed in $(($(date +%s) - gate_start))s"
