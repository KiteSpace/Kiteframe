# Right rail addendum — Spec/History subtabs, multi-note reader, Issues verification

Companion to `README-right-rail.md` and `Right-Rail-Implementation-Spec.md` (the
base spec — tab shell, chat, artifact card, reader pane geometry). This file covers
only what changed in the follow-up design pass: the Project tab's sub-navigation,
a multi-document Notes feature, and confirming Issues/Insights against what's
already shipped. Same precedence rule applies — `THEME.md` owns color, this file
and the base spec own behavior, reference code is `rail-reader-kit.html`
(generic tokens — see its header comment for the `--rk-*` → `THEME.md` mapping,
same shape as `--rr-*`).

Read this **after** the base spec's Phase D (reader pane) ships — everything here
either lives inside the reader or depends on it existing.

---

## 0. What's new vs. what's already built

Read this table first — it changes how much work each section actually is.

| Feature | Status | Action |
| --- | --- | --- |
| Issues empty state, "Run Test Flight", rerun/filter/clear bar | **Already shipped**, `DiagnosticsTab.tsx` | Verify only — §3 |
| Project tab sub-navigation (Overview / Project PRD / Workflow PRD) | **Already shipped**, `ProjectDocTab.tsx` `DocMode` | **Restructure** to Overview / Spec / History — §1 |
| Per-doc version history (dropdown on each PRD) | **Already shipped**, scattered across `ProjectPRDSection` + `WorkflowPRDSection` | **Consolidate** into one History subtab — §1.2 |
| Multi-document Notes with reader integration | **Does not exist.** Today's `ProjectNotesSection` is one autosaving textarea | **New build** — §2 |
| Prompt Transcript (auto-captured AI log) | **Already shipped**, same file, unrelated to Notes | No change — do not conflate with §2 |
| Reader inline edit (click text → edit → Save/Discard) | **Does not exist** — no doc content is editable in place anywhere today | **New build**, reader-only — §2.3 |
| Document card copy: type + summary, no trailing arrow | Not yet applied anywhere in the rail | Apply — §4 |
| Reader caption line (author · created · updated · version) | Reader pane doesn't exist yet (Phase D); this is its header spec | Build alongside Phase D — §5 |

---

## 1. Project tab: Overview / Spec / History

`ProjectDocTab.tsx` already has exactly this three-way shape — `DocMode = 'overview'
| 'project-prd' | 'workflow-prd'`, a button row at the top, and per-mode content
below. The restructure below **keeps that architecture** and changes what the last
two modes render and what they're called.

```
DocMode = 'overview' | 'spec' | 'history'
```

### 1.1 Spec — a collection, not an inline document

Today `project-prd` mode renders the full `ProjectPRDSection` — every section's full
markdown — inline in the rail at rail type scale. That is exactly the anti-pattern
the base spec's rule 1.3/1.4 exists to kill: **reader typography ≠ rail typography,
and a document you can read is a document open in the reader, not scrolling past in
a 400px column.**

Replace the `project-prd` and `workflow-prd` modes with one `spec` mode that lists
documents as cards and opens each one in the reader:

```
PROJECT PRD · 1
[ card: title from prd, "PRD · <updatedAt date>", 1-2 line summary, Open ]

WORKFLOW SPECS · <workflowSummaries.length>
[ card per workflow with a generated WorkflowPRD, same shape ]
[ + Add workflow spec — only if a workflow has no PRD yet; triggers the existing
  generate flow, does not scaffold a blank doc ]
```

Card shape and copy rules are in §4 — apply them here.

**Where the summary text comes from** (open question, needs a decision before
build): neither `ProjectPRD` nor the workflow PRD type currently stores a short
description — `ProjectPRDSection`/`WorkflowPRDSection` only have `sections[]`. Two
options: (a) take the first ~140 characters of the first section's content, stripped
of markdown, or (b) add a `summary` field the generation prompt fills in alongside
`sections`. (b) reads better and costs one field in `prdEngine.ts`'s generation
schema; (a) ships with zero engine changes. Recommend (b) if a PRD regeneration pass
is already planned, (a) otherwise.

