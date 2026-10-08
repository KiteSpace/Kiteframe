---
name: Workflow interface planning calibration
description: Why source-mapping validation needs a bounded live-model grounding check
---

Correct source IDs, covered branches and separated roles do not prove that a plan is appropriately scoped. A planner can pass those checks while expanding a sparse workflow into an invented dashboard/list/detail product.

**Why:** A live approval-workflow comparison produced unnecessary status and navigation pages despite valid role and branch mappings. Explicitly keeping submit/status/revise in the same actor's task workspace improved the interpretation.

**How to apply:** After changing interpretation instructions, use a bounded live comparison alongside deterministic handoff tests. Check task/navigation justification and inferred fields, not just page counts or valid JSON. Outcomes normally belong to states; additional navigation needs source evidence.
