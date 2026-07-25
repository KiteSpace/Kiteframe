# KiteFrame — Feature Inventory (Live UI Only)

> **App:** KiteFrame — Visual Workflow Editor & UI Design Tool  
> **Core library:** `@kiteline/core` (open-source npm package)  
> **Last updated:** 2026-07-25  
> _Only features confirmed present in rendered UI code are listed here._

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

**Location:** Main editor page, primary canvas surface

| Feature | Notes |
|---|---|
| Drag-and-drop node placement | From gallery or quick-add popout |
| Multi-select nodes & edges | Click-drag lasso or Shift+click |
| Undo / Redo | Full history stack with named steps |
| Zoom & pan | Scroll wheel, pinch-to-zoom, Ctrl+scroll |
| Fit-to-view | Keyboard shortcut + toolbar button |
| Snap guides | Auto-align nodes while dragging |
| Grid background | Radial-gradient grid on canvas |
| Context menus | Right-click on nodes, edges, canvas |
| Keyboard shortcuts | N=new node, G=AI generator, 1–5=node types, and more |
| Floating action toolbar | Appears on node selection (delete, duplicate, style) |
| Canvas background color | Configurable radial gradient |
| Multiple workflow tabs | Open multiple workflows side-by-side |
| Design tabs | Separate tab type for UI mockups linked to a workflow |
| Workflow ↔ design sync badge | Badge on design tab navigates back to source workflow by UUID |
| Stale-design banner | Prompts to regenerate when source workflow has changed |

---

## 2. Node Types

**Location:** Node gallery popout; keyboard shortcuts 1–5

| Node Type | Available Via |
|---|---|
| **Input / Step** | Gallery + keyboard |
| **Image** | Gallery + keyboard |
| **Table** | Gallery + keyboard |
| **Form** | Gallery + keyboard |
| **Experiment** | Gallery |
| **Compound** | Gallery |
| **Process** | Keyboard shortcut only (not in gallery) |
| **Condition** | Keyboard shortcut only (not in gallery) |
| **Output** | Keyboard shortcut only (not in gallery) |
| **AI Task** | Keyboard shortcut only (not in gallery) |

> **Note:** Code and Webview node types exist in code but are not exposed in the public gallery or shortcuts.

Each node supports: custom icon, custom color (per-node styling).

---

## 3. Edge / Connection Tools

**Location:** Canvas — draw by dragging from node handles

| Feature | Notes |
|---|---|
| Bezier edges | Smooth curved connectors |
| Straight edges | Direct line connectors |
| Edge labels | Add text to any connection |
| Edge properties panel | Edit style, label, type in right sidebar |

---

## 4. UI / Interface Builder (Design Mode)

**Location:** Design tab (linked from workflow node), artboard canvas

| Feature | Notes |
|---|---|
| Artboard canvas | Separate canvas surface per UI screen |
| AI-generated interfaces | Generate from workflow context + text prompt |
| Component palette | Pre-built UI components, drag to artboard |
| Resizable components | Drag handles to resize on artboard |
| Inline text editing | Double-click to edit text in-place |
| Table column widths | Resize columns; width settings are saved |
| Table row/column manipulation | Add/remove rows and columns |
| Design-from-image | Upload a screenshot → AI generates matching UI |
| Update Interface button | Re-generate interface when workflow changes |
| Sync state tracking | Tracks whether design is current with its workflow |
| Figma frame import | Import frames from Figma via URL |

---

## 5. KiteAI Assistant

**Location:** Project panel (bottom collapsible) → KiteAI Chat tab; AI Generator modal

### Generation
| Feature | Notes |
|---|---|
| Text-to-workflow | Describe a process → full node graph |
| Image-to-workflow | Upload screenshot/diagram → extracted workflow |
| Add nodes beside existing | AI places new steps adjacent to selected nodes |
| PRD generation | Generate product requirements document from flow |
| Experiment node suggestions | AI proposes speculative/branching steps |
| AI error correction | Paste broken JSON → AI repairs it |

### Chat & Refinement
| Feature | Notes |
|---|---|
| Conversational refinement | Follow-up messages refine workflow in context |
| Brainstorm mode | Chat to explore edge cases and alternatives |

### AI Model Routing
| Task | Model |
|---|---|
| Reasoning / generation / vision | `claude-sonnet-4-5` |
| General chat | `claude-haiku-3-5` |
| Privacy / self-hosted option | Ollama / custom endpoint (configurable in settings) |

### Credit Costs
| Action | Credits |
|---|---|
| General chat | 1 |
| Workflow reasoning / experiments / PRD | 2 |
| Vision / image analysis | 3 |

