---
name: Browser e2e testing behind sign-in
description: How to run real-browser (Playwright) checks against the auth-gated design editor without OAuth.
---

The design editor can be exercised end-to-end in a real browser despite sign-in:

1. **Forge a session** — sessions live in the Postgres `sessions` table (connect-pg-simple); passport serializes the whole user object. Insert a user + design (claimed_by_user_id must match for edit mode), insert a session row with `sess.passport.user = {id, email}`, and sign the cookie yourself: `connect.sid = "s:" + sid + "." + HMAC-SHA256(sid, SESSION_SECRET) base64 (strip '=')`.
2. **Use the HTTPS dev domain** — cookies are `secure: true` because REPL_ID is set, so target `https://$REPLIT_DEV_DOMAIN`, not http://localhost.
3. **Browser** — Playwright's downloaded chromium fails on NixOS (missing libglib). Install the nix `chromium` system package and pass `executablePath` + `--no-sandbox` to `chromium.launch()` with `playwright-core`.
4. **Editor gotchas** — the left component palette is replaced by the props panel while any node is selected (reload or deselect first); artboard selection renders as a box-shadow ring, leaf selection as an outline (both `#3b82f6`); craft.js palette drag works headless by dispatching DragEvents with one shared `DataTransfer` (dragstart → dragenter/dragover → drop).
5. **Multi-select gesture** — craft.js's NATIVE multi-select is `isMultiSelectEnabled: (e) => !!e.metaKey` (Cmd/Ctrl+click); use Playwright `click({ modifiers: ["Meta"] })`. The editor's custom Shift-click layer does NOT register selections in a real browser — Shift+click silently does nothing (as of Aug 2026; a task exists to rebind to Shift).

**How to apply:** reusable scripts live at `scripts/e2e-seed.mjs` and `scripts/e2e-canvas.mjs` (seed prints designId + cookie; canvas script takes them as args, env `CHROME_BIN=$(which chromium)`).
