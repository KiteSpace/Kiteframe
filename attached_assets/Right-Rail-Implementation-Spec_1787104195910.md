# Right rail · reader pane · chat — implementation spec

Scope: the **editor** right rail, the document reader pane, and chat behavior.
Shared / view-only mode is deferred (see `Refactor-Scope.md` §6) — it reuses these components once they exist.

Source of truth: `KiteSpace/Kiteframe@main`, read 2026-08-18. Color/type = `THEME.md`. Geometry/behavior = `Kiteframe-left-rail-handoff.md` + `Right Rail Audit.dc.html` (4b = the reader).

---

## 0. The one finding that changes the plan

**The artifact card needs no new architecture.** `ChatBubble` already dispatches on optional fields of `ChatMessage`:

| Existing field | Renders |
| --- | --- |
| `message.workflowProposal` | `<WorkflowThumbnail nodes edges />` |
| `message.designPreview` | `<DesignPreviewCard preview />` |
| `message.type === 'edge_case_selector'` | `<EdgeCaseSelector />` |
| `message.type === 'edge_case_selected'` | the green ✓ confirmation block |

So the artifact card is **one more optional field + one more branch**, following a pattern the codebase already uses three times. That moves Phase D from "decompose a 153KB file" to "add a field, a card, and a threshold rule." `KiteAIChat.tsx` gets *touched*, not restructured.

---

## 1. Files to touch

| File | Size | Change | Risk |
| --- | --- | --- | --- |
| `panels/ProjectPanel/ProjectPanel.tsx` | 16KB | **Rewrite** — tab primitive, keep-alive, URL sync, viewport-aware width | Low. Self-contained, 44 props stay. |
| `panels/ProjectPanel/NotesTab.tsx` | 13KB | **Delete** — after rendering `ProjectNotesSection` in the Project tab (see §4) | Low, but **ordered** |
| `panels/ProjectPanel/ProjectDocTab.tsx` · notes | — | Add `<ProjectNotesSection />`, mirroring Sources at :445 | Low |
| `panels/ProjectPanel/SpecsTab.tsx` | 21KB | **Delete** — unreferenced | Low |
| `panels/ProjectPanel/SourcesTab.tsx` | 8KB | **Delete** — superseded by `sections/ProjectSourcesSection` | Low |
| `panels/ProjectPanel/ProjectDetailsTab.tsx` | 13KB | **Delete** — unreferenced | Low |
| `components/docs/DocSection.tsx` | 23KB | Add `density` prop; fix list rendering | Low |
| `components/docs/ReaderPane.tsx` | — | **New** | — |
| `panels/ProjectPanel/ProjectDocTab.tsx` | 25KB | Add "open in reader" affordance; keep as rail summary | Medium — owns PRD state |
| `components/chat/ChatBubble.tsx` | 12.6KB | Add `artifact` branch | Low |
| `components/chat/ChatMessageList.tsx` | 6.6KB | Remove duplicate "Thinking…", drop `pb-96`, replace `scrollIntoView` | Low |
| `components/chat/ArtifactCard.tsx` | — | **New** | — |
| `components/KiteAIChat.tsx` | 153KB | `ChatMessage` type + artifact detection at response-handling | Medium — surgical only |
| `lib/kiteaiTranscript.ts` | 24KB | Persist `artifact` through serialize/hydrate | Medium |
| `server/shareHandlers.ts` + PRD persistence | — | Server-side doc persistence (see §2) | **High — but blocking** |
| `pages/workflow-editor.tsx` | 722KB | Mount the reader pane. **Nothing else.** | High — one insertion only |
| `THEME.md` §7 green rule | — | `Create` / `Add` → ink; green = success only | Low — audit during C |

Do **not** touch: `design/DesignEditor.tsx`, `design/resolver.tsx`, `components/layers/*` (already virtualized + worker-backed — reskin only), `pages/DevDocs.tsx`.

---

## 2. Phase A — bugs, root-caused

Ship first, independently. Each is a known line, not an investigation.

**A1 · Orphan bullets in every PRD (D2).**
`DocSection.tsx` `markdownComponents`: `ul` uses `list-disc list-inside`. The generated markdown is a *loose* list, so each item's content is wrapped in `<p>`, which is a block — the marker renders on its own line and the text drops below. Fix: `list-outside` + `pl-5`, and `li > p { margin: 0 }`. Affects every PRD in production.