**Clicking a card** opens the reader (Phase D) with that document loaded — same path
as an artifact card in chat. `ProjectPRDSection`'s and `WorkflowPRDSection`'s
existing per-section rendering (`DocSection`, Accept/Reject, per-section AI) moves
into the reader unchanged; only the rail-inline copy of that rendering is deleted.
No section-editing logic is rewritten, just relocated and given `density="reader"`
per the base spec §D.

### 1.2 History — one timeline, not per-doc dropdowns

Today, version history is two separate `DropdownMenu`s: `ProjectPRDSection`'s
`History` icon button (reading `loadProjectPRDHistory`) and — by the same pattern —
whatever `WorkflowPRDSection` uses for its own workflow PRD versions. Comments
resolutions and note edits have no history surface at all.

Replace both dropdowns with one `history` mode: a single reverse-chronological
timeline merging every versioned event across the project's documents:

```
merge:
  loadProjectPRDHistory(projectId)               → PRDVersion<ProjectPRD>[]
  loadWorkflowPRDHistory(projectId, workflowId)   → per workflow, same shape
  (new) note edit history, if notes get versioning — see §2.4
sort by createdAt, descending
render: title of the event · relative/absolute date · reason · restore action
```

Each `PRDVersion` already carries `version`, `createdAt`, and `reason` (see
`ProjectPRDSection`'s dropdown item — `v{version}` · `{date} · {reason}`), so the
timeline row is a direct read, not a new data shape. The restore action calls the
existing `restoreProjectPRDVersion` / workflow equivalent — **do not build a new
restore path.**

If `WorkflowPRDSection` doesn't already expose a `loadWorkflowPRDHistory`-shaped
function under a different name, that's the one net-new read function this section
needs; everything else is composition of what's already there.

### 1.3 Tab primitive — unchanged

Same pill styling as the base spec's §4 tab primitive (`#EEEEF1` active, 11.5px,
never violet). Only the label set and the two modes' contents change:
`Overview · Spec · History` replaces `Overview · Project PRD · Workflow PRD`.

---

## 2. Notes — multi-document, reader-integrated

### 2.1 Today

`ProjectNotesSection.tsx` is a single textarea, autosaved 2s after the last
keystroke to `kiteframe-notes-${projectId}` as `{content, lastSaved}`. One note per
project, full stop. This is a real, load-bearing feature — do not delete the
storage key; see §2.5.

Separately, the same file renders a **Prompt Transcript** — a read-only log of AI
prompts/responses from `kiteframe-prompt-transcript-${projectId}`. That's already
"a place to capture the transcript of the prompt" and is unrelated to the notes
feature below. Leave it exactly as it is.

### 2.2 New shape

Notes become a list, authored the same way the rail already treats Documents:

```
NOTES · <count>                                              [+ New]
[ textarea — drafts the CURRENT note; empty until "+ New" or an existing
  note is being composed fresh ]
[ card list below the textarea, one per saved note:
  title (first line of body, ≤40 chars) · "<date> · <n> chars" · Open ]
```

`+ New` (small pill button, top-right of the section header — not a full-width
primary button) takes the current textarea content, pushes it onto the notes array
as a new entry, and clears the textarea for the next one. Empty drafts are not
saved (same guard as today's autosave — `notes.length > 0`).

### 2.3 Opening a note — reader integration

Clicking **Open** on a note card opens the reader pane (Phase D) exactly like a
document card, with one difference: the reader's contents nav (normally numbered
PRD sections) is swapped for **a list of the user's notes**, titled the same as
their cards. Clicking another note in that nav swaps the reader body to that note's
content — this is a nav/body swap, not a fresh reader-open, so it does not
re-trigger the reader's mount/layout logic.

This means `ReaderPane.tsx` (Phase D, new) needs a `mode: 'doc' | 'notes'` split at
build time, not as a retrofit:

- `mode: 'doc'` — today's spec: numbered sections, scroll-spy, per-section AI.
- `mode: 'notes'` — nav renders one row per note (no numbers/dots needed — notes
  don't carry the "missing content" semantics a PRD section does); body renders
  exactly one note at a time, swapped on nav click, not scrolled to.

Both modes share the reader's chrome (header, resize, the 400px measure, the
516–800px width contract) — only the nav's data source and the body's
click-vs-scroll behavior differ. Do not fork a second reader component.

