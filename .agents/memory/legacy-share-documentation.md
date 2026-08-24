---
name: Legacy snapshot documentation
description: Documentation persistence requirements for the old standalone workflow share format.
---

Legacy `share_links` snapshots must carry the same panel-document bundle as cloud-backed project shares: overview details, project PRD, workflow PRDs, and notes. Persist the bundle both when creating a snapshot and when its author updates it, then return it from the shared-view response and live update payload.

**Why:** A snapshot has no durable connection to the author's browser storage or cloud project. If its documentation is omitted at creation, the viewer can only show the title/canvas and there is no safe way to reconstruct the missing content afterward.

**How to apply:** Keep absent documentation explicit in the shared response so the viewer clears stale local cache rather than displaying another share's data. Treat historic snapshots with no bundle as genuinely empty; refreshing them from the original authoring session is the recovery path.