---

## 6. Project & File Management

**Location:** Left sidebar (Workflow Manager), top-level tabs

| Feature | Notes |
|---|---|
| Multiple workflows per project | Organized in left sidebar |
| Cloud save / auto-save | LWW sync to server |
| Cloud project UUID | Projects identified by stable UUID |
| Project rename | Inline rename in sidebar |
| Notes panel | Per-project notes alongside canvas |
| Multi-tab editing | Multiple workflows open simultaneously |
| Project limits by tier | Free=20, Advanced/Pro=100, Anonymous=1 |

---

## 7. Import

**Location:** Toolbar → Import menu; Figma integration modal

| Source | Format / Method |
|---|---|
| KiteFrame JSON | File upload, with AI error-correction fallback |
| Figma | OAuth URL → import specific frame or page |
| Image / screenshot | Vision AI extracts workflow steps |

---

## 8. Export & Documentation

**Location:** Toolbar → Export modal

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
| Viewer presence count | Live viewer count shown on shared links |
| Threaded comments | Per-node comments with author info |
| Comment delete control | Only the comment author or project owner can delete |
| Read-only mode | Separate toolbar + layers widget for viewers |
| Anonymous viewing | No account required to view shared links |

---

## 10. Account & Subscription

**Location:** Account Settings page; credits widget in main toolbar

| Feature | Notes |
|---|---|
| Google OAuth sign-in | Via Firebase |
| Subscription tiers | Free, Advanced, Pro |
| Daily credit reset | Credits auto-refill every 24 hours |
| Credit allowances | Free=25/day, Advanced=50/day, Pro=150/day, Anon/IP=5/day |
| Unlock codes | Redeem codes for bonus credits or unlimited access |
| Credit display | Live credit counter in toolbar |
| Friendly credit-exhaustion error | Shown when credits run out during AI use |
| Stripe checkout | Upgrade subscription via Stripe |
| Stripe customer portal | Manage billing, cancel, change plan |

---

## 11. Settings & Customization

**Location:** AI Settings modal; Toolbar

| Feature | Notes |
|---|---|
| Custom AI endpoint | Point KiteAI at Ollama or self-hosted model |
| Theme (dark / light) | App-wide theme toggle in toolbar |
| Snap / grid toggle | Per-session canvas setting in toolbar |
| Keyboard shortcuts | Active key bindings (no separate help dialog; see in-app shortcuts) |

---

## 12. UI Locations Map

```
┌─────────────────────────────────────────────────────────────────┐
│  Top toolbar: Home · Undo/Redo · Zoom · Theme · Share · Export  │
│               Auth/Credits widget · AI Settings                 │
├──────────┬──────────────────────────────────────┬───────────────┤
│  Left    │          Main Canvas                 │  Right        │
│  Sidebar │  (Workflow nodes / Artboard)          │  Sidebar      │
│          │                                      │               │
│ Workflow │  ┌────────────────────────────────┐  │ Properties    │
│ Manager  │  │  Floating toolbar (on select)  │  │ panel         │
│ (files)  │  │  Delete · Duplicate · Style    │  │               │
│          │  └────────────────────────────────┘  │ Layers        │
│          │                                      │ panel         │
│          │                                      │               │
│          │                                      │ Node          │
│          │                                      │ Gallery       │
├──────────┴──────────────────────────────────────┴───────────────┤
│  Project panel (collapsible bottom)                             │
│    Tabs: KiteAI Chat · Notes · Project Details                  │
└─────────────────────────────────────────────────────────────────┘

Modals / Dialogs:
  Share · Export · Figma Import · JSON Import · AI Settings
  Subscription/Upgrade · AI Generator · Comments Overlay
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
| **Multiplayer / real-time co-editing** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Mobile support** | ❌ | ⚠️ view only | ✅ | ⚠️ view only | ❌ | ✅ |
| **Free tier** | ✅ 25 AI credits/day | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Speculative / experiment branching** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Undo / redo history** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **AI brainstorm / refinement chat** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

> ✅ = full support · ⚠️ = partial / limited · ❌ = not available · n/a = not applicable

### KiteFrame's Key Differentiators
1. **Workflow-native AI** — generation, refinement, brainstorming, and error correction are first-class
2. **Workflow ↔ UI linkage** — design screens are structurally tied to workflow nodes with live sync tracking
3. **PRD + dev-prompt export** — bridges product design all the way to AI-assisted coding
4. **Self-hosted AI option** — privacy-preserving Ollama integration
5. **Open-source canvas library** — `@kiteline/core` can be embedded in other projects
6. **Speculative branching** — experiment nodes for exploring "what if" paths inline