### 2.4 Inline edit — new capability, reader-only

Clicking into a note's title or body in the reader puts that note in an editable
state:

```
click title or body  → contentEditable on, dashed outline around the note body
                        (visual cue that this is a live edit, not display text)
header tools swap:      normal ⟲ ⧉ ↓ ✕ (version history / copy / export / close)
                         → Discard  ·  Save changes   (icons: undo-arrow / check)
Save changes    → write title (from the edited heading) + body back to the note's
                  storage entry, exit edit state, re-render the note card and nav
                  row (title may have changed)
Discard changes → revert the DOM to the pre-edit snapshot, exit edit state, no write
```

Switching to a different note, or closing the reader, while an edit is uncommitted
**discards silently** — there is no "unsaved changes" interrupt dialog in this
spec. If that's too permissive for production, the fix is a confirm-on-navigate
guard around the same `discardNoteEdit` call, not a redesign.

This inline-edit pattern is genuinely new — nothing in the reader or the rail is
click-to-edit today (PRD sections use an explicit edit affordance via `DocSection`,
not a bare content click). Keep it scoped to notes; do not extend it to PRD
sections in this pass.

### 2.5 Storage — migrate, don't replace

Current: `kiteframe-notes-${projectId}` → `{content: string, lastSaved: ISOString}`.

New: the same key becomes an array:

```ts
{
  notes: Array<{
    id: string;
    title: string;
    author: string;        // the acting user; "You" if no identity system to draw from
    createdAt: string;      // ISO
    updatedAt: string;      // ISO, bumped on every Save changes
    body: string;
  }>
}
```

**Migration:** on first read, if the stored value matches the old shape
(`{content, lastSaved}` with no `notes` array), wrap it as a single note (`title`
derived from its first line, `createdAt`/`updatedAt` from `lastSaved`) and persist
the new shape immediately. This key is not read anywhere outside
`ProjectNotesSection` per the current codebase (unlike `notesData` in the base
spec's §4 — that key's four other consumers are `.kiteframe` export, share,
cloud-save, and cross-tab sync; if any of those also read
`kiteframe-notes-${projectId}` directly rather than through this component, grep
for the key before shipping the migration).

---

## 3. Issues / Insights — verify, do not rebuild

`DiagnosticsTab.tsx` already implements essentially everything the redesigned
Issues tab specs: a `Rocket`-icon empty state ("Ready for Test Flight" /
"Test Flight Successful"), a results header with title + "`N` new" badge, a
`Clear All` action, a rerun icon, and a `Filter` dropdown (status + category
checkboxes — richer than a single icon toggle). **No new engineering is indicated
here.** What to check instead:

1. **Naming.** The rail tab and this file's copy say "Insights"; this session's
   reference design called the tab "Issues." Pick one — recommend keeping
   **Insights**, since it's shipped, tested, and named consistently in
   `insights.ts`, `DiagnosticsTab.tsx`, and the base spec's tab glyph list
   (`⚠ Insights`).
