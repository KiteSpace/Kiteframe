---
name: kiteframe-brainstorm
description: Generate and refine either a visual workflow diagram or a UI design/interface via Kiteframe, before writing any code. Use this skill whenever the user wants to build, design, or scaffold a new feature, page, screen, interface, dashboard, or flow from scratch, or asks to "brainstorm," "map out," "think through," or "mock up" something before implementation, or explicitly mentions Kiteframe. All reasoning happens in this session using the user's own Claude Code tokens -- Kiteframe's server never runs an LLM call for this. Do NOT use this for small tweaks, bug fixes, styling changes, or edits to existing components -- only for new feature/flow/screen work where a diagram or mockup would clarify scope before coding.
---

# Kiteframe Brainstorm

Before writing code for a new feature, produce either a workflow diagram
or a UI design mockup first (never both without being asked), confirm it
with the user, then proceed to implementation.

## Step 0 — Ask which one, don't infer

If the user's request doesn't already make it obvious, ask directly:
**"Should I sketch this as a workflow (steps/logic/flow) or a UI design
(an actual screen/interface mockup)?"**

Do not guess based on keyword matching — "build a dashboard" could
reasonably mean either a workflow for how dashboard data updates, or a
mockup of what the dashboard screen looks like. When it's ambiguous, ask.
When the user has clearly already specified (e.g. "mock up the settings
screen" vs. "map out the approval process"), proceed directly without
asking.

Once you know which, follow the matching track below. The two tracks
are structurally identical (fetch → reason → validate → confirm →
submit) but use different templates, schemas, and endpoints — do not
mix them.

---

## Track A — Workflow

1. **Gather the feature/process description.** Ask one clarifying
   question first if genuinely underspecified.

2. **Fetch the current reasoning template:**
   ```bash
   python3 /mnt/skills/user/kiteframe-brainstorm/scripts/fetch_template.py
   ```
   Returns `system_prompt`, `output_schema`, `few_shot_examples` for
   workflow diagrams. No AI call happens on Kiteframe's side.

3. **Reason through the workflow yourself**, following the returned
   `system_prompt` and matching `output_schema` exactly.

4. **Validate locally before sending anything:**
   ```bash
   python3 /mnt/skills/user/kiteframe-brainstorm/scripts/validate_workflow.py --schema '<output_schema JSON>' --workflow '<your draft JSON>'
   ```
   Fix any errors and re-check before proceeding.

5. **Summarize the workflow in plain language** — states/screens,
   transitions, branches — before writing any code. Don't skip this.

6. **Get confirmation or refinement.** If the user wants changes, redo
   step 3 with the amended understanding (no stateful refine endpoint —
   each pass is a fresh draft).

7. **Submit the confirmed workflow:**
   ```bash
   python3 /mnt/skills/user/kiteframe-brainstorm/scripts/submit_workflow.py --workflow '<confirmed JSON>'
   ```
   Returns a workflow id and/or view URL. This creates an **unclaimed**
   record — mention to the user that they can open the link and save it
   to their Kiteframe account if they want it to persist there.

8. **Only after this**, proceed to writing UI/app code based on the
   confirmed, stored workflow.

---

## Track B — UI Design

1. **Gather the screen/interface description.** Ask one clarifying
   question first if genuinely underspecified (what screen, what's on
   it, roughly).

2. **Fetch the current design reasoning template:**
   ```bash
   python3 /mnt/skills/user/kiteframe-brainstorm/scripts/fetch_design_template.py
   ```
   Returns `system_prompt`, `output_schema` (the craft.js tree shape and
   allowed component enum), and `few_shot_examples` for UI designs. No
   AI call happens on Kiteframe's side.

3. **Reason through the design yourself**, following the returned
   `system_prompt`. Key structural rules (also stated in the fetched
   prompt, but critical enough to restate here):
   - `ROOT` is always an `AstryxSection`.
   - Every design needs at least one `AstryxArtboard` directly under
     `ROOT`, representing a distinct screen. Multi-screen designs have
     multiple artboards under `ROOT`.
   - Containers (accept children via `nodes`): `AstryxArtboard`,
     `AstryxSection`, `AstryxStack`, `AstryxHStack`, and `AstryxCard`.
     Everything else is a leaf.
   - `AstryxCard` is a full container (`isCanvas: true`) — give it a
     `nodes[]` array with its children (typically an `AstryxStack` or
     `AstryxHStack` wrapping the card's content).
   - Never invent component names outside the enum returned in
     `output_schema` — if nothing fits well, pick the closest real
     component rather than making one up.

4. **Validate locally before sending anything:**
   ```bash
   python3 /mnt/skills/user/kiteframe-brainstorm/scripts/validate_design.py --schema '<output_schema JSON>' --craft-state '<your draft JSON>'
   ```
   This checks: ROOT exists and is `AstryxSection`, every component name
   is in the allowed enum, all parent/child references resolve, no
   cycles, and at least one `AstryxArtboard` exists under `ROOT`. Fix
   any errors and re-check — do not submit output that fails validation.

5. **Summarize the design in plain language** — what screens, what's on
   each, layout at a high level — before writing any code. Don't skip
   this checkpoint even if you're confident the tree is correct.

6. **Get confirmation or refinement.** If the user wants changes, redo
   step 3 with the amended understanding.

7. **Submit the confirmed design:**
   ```bash
   python3 /mnt/skills/user/kiteframe-brainstorm/scripts/submit_design.py --craft-state '<confirmed JSON>'
   ```
   Returns a design id and view URL. This creates an **unclaimed**
   record, same as workflows — mention the user can open the link and
   save it to their account to make it editable.

8. **Only after this**, proceed to writing actual UI code based on the
   confirmed, stored design.

---

## Setup (one-time, for the user)

- `KITEFRAME_API_BASE` — base URL of the Kiteframe external API (e.g.
  `https://kiteframe.space`)
- `EXTERNAL_API_KEY` — scoped API key for the external endpoints (used
  for both workflow and design routes)

Set these in the shell environment on the machine running Claude Code.
Never hardcode them in the skill or scripts. No Anthropic API key is
needed anywhere in this flow — reasoning happens in the user's own
Claude Code session.

## Notes

- Because Kiteframe never runs inference for either track, there is no
  marginal Anthropic cost to Kiteframe — cost is entirely in the user's
  own Claude Code session, as normal.
- If any script fails (auth, network, validation), tell the user
  directly rather than silently proceeding to write code without a
  confirmed workflow or design.
- Both tracks produce unclaimed records by design (no user session
  exists from Claude Code) — this is expected behavior, not a bug; the
  user claims them into their account from the view link if they want
  to keep or edit them further.
