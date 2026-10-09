---
name: Workflow interface planning calibration
description: Calibrating workflow interface plans for grounded scope and realistic live latency
---

Correct source IDs, covered branches and separated roles do not prove that a plan is appropriately scoped. A planner can pass those checks while expanding a sparse workflow into an invented dashboard/list/detail product.

**Why:** A live approval-workflow comparison produced unnecessary status and navigation pages despite valid role and branch mappings. Explicitly keeping submit/status/revise in the same actor's task workspace improved the interpretation.

**How to apply:** After changing interpretation instructions, use a bounded live comparison alongside deterministic handoff tests. Check task/navigation justification and inferred fields, not just page counts or valid JSON. Outcomes normally belong to states; additional navigation needs source evidence.

## Planning latency

Set planning deadlines using representative live workflows, not just small deterministic fixtures. Reserve time for the permitted corrective attempt within one bounded request.

**Why:** Valid production proposals took roughly 77–91 seconds; a 90-second limit rejected some of them despite successful authentication and valid inputs. Fast test fixtures did not reveal this.

**How to apply:** When changing plan complexity or response size, check live latency as well as grounding. Keep deadline failures distinct from invalid plans, and cancel abandoned requests instead of allowing retries to accumulate provider work.