2. **Icon/copy alignment** — confirm the tab's icon in `ProjectPanel.tsx` matches
   the glyph the base spec assigns (`⚠`), and that `MIN_EDGES_FOR_TEST_FLIGHT = 2`
   plus its "add at least 3 connected nodes" message text agree with each other
   (they don't today — the constant says 2, the copy says 3).
3. **Read-only mode** already has its own copy ("Insights are generated by the
   project owner") — no gap there either.

If a future pass wants the simpler icon-row treatment (rocket + filter + clear, no
dropdown) shown in `rail-reader-kit.html`, that would be a **simplification** of
`DiagnosticsTab.tsx`'s filter dropdown into a single-click toggle, trading away the
category/status filtering it already has. Not recommended without a stated reason.

---

## 4. Card conventions — apply everywhere a doc/note is listed

Applies to Documents (Overview), Spec's PRD + workflow-spec cards, and Notes cards.

```
title        card-t equivalent, one line, truncate
meta         "<Doc type> · <date>"   e.g. "PRD · Aug 18", "Workflow spec · Aug 14"
             NOT section count / draft-state / word count — those describe the
             file, not what's in it
summary      1-2 lines, plain sentence(s) — what the doc is actually about
action       "Open" — no trailing arrow glyph on the label itself
```

The arrow was previously part of the label (`Open →`) in two places: rail document
cards and the chat artifact card's footer ("Open in the reader →"). Both drop the
arrow; the affordance is the whole row being a button, not a glyph.

---

## 5. Reader caption line

Per the base spec's §4 "Structure," the reader header carries the doc title plus a
small mono caption under it. Specify that caption precisely:

```
Document (PRD / workflow spec):
  "<Author> · Created <date> · Updated <date> · v<n>"

Note:
  "<Author> · Created <date>"
```

Small caption type — 9.5–10px mono, `--muted-foreground` (`--rk-fg-faint` in the
reference file), not the reader's 15px body scale. If a shared `.doc-meta`-equivalent
class is used for both this caption and other reader body copy, give the caption
its own more-specific selector — a generic per-tag rule (e.g. "all `<p>` in the
doc body are 15px") will silently override a lower-specificity class rule of the
same specificity order, which is a known trap from this pass, not a hypothetical
one.

`Author` for documents is whoever generated or last edited it (fall back to "AI" or
the workspace's single-user identity if no multi-author system exists yet).
`Author` for notes is the user who created it — "You" is an acceptable placeholder
until there's a real identity to show.

---

## 6. Files to touch

| File | Change |
| --- | --- |
| `panels/ProjectPanel/ProjectDocTab.tsx` | Collapse `DocMode` from 4 states to 3 (`overview \| spec \| history`); replace the `project-prd`/`workflow-prd` button pair with `Spec`/`History`; new render branches per §1 |
| `panels/ProjectPanel/sections/ProjectPRDSection.tsx` | Its section-rendering body (title, sections, per-section AI) relocates into the reader (Phase D); what stays in the rail becomes a single card per §1.1/§4, plus the `Generate`/`Regenerate` action when no doc exists yet |
| `panels/ProjectPanel/sections/WorkflowPRDSection.tsx` | Same relocation, one card per workflow with a generated PRD |
| **New:** `panels/ProjectPanel/sections/ProjectHistorySection.tsx` | Merges `loadProjectPRDHistory` + workflow equivalents (+ notes, if versioned) into one timeline per §1.2 |
| `panels/ProjectPanel/sections/ProjectNotesSection.tsx` | Rework per §2: multi-note storage + migration (§2.5), card list UI, `+ New`, remove nothing about the Prompt Transcript block |
| `components/docs/ReaderPane.tsx` (new in Phase D) | Add `mode: 'doc' \| 'notes'`; notes-nav + inline-edit per §2.3–2.4; caption line per §5 |
| `lib/kiteframe/utils/prdStorage.ts` | If (b) is chosen in §1.1, add a `summary` field to the PRD generation/save shape; otherwise no change |
| `panels/ProjectPanel/DiagnosticsTab.tsx` | No functional change — verify per §3 only |
| `ai/prdEngine.ts` | Only if §1.1 option (b) is chosen — one field added to the generation schema |

## 7. Acceptance criteria

- Project tab shows exactly three subtabs: Overview, Spec, History. No dead
  `project-prd`/`workflow-prd` mode remains reachable.
- Spec lists the project PRD and every workflow with a generated PRD as cards
  (type + date + summary + Open, no arrow); clicking Open loads that doc in the
  reader, not inline in the rail.
- History shows every document's versions merged into one reverse-chronological
  list; restoring from it calls the existing restore functions unchanged.
- A user can create a second, third, nth note without losing the first; each is
  independently titled, openable, and editable.
- Opening a note in the reader shows all notes as the contents nav; clicking
  another note swaps the body without closing/reopening the reader.
- Clicking into a note's title or body in the reader enters an editable state;
  Save changes persists title/body and updates the card/nav; Discard reverts with
  no write.
- A project with the legacy single-note format opens with that note intact as
  note #1 — no data loss on first load post-migration.
- Issues/Insights tab behavior matches `DiagnosticsTab.tsx` as already shipped;
  the empty-state edge-count copy and the `MIN_EDGES_FOR_TEST_FLIGHT` constant
  agree with each other.
- Every document/note card in the rail reads "Open," never "Open →."
- The reader's caption line matches §5's two formats and does not inherit the
  body's 15px type size.
