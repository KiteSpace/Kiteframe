---
name: Dev/prod use separate databases; secrets can lag behind publish
description: Why an API key (or DB row) created in dev doesn't exist in production, and why a freshly-added/updated secret may not appear in a running deployment right away.
---

## Separate databases
Development and production run against **different Postgres databases**. Any row inserted via a dev script or `executeSql` (dev) only exists in dev — it will not be present in production, even after publishing, because publishing migrates schema, not data.

**Why:** `executeSql` production access is read-only by design; there is no supported path to INSERT into prod directly from the agent environment.

**How to apply:** To seed the same data (e.g. an API key hash) into both environments, either (a) add a temporary authenticated HTTP endpoint in the app itself — since the deployed app's own runtime process *can* write to its own DB — mint via that, then delete the endpoint; or (b) compute the same value (e.g. hash) and insert it into dev directly while relying on the app-authenticated route for prod.

## Secret propagation lag
Secrets added or updated via `requestEnvVar` are reported as present (`viewEnvVars` → `true`) for both dev and production immediately, but the **running production process may still not see the new value in `process.env`** until an additional fresh publish happens after the secret change — one publish immediately after adding a secret was not always enough; deleting and re-adding the secret plus another publish resolved it.

**Why:** observed directly — a diagnostic `console.log` of `process.env.SECRET` in production showed `undefined` even after `viewEnvVars({environment:"production"})` reported the key as configured, and even after a build created after the secret was added.

**How to apply:** After adding/changing a secret meant for production, don't assume one publish is sufficient. Verify with a real request (or a temporary diagnostic log) rather than trusting `viewEnvVars` alone. If still stale, delete and re-add the secret, then publish again.
