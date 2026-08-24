---
name: PRD generation capacity
description: Capacity rules for per-section project and workflow PRD generation.
---

PRD section generation must use one shared, conservative client-side queue and
treat AI-service 429 responses as backpressure owned by that queue. A document
generation is atomic: it must fail rather than returning generated sections
with silent empty gaps.

**Why:** The AI job service admits only a small number of active requests per
user. Starting every PRD section at once caused 429s; generic retry and model
fallback multiplied the load, while the old all-settled path saved incomplete
specs as if generation had succeeded.

**How to apply:** When changing PRD prompts, section counts, retry behavior, or
generation surfaces, keep project and workflow calls within the shared limit,
propagate cancellation to queued and active work, and preserve the previous
document unless every generated section resolves.