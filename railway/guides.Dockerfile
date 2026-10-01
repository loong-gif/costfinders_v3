# The image behind the Railway cron service `guides` (docs/OPERATIONS.md, "Weekly cost guides").
# It carries git, Node and the one script; the repo itself is cloned at run time so the job
# always runs the code that is on main. Build context is the repo root.
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Husky installs the pre-push hook on `npm ci`, and the gate it runs builds the site.
ENV CI=true NODE_OPTIONS=--max-old-space-size=4096

COPY scripts/guides-cron.sh /guides-cron.sh
CMD ["sh", "/guides-cron.sh"]
