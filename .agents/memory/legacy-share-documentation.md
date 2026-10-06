---
name: Legacy snapshot documentation
description: Documentation persistence requirements for the old standalone workflow share format.
---

Legacy `share_links` snapshots must carry the same panel-document bundle as cloud-backed project shares: overview details, project PRD, workflow PRDs, and notes. Persist the bundle both when creating a snapshot and when its author updates it, then return it from the shared-view response and live update payload.

**Why:** Historic unlinked snapshots have no durable connection to the author's browser storage or cloud project. If their documentation is omitted at creation, the viewer can only show the title/canvas and there is no safe way to reconstruct the missing content afterward.

**How to apply:** Keep absent documentation explicit in the shared response so the viewer clears stale local cache rather than displaying another share's data. Treat historic snapshots with no bundle as genuinely empty; refreshing them from the original authoring session is the recovery path.

Never infer a legacy snapshot's source project by matching its title or canvas content. Reconnecting original comments requires source identity from the authoring session and verified project ownership.

**Why:** Copies and imports can have identical names and content but different owners and comment threads. Guessing the source could expose another project's comments.

**How to apply:** Preserve unlinked historical snapshots as unlinked until the original editor supplies a verified source; do not bulk-match or migrate them based on similarity.