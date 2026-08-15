---
name: Canvas object type whitelists
description: New workflow-canvas object types must be registered in every validation whitelist or they silently vanish.
---

A new workflow-canvas object type must be added to **every** validation whitelist that gates it — client creation gates, the export/import schema, and especially the **server-side save validation** — not just the render path.

**Why:** a new rich-text object rendered and edited fine locally but was silently stripped on reload because the server's save validation rejected the unknown type. No error surfaced; other objects survived, making it look like a client bug. The failure mode is silent partial data loss.

**How to apply:** when introducing any new canvas object type, grep client + server for an existing type name (e.g. `'sticky'`) and update every enum/includes list found before trusting a save/reload test.
