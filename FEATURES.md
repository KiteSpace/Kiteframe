# KiteFrame — Full Feature Inventory

> **App:** KiteFrame — Visual Workflow Editor & UI Design Tool  
> **Core library:** `@kiteline/core` (open-source npm package)  
> **Last updated:** 2026-07-25

---

## Table of Contents
1. [Canvas & Workflow Editor](#1-canvas--workflow-editor)
2. [Node Types](#2-node-types)
3. [Edge / Connection Tools](#3-edge--connection-tools)
4. [UI / Interface Builder (Design Mode)](#4-ui--interface-builder-design-mode)
5. [KiteAI Assistant](#5-kiteai-assistant)
6. [Project & File Management](#6-project--file-management)
7. [Import](#7-import)
8. [Export & Documentation](#8-export--documentation)
9. [Collaboration & Sharing](#9-collaboration--sharing)
10. [Account & Subscription](#10-account--subscription)
11. [Settings & Customization](#11-settings--customization)
12. [UI Locations Map](#12-ui-locations-map)
13. [Competitive Comparison](#13-competitive-comparison)

---

## 1. Canvas & Workflow Editor

**Location:** Main editor page (`/workflow-editor`), primary canvas surface

| Feature | Notes |
|---|---|
| Drag-and-drop node placement | From gallery or quick-add menu |
| Multi-select nodes & edges | Click-drag lasso or Shift+click |
| Move selected group as unit | Nodes and strokes |
| Undo / Redo | Full history stack with named steps |
| Zoom & pan | Scroll wheel, pinch-to-zoom, Ctrl+scroll |
| Fit-to-view | Keyboard shortcut + toolbar button |
| Minimap | Collapsible overview of full canvas |
| Snap guides | Auto-align nodes while dragging |
| Grid / snapping | Optional background grid |
| Context menus | Right-click on nodes, edges, canvas |
| Keyboard shortcuts | N=new node, G=AI generator, and many more |
| Floating action toolbar | Appears on node selection (delete, duplicate, style) |
| Canvas background color | Configurable per artboard / canvas |
| Dark-mode artboard auto-text correction | Text color auto-adjusts when artboard background changes |
| Experiment / speculative branching nodes | Mark branches as experimental |
| Multiple tabs | Open multiple workflows side-by-side in tabs |
| Design tabs | Separate tab type for UI mockups linked to a workflow |
| Workflow ↔ design sync badge | Badge on design tab links back to source workflow by UUID |
| Stale-design banner | Prompts to regenerate when source workflow has changed |

---

## 2. Node Types

**Location:** Node Gallery (right sidebar), canvas drag-drop, quick-add menu

| Node Type | Description |
|---|---|
| **Input** | Entry point / trigger step |
| **Process** | Generic action/operation |
| **Condition** | Branching / decision (if/else) |
| **Output** | Result / end step |
| **AI Task** | Dedicated AI-powered processing step |
| **Image** | Embed / reference an image |
| **Table** | Structured tabular data node |
| **Form** | UI form definition node |
| **Code** | Code snippet / scripting step |
| **Webview** | Embedded web content preview |
| Custom icons & colors | Per-node styling |

---

## 3. Edge / Connection Tools

**Location:** Canvas — draw by dragging from node handles

| Feature | Notes |
|---|---|
| Bezier edges | Smooth curved connectors |
| Straight edges | Direct line connectors |
| Edge labels | Add text to any connection |
| Edge properties panel | Edit style, label, type in right sidebar |
| Self-connecting edges | Loop edges on a single node |
| Multi-point routing | Drag edge midpoints to reshape path |

---

## 4. UI / Interface Builder (Design Mode)

**Location:** Design tab (linked from workflow node), artboard canvas

| Feature | Notes |
|---|---|
| Artboard canvas | Separate canvas surface per UI screen |
| AI-generated interfaces | Generate from workflow context + text prompt |
| Component palette | Pre-built UI components (drag to artboard) |
| Component preview tooltip | Hover to see larger preview before dragging |
| Craft.js-based rendering | Live React component tree |
| Resizable components | Drag handles to resize on artboard |
| Inline text editing | Double-click to edit text in-place |
| Table nodes: column widths | Resize columns; widths saved & reloaded |
| Table nodes: row/column manipulation | AI-aware — preserves cell content |
| Dark-mode artboard support | Auto-corrects text color on background change |
| Artboard deduplication | AI reuse of existing node IDs prevented |
| Import design by name | Name imported screens instead of defaulting to "Screen 1" |
| Design-from-image | Upload a screenshot → AI generates matching UI |
| Update Interface button | Re-generate interface when workflow changes |
| Sync state tracking | Tracks whether design is current with its workflow |
| Figma import | Import frames from Figma URL |

---

## 5. KiteAI Assistant

**Location:** Project panel (bottom collapsible) → KiteAI Chat tab; also inline modals

### Generation
| Feature | Notes |
|---|---|
| Text-to-workflow | Describe a process → full node graph |
| Image-to-workflow | Upload screenshot/diagram → extracted workflow |
| Text-to-UI interface | Generate artboard from workflow node context |
| Add nodes beside existing | AI places new steps adjacent to selected nodes |
| Target specific artboard by name | Instruct AI which artboard to edit |

### Chat & Refinement
| Feature | Notes |
|---|---|
| Conversational refinement | Follow-up messages refine the workflow in context |
| AI memory of previous edits | Context persists across follow-up messages |
| Brainstorm mode | Chat to explore edge cases and alternatives |
| AI error correction | Paste broken JSON → AI repairs it |
| PRD generation | Generate product requirement documents from flows |
| Experiment node suggestions | AI proposes speculative branches |

### AI Model Routing
| Task | Model |
|---|---|
| Reasoning / generation / vision | `claude-sonnet-4-5` |
| General chat | `claude-haiku-3-5` |
| Privacy / self-hosted option | Ollama / custom endpoint |

### Credit Costs
| Action | Credits |
|---|---|
| General chat | 1 |
| Workflow reasoning / experiments / PRD | 2 |
| Vision / image analysis | 3 |

---

## 6. Project & File Management

**Location:** Left sidebar (Workflow Manager), Dashboard, top-level tabs

| Feature | Notes |
|---|---|
| Multiple workflows per project | Organized in left sidebar |
| Cloud save / auto-save | LWW (last-write-wins) sync to server |
| Cloud project UUID | Projects identified by stable UUID, not name |
| Local + cloud dual-write | Snapshot mirror + cloud sync both updated |
| Project limit by tier | Free=20, Advanced/Pro=100, Anonymous=1 |
| Project rename | Inline rename in sidebar |
| Design tab label from title | Tab title reflects actual design name |
| Notes panel | Per-project notes alongside canvas |
| Multi-tab editing | Multiple workflows open simultaneously |
| Tab persistence | Tabs survive page reload |

---

## 7. Import

**Location:** Toolbar → Import menu; Figma integration modal

| Source | Format / Method |
|---|---|
| KiteFrame JSON | File upload with AI error correction fallback |
| Figma | OAuth URL → frame or page import |
| Figma (flattened) | Import as static image |
| Figma (interactive) | Import with semantic metadata |
| Image / screenshot | Vision AI extracts workflow steps |
| Design file | Import existing `.kiteframe` design |

---

## 8. Export & Documentation

**Location:** Toolbar → Export menu; Share modal

### Document Formats
| Format | Description |
|---|---|
| PDF | Rendered workflow document |
| Markdown | Human-readable flow outline |
| PRD | Full product requirements document |

### Technical / Dev Formats
| Format | Description |
|---|---|
| KiteFrame JSON | Full canvas state, re-importable |
| Jira CSV | Import-ready for Jira tickets |
| Workflow outline | Structured text summary |

### AI / Dev Prompts
| Format | Description |
|---|---|
| Prototyping prompt | Prompt for rapid prototyping tools |
| Figma Make prompt | Prompt for Figma AI generation |
| AI Agent System Prompt | System prompt representing the workflow |
| AI Build Instructions | Step-by-step AI coding instructions |

---

## 9. Collaboration & Sharing

**Location:** Share modal (toolbar); view-only URL (`/view/:id`)

| Feature | Notes |
|---|---|
| Shareable view-only links | Unique UUID-based URLs |
| Link revocation | Invalidate a share link |
| Shared view header | Shows project name + owner info to viewers |
| Viewer presence | Viewer count on shared links |
| Comments | Per-node threaded comments |
| Comment authorship | Delete only for author or project owner |
| Read-only mode | Separate toolbar + layers widget for viewers |
| Anonymous viewing | No account required to view shared links |

---

## 10. Account & Subscription

**Location:** Account Settings page; credits widget in main toolbar

| Feature | Notes |
|---|---|
| OAuth sign-in | Google, GitHub, Replit |
| Account linking | Multiple OAuth providers linked by email |
| Firebase ↔ backend session sync | Frontend Firebase auth syncs to Passport sessions |
| Subscription tiers | Free, Advanced, Pro |
| Daily credit reset | Auto-refill every 24 hours |
| Credit allowances | Free=25/day, Advanced=50/day, Pro=150/day, Anon/IP=5/day |
| Unlock codes | Admin-generated codes for bonus credits or unlimited |
| IP-based tracking | Unauthenticated users tracked by IP |
| Stripe checkout | Upgrade subscription via Stripe |
| Stripe customer portal | Manage billing, cancel, change plan |
| Credit display | Live credit counter in toolbar |
| Friendly credit-exhaustion error | Shown during AI refinement when credits run out |

---

## 11. Settings & Customization

**Location:** Account Settings; AI Settings panel

| Feature | Notes |
|---|---|
| Custom AI endpoint | Point KiteAI at Ollama or self-hosted model |
| Theme (dark/light) | App-wide theme toggle |
| Keyboard shortcuts reference | In-app help dialog |
| Canvas snap / grid toggle | Per-session canvas settings |

---

## 12. UI Locations Map

```
┌─────────────────────────────────────────────────────────────────┐
│  Top toolbar: Home · Undo/Redo · Zoom · Share · Export · Auth   │
├──────────┬──────────────────────────────────────┬───────────────┤
│  Left    │          Main Canvas                 │  Right        │
│  Sidebar │  (Workflow nodes / Artboard)          │  Sidebar      │
│          │                                      │               │
│ Workflow │  ┌────────────────────────────────┐  │ Properties    │
│ Manager  │  │  Floating toolbar (on select)  │  │ panel         │
│ (files)  │  │  Delete · Duplicate · Style    │  │               │
│          │  └────────────────────────────────┘  │ Layers        │
│          │                                      │ panel         │
│          │                         [Minimap]    │               │
│          │                                      │ Node          │
│          │                                      │ Gallery       │
├──────────┴──────────────────────────────────────┴───────────────┤
│  Project panel (collapsible bottom)                             │
│    Tabs: KiteAI Chat · Notes · Project Details                  │
└─────────────────────────────────────────────────────────────────┘

Dialogs / Modals:
  Share · Export · Figma Import · JSON Import · Keyboard Shortcuts
  Subscription/Upgrade · AI Settings · Component Preview
```

---

## 13. Competitive Comparison

| Feature | KiteFrame | Figma | Miro | Lucidchart | Whimsical | Notion |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Visual workflow editor** | ✅ | ⚠️ FigJam | ✅ | ✅ | ✅ | ❌ |
| **UI mockup / wireframe builder** | ✅ | ✅ | ⚠️ basic | ⚠️ basic | ✅ | ❌ |
| **AI workflow generation (text)** | ✅ | ⚠️ limited | ❌ | ❌ | ❌ | ❌ |
| **AI workflow generation (image)** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **AI UI generation (text → screen)** | ✅ | ✅ Figma Make | ❌ | ❌ | ❌ | ❌ |
| **Linked workflow ↔ design screens** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **PRD generation from workflow** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Export to AI coding prompts** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Figma import** | ✅ | n/a | ❌ | ❌ | ❌ | ❌ |
| **Jira CSV export** | ✅ | ❌ | ❌ | ⚠️ plugin | ❌ | ❌ |
| **Self-hosted AI (Ollama)** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Open-source canvas library** | ✅ @kiteline/core | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Threaded comments** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View-only share links** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Multiplayer / real-time co-editing** | ⚠️ planned | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Mobile support** | ⚠️ basic | ⚠️ view only | ✅ | ⚠️ view only | ❌ | ✅ |
| **Free tier** | ✅ 25 AI credits/day | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Speculative / experiment branching** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Undo / redo history** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> ✅ = full support · ⚠️ = partial / limited · ❌ = not available · n/a = not applicable

### KiteFrame's Key Differentiators
1. **Workflow-native AI** — generation, correction, and refinement are first-class, not bolt-ons
2. **Workflow ↔ UI linkage** — design screens are structurally tied to specific workflow nodes, with sync tracking
3. **PRD + dev-prompt export** — bridges product design all the way to AI-assisted coding
4. **Self-hosted AI option** — privacy-preserving Ollama integration
5. **Open-source canvas library** — `@kiteline/core` can be embedded in other projects
6. **Speculative branching** — experiment nodes for exploring "what if" paths inline
