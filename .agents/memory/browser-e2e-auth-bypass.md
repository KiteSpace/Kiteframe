---
name: Browser e2e testing behind sign-in
description: How to run real-browser (Playwright) checks against the auth-gated design editor without OAuth.
---

The design editor can be exercised end-to-end in a real browser despite sign-in:

1. **Forge a session** — sessions live in the Postgres `sessions` table (connect-pg-simple); passport serializes the whole user object. Insert a user + design (claimed_by_user_id must match for edit mode), insert a session row with `sess.passport.user = {id, email}`, and sign the cookie yourself: `connect.sid = "s:" + sid + "." + HMAC-SHA256(sid, SESSION_SECRET) base64 (strip '=')`.
2. **Use the HTTPS dev domain** — cookies are `secure: true` because REPL_ID is set, so target `https://$REPLIT_DEV_DOMAIN`, not http://localhost.
3. **Browser** — Playwright's downloaded chromium fails on NixOS (missing libglib). Install the nix `chromium` system package and pass `executablePath` + `--no-sandbox` to `chromium.launch()` with `playwright-core`.
4. **Editor gotchas** — the left component palette is replaced by the props panel while any node is selected (reload or deselect first); artboard selection renders as a box-shadow ring, leaf selection as an outline (both `#3b82f6`); craft.js palette drag works headless by dispatching DragEvents with one shared `DataTransfer` (dragstart → dragenter/dragover → drop).
5. **Multi-select gesture** — the Editor's `handlers` prop rebinds craft.js multi-select to `isMultiSelectEnabled: (e) => e.shiftKey` (Shift+click); use Playwright `click({ modifiers: ["Shift"] })`. Craft's `state.events.selected` is the single source of truth (the old custom Shift-click layer was removed Aug 2026); each selected node renders its own #3b82f6 ring.

6. **Opening a *workflow* project needs a click, not a URL** — navigating straight to `/project/:projectUuid` renders the home hero ("What are we working on today?"), not the editor: the project has to be opened into a tab by client-side state. The rail, canvas and all panel testids simply do not exist until then. Click the Recent Projects card (`text=<project name>`) and wait for `[data-testid="project-panel"]`. A missing-rail assertion here is a harness bug, not a product bug. (Designs at `/designs/:id` do load directly — this applies to workflow projects.)

7. **Restart the server before trusting a save/reload run** — Vite HMR only covers the client. Server-side allow-lists and schemas (e.g. `server/lib/designSchema.ts`) keep serving the pre-edit module until the workflow restarts, so a save→reload assertion fails against stale validation and every new component degrades to a placeholder. That looks exactly like a client registry miss; restart first, then debug.

**How to apply:** reusable scripts live at `scripts/e2e-seed.mjs` and `scripts/e2e-canvas.mjs` (seed prints designId + cookie; canvas script takes them as args, env `CHROME_BIN=$(which chromium)`). Node e2e scripts must run from the workspace root — `/tmp` cannot resolve `pg`.
