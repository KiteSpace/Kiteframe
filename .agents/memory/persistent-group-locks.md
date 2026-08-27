---
name: Persistent groups and layer locks
description: How Layers lock state must govern operations on mixed persistent canvas groups.
---

Treat a persistent mixed group atomically for every mutating gesture. If any node or canvas-object member is effectively locked, drag, nudge, delete, group, and ungroup must leave the complete group unchanged.

**Why:** Layers stores node locks under the node ID and canvas-object locks under `object:<id>`, while a persistent group row cascades to both key forms. Checking only nodes—or deleting selected objects separately—can silently split a group.

**How to apply:** Resolve all selected group IDs, evaluate effective locks for every member across both collections, and perform one combined mutation only for groups with no locked members. Browser regressions should verify persisted data rather than transient virtualized/locked render rows.