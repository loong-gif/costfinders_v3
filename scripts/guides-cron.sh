#!/bin/sh
# The weekly guide job. Railway runs this on a cron (docs/OPERATIONS.md, "Weekly cost guides")
# and expects it to exit; a run that hangs makes Railway skip the next one.
#
# Clones main fresh each run — the Railway image holds only this script, not the repo, so the
# job always generates against the code that is actually on main — writes the guides the live
# database now qualifies for, commits them and pushes. `npm ci` installs the Husky hook, so the
# push runs the same `npm run gate` a person's push does: a guide that breaks a test or the
# build never lands. Nothing to add is a clean exit, not an empty commit.
set -eu

: "${GITHUB_TOKEN:?a fine-grained token with contents read/write on the repo, so the job can push}"
: "${ANTHROPIC_API_KEY:?the generator drafts guide prose with Claude}"
: "${NEXT_PUBLIC_SUPABASE_URL:?}"
: "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?}"

REPO="${GITHUB_REPO:-BrandRap-LLC/costfinders_v2}"
WORK="$(mktemp -d)"

echo "guides-cron: cloning $REPO"
git clone --quiet --depth 1 --branch main \
  "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" "$WORK"
cd "$WORK"
git config user.name "costfinders-guides"
git config user.email "guides@costfinders.ai"

echo "guides-cron: npm ci"
npm ci --no-audit --no-fund

echo "guides-cron: generating"
npx tsx scripts/generate-guides.ts

NEW="$(git ls-files --others --exclude-standard src/content/guides | sed 's#.*/##; s#\.json$##' | tr '\n' ' ')"
if [ -z "$NEW" ]; then
  echo "guides-cron: nothing new to publish"
  exit 0
fi

git add src/content/guides
git commit --quiet \
  -m "content(guides): weekly generator added $NEW" \
  -m "Drafted by scripts/generate-guides.ts from the live offer feed; see docs/OPERATIONS.md." \
  -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"

echo "guides-cron: pushing (the pre-push gate runs here)"
git push --quiet origin HEAD:main
echo "guides-cron: published $NEW"