**A2 · `pb-96` dead space in full-screen chat (D6).**
`ChatMessageList.tsx`: `className={...  mode === 'fullscreen' ? 'pb-96' : ''}` — 384px of bottom padding, unconditional. That *is* the empty column below the last message. Replace with the composer's measured height (or a `min-height` on the thread + `justify-content: flex-end` so short threads sit above the composer instead of floating at the top).

**A3 · Duplicate progress (D4).**
`ChatMessageList.tsx` renders `<Loader2 /> Thinking…` when `isLoading`; a separate toast says "Generating workflow…" at the same time. Keep the in-thread one (it's positionally meaningful), drop the toast — or keep the toast only when the panel is collapsed.

**A4 · Panel can exceed the viewport (D3, the clipped `yes` bubble).**
`ProjectPanel.tsx`: `Math.max(400, Math.min(800, newWidth))` clamps against constants only, never `window.innerWidth`. A restored 800px width on a narrow window pushes the rail's right edge past the viewport, so right-aligned user bubbles are cut by the *window*, not by any container — which is why `max-w-[85%]` looks like it should be safe and isn't. Fix: clamp against `Math.min(800, window.innerWidth - MIN_CANVAS)` on read, on resize, and on window resize.

**A5 · `scrollIntoView` in the message list.**
`ChatMessageList.tsx` `scrollToBottom` calls `messagesEndRef.current?.scrollIntoView(...)`. This scrolls the nearest scrollable ancestor and can move the whole editor shell, not just the thread. Replace with `viewport.scrollTop = viewport.scrollHeight` on the already-captured `viewportRef`.

**A6 · `Updated: Unknown` (D10).** `updatedAt` is absent from the `/api/view` payload and from details. Add it where the doc persistence lands (§3).

---

## 3. Phase B — document persistence (blocking, do not defer)

PRD content lives in **localStorage**. `viewSharedProjectHandler` reads `workflowData.prdData` / `.documentation.projectPRD`, and its own comment says those are *"written by SavedProjectsDrawer when the user explicitly saves to the cloud."*

Consequences today: docs vanish on device change, can't be shared, can't be deep-linked, and can't be reopened from a chat artifact card after a reload. **Every later phase depends on this.**

Required:

1. Persist PRD sections server-side on generate and on section save (debounced), not on cloud-save. Reuse the existing `prdData` / `workflowPRDs` shape so the share path and `.kiteframe` v2.1.0 export keep working unchanged.
2. Return `updatedAt` in the payload (fixes A6).
3. Give each document a stable id so the reader pane and artifact card can address it: `{projectUuid, docKind: 'project-prd' | 'workflow-prd', workflowId?}`.
4. Keep localStorage as an offline cache, not the system of record.

This is the same work as open question #2 ("where does an artifact live?"). One job, not two.

---

## 4. Phase C — rail shell (`ProjectPanel.tsx` rewrite)

### Tab set

`kite-ai · project · layers · comments · diagnostics` — **Notes removed**. Type stays `ProjectPanelTab` minus `'notes'`.

### Notes: finish the migration, then delete — revised 2026-08-19

Full-repo grep shows `NotesTab` is deletable but **`notesData` is not dead**. It is load-bearing in four places unrelated to the tab:

| Consumer | Line | Role |
| --- | --- | --- |
| `pages/ViewOnlyViewer.tsx` | 176, 269 | hydrates `kiteframe-notes-${shareId}` from the share payload |
| `pages/workflow-editor.tsx` | 17540 | `.kiteframe` v2.1.0 export |
| `pages/workflow-editor.tsx` | 7592, 7629, 7875 | doc bundle read / restore / share post |
| `pages/workflow-editor.tsx` | 8056 | cross-tab storage-event sync |
| `components/SavedProjectsDrawer.tsx` | 63 | cloud-save payload type |

`sections/ProjectNotesSection.tsx` exists and is exported from `sections/index.ts`, **but nothing renders it** — unlike `ProjectSourcesSection`, which is live at `ProjectDocTab.tsx:445`. The Sources migration into the Project tab was completed; the Notes migration was started and abandoned.

Deleting `NotesTab` alone would therefore leave `notesData` serialized into share, export and cloud-save with **no UI to author it**.

**Required order:**

1. Render `<ProjectNotesSection projectId={projectId} />` in `ProjectDocTab`, mirroring Sources at :445.
2. Verify notes read/write against the existing `kiteframe-notes-${projectId}` key (`ProjectNotesSection.tsx:19` already computes it — identical to `NotesTab.tsx:29`).
3. Then delete `NotesTab.tsx` and its tab entry.

The persistence chain is untouched by all three steps — same storage key, so share, export and view-only keep working with no changes. Do **not** strip `notesData` from any payload; that would break `.kiteframe` v2.1.0 compatibility.

### Dead code removed in this phase — verified 2026-08-19

`SpecsTab` (21KB), `SourcesTab` (8KB), `ProjectDetailsTab` (13KB) are all unreachable. Each name occurs only in its own `interface` / `export function` declaration; nothing imports them, and `ProjectPanel/index.ts` exports only `ProjectPanel`, `KiteAITab`, `LayersTab`, `ProjectDocTab`.

`SourcesTab` is a stranded duplicate of `sections/ProjectSourcesSection.tsx` — identical `kiteframe-sources-${projectId}` key and `SOURCES_UPDATED_EVENT` listener. The section version *is* live, rendered at `ProjectDocTab.tsx:445`. The migration into the Project tab was completed and the old tab file left behind.

**Consequence: `SpecsTab` does not overlap the reader's job** — it isn't reachable, so C and D are unaffected. ~42KB deleted.

Verified by full-repo grep 2026-08-19 (`grep -rn` over `client/src`, which covers the 722KB `workflow-editor.tsx` that exceeds the code-search size cap): six hits total, every one a declaration in the component's own file. No imports, no JSX usage. Safe to delete.

### Tab primitive (from the audit; unify against this everywhere)

```
row      height 46 · padding 0 8px · gap 3 · border-bottom 1px --border
chevron  22px wide, centered glyph, --muted-foreground, 13px
tab      display flex · align center · gap 5 · padding 5px 10px · radius 7
         font 12px · weight 600 active / 500 inactive
         color --foreground active / --muted-foreground inactive
         background #EEEEF1 active / transparent · white-space nowrap
icon     11px · #9A9AA3 · Violet Flash (--brand) for the AI tab only
badge    9px/700 · radius 999 · padding 3px 5px · info-soft fill
labels   progressive — see below
glyphs   ✦ KiteAI · ▤ Project · ☰ Layers · ◌ Comments · ⚠ Insights
```

**Progressive labels.** Five labelled tabs intrinsically need 466px; the rail floor
is 400px, so at the minimum width the fifth tab clips. Below 480px only the active
tab carries its label — inactive tabs are icon + badge with a tooltip; at 480px and
above all five labels show. Drive it from a ResizeObserver on the rail or a container
query, **not** a window media query (the rail resizes independently of the window).
Full reasoning and rejected alternatives in `README-right-rail.md` §2.1.

No segmented track, no white active card, no shadow. Sub-tab rows (Overview / Project PRD / Workflow PRD) use the same pill at 11.5px — **active is `#EEEEF1`, not violet.** Violet is identity and selection (reader nav, current document), never tab state.

### Behavior changes

1. **Stop unmounting on tab switch.** Today only `project` is `forceMount`; everything else loses scroll position and draft input on every switch. Make all panes `forceMount` + `data-[state=inactive]:hidden`, or wrap in a keep-alive. This is why `project` was special-cased — generalize it rather than adding a second exception.
2. **URL-addressable panels.** `wouter` + `?panel=project&doc=workflow-prd&section=requirements`. Nothing in the rail is linkable today; the reader pane must be.
3. **Viewport-aware width** (A4).
4. **Replace the bespoke drag** with `react-resizable-panels` — already a dependency, and `components/ui/resizable.tsx` already exists and is unused here.

### Contracts that must not change

- localStorage keys `kiteframe-project-panel-collapsed`, `-active-tab`, `-width` (migrate a stored `'notes'` value → `'project'`).
- `kiteframe-notes-${projectId}` — read by share, export and view-only. Survives the `NotesTab` deletion unchanged.
- The `forceTab` prop, including its force-expand side effect.
- All 44 props and their names — `workflow-editor.tsx` prop-drills them and must not be edited in this phase.
- Collapsed rail = 48px icon strip with tooltips; clicking an icon expands to that tab.

---

## 5. Phase D — reader pane

**Placement: inboard of the rail.** Canvas compresses, reader sits between canvas and rail, rail keeps working. Confirmed direction (audit 4b). Not an overlay, not a full-page takeover.

```
[ canvas (flex, min 320px) ][ reader 516–800px ][ rail 400–800 ]
```

Below ~1150px total the reader **overlays** the canvas instead of compressing it — at
defaults three fixed columns need 1340px, and on a narrower window the rail is what
gets pushed off screen, which reproduces the A4 bug this spec exists to fix. The
invariant is `rail.getBoundingClientRect().right <= window.innerWidth` with the reader
open or closed. **Opening the reader must clamp, not just drag and window-resize** —
opening is the common path into an over-committed layout. Geometry and the mode switch
in `README-right-rail.md` §4.1 and `right-rail.html`'s `layout()`.

### Structure

- **Header, 52px** — doc title · confidence chip · `v3 · <date>` · copy · export · close. Resize handle on the left edge.

**Width: resizable 516–800px, default 660, remembered per project** (decided) — matches the rail. Key `kiteframe-reader-width-${projectUuid}`, clamped against `window.innerWidth` with the rail's width subtracted, same guard as A4.

The 400px measure holds at **every** width — what yields is the contents nav, which collapses to a 40px numeral strip below 638px of reader. **These widths are derived, not chosen:** `nav 162 + padding 64 + scrollbar 12 + measure 400 = 638` (full-nav threshold) and `nav 40 + padding 64 + scrollbar 12 + measure 400 = 516` (floor). A declared floor of 520 with a 162px nav yields a 283px measure — the pane's whole justification, silently gone. Full reasoning and the two traps in `README-right-rail.md` §4.2.
- **Contents nav, 162px** — numbered sections; amber dot on sections with open questions or missing content; click scrolls (one continuous document, not paged). Collapses to a 40px numeral strip below 638px of reader (§4.2 of the README) — numbers and dots stay, labels move to tooltips.
- **Body** — `overflow-y: auto`, `padding 28px 32px 56px`, **`max-width: 400px` measure.**

### Typography — the whole point

Per `THEME.md` §8, reader ≠ rail:

| Element | Reader | (rail today) |
| --- | --- | --- |
| Doc title | 26px / 1.15 / 600 | 16px (`text-base`) |
| Section heading | 18px / 1.3 / 600 | 14px (`text-sm`) |
| Body | **15px / 1.7 / 400** | 14px |
| Measure | **400px, at every pane width** | full panel |
| Any numeric value | `--font-mono` | mixed |

### `DocSection` gets a density prop

```ts
density?: 'rail' | 'reader'   // default 'rail'
```

Replaces the hardcoded `text-sm` / `text-base` in `markdownComponents`. One component, two scales — do **not** fork a second section component. `@tailwindcss/typography` is installed and unused; the reader is where `prose` earns its place.

### What the reader owns vs. the rail

- **Reader:** reading, per-section AI (**Suggest · Refine · Elaborate · Add examples** — decided; `Reset` drops, it's undo by another name and belongs in the version control already in the header), Accept/Reject on suggestions, section-anchored comments, version recovery.
- **Rail Project tab:** stays as the *summary* — overview, workflow list, document list with "open in reader." It stops being where you read 2,000 words.

### The AI-suggestion problem this solves

`DocSection`'s inline suggestion (`getRouter().chat({taskType:'prd_generation', maxTokens:1000})`) and `prdSteward`'s `ReviewSuggestionCard` both render full-section replacements — ~150+ words — in a 520px column with a `max-h-24` scroller and Accept/Reject. Accepting prose you can't read is a coin flip. In the reader, at a 400px measure with real leading, it's a decision.

### State rules

- Opens from: a document card in the rail, an artifact card in chat, or a URL.
- Reads selection stores; **writes none.** Opening the reader must not disturb canvas or layer selection (9 stores, no single manager — see `Refactor-Scope.md` §1.6).
- Autosave, no Save button. Header shows state; every regenerate snapshots the prior version; `⟲ v3` is recovery, not save.

---

## 6. Phase E — chat artifact card

### Data model

Add to `ChatMessage` in `KiteAIChat.tsx`:

```ts
artifact?: {
  id: string;                  // stable doc id from §3
  kind: 'document' | 'design' | 'analysis';
  title: string;
  meta: string;                // "12 sections · 1,840 words · draft"
  excerpt?: string;            // first ~200 chars, for the collapsed state
};
```

Then one branch in `ChatBubble`, beside the existing `workflowProposal` / `designPreview` branches, rendering `<ArtifactCard artifact={...} onOpen={openReader} />`.

### Card treatment (audit 4b)

Bordered card, 26px icon tile, title + mono meta line, and a footer strip. When its document is open in the reader the card is highlighted — `border --brand` + `box-shadow 0 0 0 3px rgba(155,107,255,.14)` + footer `● Open in the reader` on `#FAF8FF` — so the link between conversation and document is never lost.

### The threshold rule — needs your call

What makes a response an artifact instead of a message. Options, in order of my preference:

1. **Task-type driven** (recommended) — `taskType: 'prd_generation'` and doc-shaped tasks always produce an artifact; chat never does. Deterministic, testable, no heuristics.
2. Structural — ≥2 markdown headings or ≥400 words.
3. Model-declared — the response names its own artifact.

Whichever: a **clamp** stays as the safety net for anything the rule misses — assistant bubbles cap at ~12 lines with "Show more," because `max-w-[65ch]` at `text-sm` in a 520px rail never actually engages.

### Persistence

`lib/kiteaiTranscript.ts` must serialize and rehydrate `artifact` alongside `workflowProposal` / `designPreview`. Card + reader both address the doc by the §3 id, so an artifact card still opens after reload.

---

## 7. Acceptance criteria

**A** — PRD lists render with markers inline; full-screen chat has no dead band below the last message; exactly one progress indicator per operation; rail never exceeds the viewport at 1024px wide with a stored 800px width; scrolling the thread never moves the shell.

**B** — Switching tabs and returning preserves chat scroll, chat draft, and doc scroll. `?panel=layers` opens Layers directly. A stored `'notes'` tab migrates silently. Collapse/expand and `forceTab` behave as before. All five tabs are reachable at the 400px minimum width. Notes are authorable in the Project tab, and a project with notes still round-trips through `.kiteframe` export → import and through a share link.

**C** — Generating a PRD, hard-reloading, and opening the project shows the PRD without a manual cloud save. `updatedAt` is populated.

**D** — A 2,000-word PRD reads at 15/1.7 on a ~400px measure with a 26px title. Contents nav jumps to sections. Opening the reader leaves canvas selection unchanged. Accept/Reject shows the suggestion at reader width. Opening the reader on a 950px window overlays the canvas and leaves the rail fully on screen. The measure is exactly 400px at the 516 floor, at 637/638, at the 660 default, at 800, and in overlay mode — not only at the widest width.

**E** — A generated PRD arrives as a card, not 800 words of markdown. Clicking it opens the reader. After reload the card still opens. Any long response that isn't an artifact is clamped with "Show more."

---

## 8. Order and staging

```
A  bug fixes            independent, ship immediately
B  document persistence  blocks C·D·E  ← server work, start in parallel with A
C  rail shell            needs A4
D  reader pane           needs B + C
E  artifact card         needs B + D
```

Four PRs: **A**, **B**, **C**, **D+E** (the card is meaningless without the reader to open).

`workflow-editor.tsx` is touched exactly once, in D, to mount the reader. If a change seems to require editing it earlier, that's a signal the change belongs in `ProjectPanel` instead.

---

## 9. Decisions — all settled 2026-08-19

1. **Artifact threshold** — task-type driven. `taskType: 'prd_generation'` and doc-shaped tasks always produce an artifact; chat never does. No word-count heuristics. Clamp stays as the safety net (§6).
2. **Reader width** — resizable 520–800px, remembered per project (§5).
3. **`SpecsTab` / `SourcesTab` / `ProjectDetailsTab`** — all dead, all deleted in C (§4).
4. **Green primary** — **move to ink/violet; green is success states only.** `Create` / `Add` become ink. Audit every green affordance in the rail against `THEME.md` during C; note it in `THEME.md` as a palette rule so it doesn't creep back.
5. **Per-section AI** — Suggest · Refine · Elaborate · Add examples. `Reset` dropped (§5).
