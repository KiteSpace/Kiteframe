#!/bin/bash
set -e
npm install
# drizzle-kit push asks an interactive "create or rename?" question when a
# new column appears alongside an old one of similar name. --force only
# bypasses data-loss warnings, not these prompts. Piping newlines accepts
# the default highlighted option ("create column") so the post-merge
# setup can complete unattended. yes "" supplies an unbounded stream of
# blank lines so multiple stacked prompts are all answered.
yes "" | npm run db:push -- --force
