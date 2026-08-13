---
name: Stale server routes and schema pushes in this workspace
description: Two environment traps — a 200 that is really the SPA fallback, and drizzle-kit push needing a TTY.
---

## A 200 with no JSON body in the express log means your route does not exist yet

The request log prints a response-body preview for JSON replies
(`... 200 in 65ms :: {"id":...}`). A line with a status but **no** `::` preview
for an `/api/...` call is the SPA/vite catch-all serving index.html — i.e. the
route was never registered. On the client this looks like a *successful* request
whose `res.json()` throws, so an error toast (or silent catch) appears while the
server log looks healthy.

**Why:** the dev server does not always pick up newly added routes; the file
watcher can miss them.

**How to apply:** when a brand-new endpoint "returns 200" but nothing happens and
the database is unchanged, do not debug the client — restart the app workflow and
retry. Confirm the fix by looking for the `::` body preview in the log.

## drizzle-kit push cannot be answered by piping

`npm run db:push` prompts interactively when adding a unique constraint to a
populated table, and it needs a real TTY — piping a newline does not select the
default, the command just exits with the change unapplied (silently, with a
success-looking exit).

**How to apply:** apply the DDL directly instead (idempotent
`ADD COLUMN IF NOT EXISTS` / `pg_constraint` guard), and add the matching file to
`migrations/` so a migration-built database gets the same change — the schema file
alone is not enough here, nothing applies it on startup.
