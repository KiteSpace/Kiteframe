# Kiteframe Visual Styleguide

**Status:** Documentation baseline  
**Last reviewed:** 2026-08-17  
**Scope:** Product UI, design editor chrome, builder side panel, canvas, and floating toolbar

This document is the visual source of truth for the current Kiteframe interface and
the supplied Builder Shell handoff references. It intentionally distinguishes what
is implemented from what the reference files specify so that future visual work
does not accidentally treat a target value as an existing application token.

## How to read this guide

Values use these labels:

- **Current** — implemented in the application today.
- **Reference** — specified by the supplied HTML handoff, but not necessarily
  implemented in the React application.
- **Target** — recommended value or behavior for the next styling pass when the
  current implementation differs from the reference.

The reference files are design handoffs, not files to embed directly:

- [`attached_assets/builder-panel-1b_1787000981739.html`](attached_assets/builder-panel-1b_1787000981739.html)
- [`attached_assets/canvas-toolbar-bottom_1787001200952.html`](attached_assets/canvas-toolbar-bottom_1787001200952.html)

## Design principles

1. **Quiet neutral chrome.** Builder surfaces should feel like an instrument
   panel: white or warm neutral surfaces, restrained borders, small shadows, and
   dark ink for primary actions.
2. **Color has meaning.** Category dots and application status colors may use
   color. Component thumbnails and structural chrome should remain monochrome so
   the palette does not become visually noisy.
3. **Typography creates hierarchy.** Use readable 12–14px text for user-facing
   labels and descriptions. Reserve very small text for metadata, counts, and
   compact controls.
4. **Stable geometry matters.** Toolbar children must not wrap, palette cells must
   retain predictable heights, and sticky headers must remain inside a normal
   scrolling container.
5. **Editing cues stay distinct from authored design.** Selection rings, focus
   outlines, hover states, and drag affordances should sit outside or around user
   content rather than changing the user's configured borders.
6. **Display-only previews stay inert.** Palette thumbnails must not fetch data,
   animate, receive pointer interaction, or enter loading and error states.
7. **Accessibility is part of the visual system.** Every interactive tile and
   toolbar control needs a keyboard path, an accessible name, and a visible focus
   state.

## Source of truth and implementation boundaries

| Area | Source |
| --- | --- |
| Global theme variables and base styles | [`client/src/index.css`](client/src/index.css) |
| Tailwind semantic color and typography mapping | [`tailwind.config.ts`](tailwind.config.ts) |
| Builder metadata, categories, search, and persistence | [`client/src/design/builderRegistry.ts`](client/src/design/builderRegistry.ts) |
| Builder palette and toolbar markup/behavior | [`client/src/design/DesignEditor.tsx`](client/src/design/DesignEditor.tsx) |
| Canonical Astryx component renderers | [`client/src/design/resolver.tsx`](client/src/design/resolver.tsx) |
| Builder panel reference | [`attached_assets/builder-panel-1b_1787000981739.html`](attached_assets/builder-panel-1b_1787000981739.html) |
| Bottom toolbar reference | [`attached_assets/canvas-toolbar-bottom_1787001200952.html`](attached_assets/canvas-toolbar-bottom_1787001200952.html) |

The existing application uses Tailwind utility classes backed by CSS variables.
The reference handoffs use fixed warm-neutral values. A future alignment pass
should either add builder-specific semantic variables or scope the reference
tokens to the editor shell; it should not globally replace the application's
theme variables without reviewing every surface.

## Global theme

### Typography

| Token/property | Current | Reference | Target |
| --- | --- | --- | --- |
| Sans family | `Inter, system-ui, sans-serif` | `"Helvetica Neue", Helvetica, Arial, sans-serif` | Keep `Inter` for the product unless the editor is intentionally given a separate reference-matched font stack |
| Serif family | `Georgia, serif` | Not specified | Preserve for editorial/content use only |
| Monospace family | `Menlo, monospace` | `ui-monospace, "SF Mono", Menlo, monospace` | Add `ui-monospace` and `"SF Mono"` fallbacks where compact metadata must match the handoff |
| Base body rendering | `font-sans antialiased` | `-webkit-font-smoothing: antialiased` on the panel | Keep antialiasing on product surfaces and editor chrome |
| Body text | Theme-dependent | Generally `12–14px` | Use `14px` for search and primary field text; `12–13px` for compact labels; `10–11px` only for metadata |
| Tracking | `--tracking-normal: 0em` | Eyebrows `.11em`; group names `.09em` | Use letter spacing only for uppercase labels and compact section headings |

The global stylesheet imports Inter weights 300–700. The editor reference uses
weight 400 for normal text, 500–600 for labels and controls, and 700 for group
headings and eyebrow labels.

### Base geometry

| Token/property | Current | Reference | Target |
| --- | --- | --- | --- |
| Base radius | `--radius: 8px` | Panel `6/8/9px`; toolbar `7/8/12px` | Keep 8px as the application base; use explicit 6px, 8px, 9px, and 12px values for reference-matched editor parts |
| Tailwind `rounded-sm` | `calc(var(--radius) - 4px)` = 4px | Small control radius commonly 6–7px | Do not assume Tailwind aliases match the handoff; use scoped editor values where exact geometry matters |
| Tailwind `rounded-md` | `calc(var(--radius) - 2px)` = 6px | Common small radius 6–7px | Suitable for compact controls |
| Tailwind `rounded-lg` | `var(--radius)` = 8px | Common standard radius 8px | Suitable for rows, toggles, and standard controls |
| Spacing scale | `--spacing: 0.25rem` (4px base) | Explicit values from 2px to 20px | Continue using the 4px rhythm, but preserve reference measurements when documenting or aligning editor chrome |

### Light theme tokens

These values are defined in `:root` in [`client/src/index.css`](client/src/index.css).

| Token | Current value | Intended role |
| --- | --- | --- |
| `--background` | `hsl(210, 40%, 98%)` | Main application background |
| `--foreground` | `hsl(222.2, 84%, 4.9%)` | Main text |
| `--card` | `hsl(0, 0%, 100%)` | Cards and raised content |
| `--card-foreground` | `hsl(222.2, 84%, 4.9%)` | Text on cards |
| `--popover` | `hsl(0, 0%, 100%)` | Popovers and menus |
| `--popover-foreground` | `hsl(222.2, 84%, 4.9%)` | Text in popovers |
| `--primary` | `hsl(221.2, 83.2%, 53.3%)` | Primary application action and focus/ring color |
| `--primary-foreground` | `hsl(210, 40%, 98%)` | Text on primary surfaces |
| `--secondary` | `hsl(210, 40%, 96%)` | Secondary surfaces |
| `--secondary-foreground` | `hsl(222.2, 84%, 4.9%)` | Text on secondary surfaces |
| `--muted` | `hsl(210, 40%, 96%)` | Muted fields and quiet surfaces |
| `--muted-foreground` | `hsl(215.4, 16.3%, 46.9%)` | Secondary text |
| `--accent` | `hsl(210, 40%, 96%)` | Hover and selected background |
| `--accent-foreground` | `hsl(222.2, 84%, 4.9%)` | Text on accent surfaces |
| `--destructive` | `hsl(0, 84.2%, 60.2%)` | Destructive action and error state |
| `--destructive-foreground` | `hsl(210, 40%, 98%)` | Text on destructive surfaces |
| `--border` | `hsl(214.3, 31.8%, 91.4%)` | Default borders and separators |
| `--input` | `hsl(214.3, 31.8%, 91.4%)` | Input borders |
| `--ring` | `hsl(221.2, 83.2%, 53.3%)` | Focus ring |
| `--sidebar` | `hsl(180, 6.6667%, 97.0588%)` | Sidebar surface token |
| `--sidebar-foreground` | `hsl(210, 25%, 7.8431%)` | Sidebar text |
| `--sidebar-primary` | `hsl(203.8863, 88.2845%, 53.1373%)` | Sidebar primary |
| `--sidebar-accent` | `hsl(211.5789, 51.3514%, 92.7451%)` | Sidebar hover/selected surface |
| `--sidebar-border` | `hsl(205, 25%, 90.5882%)` | Sidebar border |

### Dark theme tokens

The `.dark` class switches the semantic tokens. The important visual rule is
that dark mode is not a simple opacity treatment of the light theme:

- `--background` becomes black: `hsl(0, 0%, 0%)`.
- `--card` becomes `hsl(228, 9.8039%, 10%)`.
- `--muted` becomes `hsl(0, 0%, 9.4118%)`.
- `--border` becomes `hsl(210, 5.2632%, 14.902%)`.
- `--primary` remains a bright blue: `hsl(203.7736, 87.6033%, 52.549%)`.
- `--sidebar` becomes the dark card color.

All editor components using `bg-background`, `bg-muted`, `border-border`,
`text-foreground`, or `text-muted-foreground` inherit this switch. Fixed warm
reference colors such as `#f4f4f2` and `#1c1c1e` should therefore be scoped to
the light editor treatment or paired with explicit dark equivalents before being
introduced into shared components.

### Shadows

The global shadow variables are defined in `index.css`, but their current HSL
alpha values are effectively transparent in normal use. The reference handoff
uses visible, warm-neutral shadows:

| Surface | Current | Reference | Target |
| --- | --- | --- | --- |
| General raised surface | Tailwind `shadow-*` backed by global shadow variables | `0 1px 2px rgba(0,0,0,.07)` | Keep product defaults unless matching editor chrome; use an explicit scoped shadow for the panel/toggle |
| Bottom toolbar | `shadow-lg` | `0 -6px 20px rgba(20,20,18,.12)` | Use the upward shadow so the toolbar visually lifts from the canvas |
| Upward menu | `shadow-lg` | `0 -10px 28px rgba(20,20,18,.16)` | Use an upward shadow and open menus above the toolbar |
| Artboard | Component-specific | `0 6px 20px rgba(20,20,18,.07)` | Preserve a light, low-contrast artboard elevation |

## Shared component rules

### Buttons

**Current application pattern**

- Semantic colors come from `primary`, `secondary`, `accent`, and
  `destructive`.
- Most compact editor actions use `10px` text, `rounded-lg`, `px-2`, and `py-1`.
- Hover states commonly use `bg-accent`.
- Focus is usually expressed with `focus-visible:ring-*`.

**Reference toolbar pattern**

- Standard button: `height: 30px`, horizontal padding `10px`, gap `7px`,
  `font: 500 12px/1`, radius `8px`, no border.
- Primary button: horizontal padding `11px`, background `#131316`, white text,
  weight 600; hover background `#24242a`.
- Icon-only button: `28px × 28px`, radius `7px`, no border.
- Disabled icon: `#c2c2b8`, no hover background.
- Hover surface: `#f4f4f1`.

**Target rule:** retain semantic Tailwind classes for application-wide buttons,
but use a dedicated editor toolbar treatment where the reference calls for
near-black ink rather than the application's blue primary.

### Inputs

**Current application pattern**

- Inputs use `border-border`, `bg-background` or `bg-muted`, small text, and
  primary focus rings.
- The builder search currently uses a theme-muted background, `text-[10px]`,
  `rounded-xl`, and no fixed height.

**Reference search pattern**

- Search row: `38px` high.
- Horizontal padding: `11px`.
- Gap between icon, input, and keyboard hint: `8px`.
- Border: `1px solid #d9d9d3`.
- Radius: `9px`.
- Background: `#ffffff`.
- Resting shadow: `0 1px 2px rgba(20,20,18,.04)`.
- Focus border: `#1c1c1e`.
- Focus ring: `0 0 0 3px rgba(28,28,30,.07)`.
- Input text: `14px`, weight 400.
- Placeholder: `#a3a399`.
- Keyboard hint: monospace `10px`, weight 600, border radius `4px`, padding
  `3px 5px`.

### Segmented controls

- Track: `#f2f2ef`, radius `8px`, `2px` internal gap/padding.
- Segment buttons: no border, radius `6px`, padding `5px 10px`, `11px` text.
- Inactive color: `#6b6b63`.
- Active background: `#ffffff`.
- Active text: `#1c1c1e`, weight 600.
- Active shadow: `0 1px 2px rgba(0,0,0,.07)`.
- Focus: `2px` outline with `2px` offset; the reference uses the controls blue
  category color for the palette toggle and purple accent for the toolbar.

### Focus and keyboard states

Every palette tile and toolbar control must:

- Have a visible `:focus-visible` state.
- Keep focus outlines outside the content when possible.
- Preserve a stable keyboard order.
- Provide `aria-label`, visible text, or an associated label.
- Avoid using color alone to communicate active state.

The editor palette uses keyboard navigation through the search field/body and
Enter/Space insertion. Drag payloads use the stable `application/x-component`
identifier and must not be removed when the visual styling changes.

## Builder side panel

### Reference shell

The supplied reference defines `.bp-panel` as:

| Property | Reference |
| --- | --- |
| Width | `320px` |
| Layout | `display: flex; flex-direction: column` |
| Height behavior | `min-height: 0` so the scroller can shrink |
| Surface | `#ffffff` |
| Right border | `1px solid #ebebe7` |
| Font | `"Helvetica Neue", Helvetica, Arial, sans-serif` |
| Smoothing | `-webkit-font-smoothing: antialiased` |

**Current:** the React `LeftRail` is also `320px`, non-shrinking, flex-column,
and overflow-hidden, but uses `bg-background` and `border-border` plus an
additional `1px` box shadow.  
**Target:** preserve the 320px geometry while introducing scoped builder
surface tokens if exact reference matching is desired.

### Reference tokens

These tokens are defined in the supplied panel handoff:

```css
--bp-chrome:      #ffffff;
--bp-subtle:      #fafaf8;
--bp-hover:       #f5f5f2;
--bp-track:       #f2f2ef;
--bp-chip:        #f4f4f1;
--bp-line:        #ebebe7;
--bp-line-soft:   #f0f0ec;
--bp-line-strong: #d9d9d3;
--bp-line-tile:   #e9e9e4;
--bp-fg:          #1c1c1e;
--bp-fg-muted:    #55554e;
--bp-fg-subtle:   #8a8a80;
--bp-fg-faint:    #a3a399;
--bp-accent:      #1c1c1e;
--bp-accent-fg:   #ffffff;
```

Category marker colors:

| Category | Reference color |
| --- | --- |
| Layout | `#5b6b8c` |
| Typography | `#6d5aa8` |
| Controls | `#2563eb` |
| Data | `#2b7a6b` |
| Media | `#a06520` |
| Feedback | `#a33b52` |

The current registry uses HSL category colors in
[`client/src/design/builderRegistry.ts`](client/src/design/builderRegistry.ts).
Those are semantic markers only; they should not be reused for thumbnail fills
or the entire panel.

### Header and search

**Reference**

- Header padding: `16px 16px 12px`.
- Header row gap: `12px`.
- Search row uses a flexible search field and an inline view toggle.
- Category filter chips occupy their own wrapping row below the search.
- Search height: `38px`.
- View toggle track: `#f2f2ef`, radius `8px`.
- View toggle buttons: `30px × 30px`, radius `6px`.

**Current**

- The header uses `px-3 py-2.5`, approximately `12px × 10px`.
- The title and view toggle occupy a row above the search field.
- The search field has no explicit height, uses `text-[10px]`, and has no
  keyboard shortcut badge.
- Category filter chips are not currently rendered.

**Target**

- Preserve the existing title/Inspect behavior and accessibility.
- Move toward the reference's `16px` horizontal rhythm and `38px` search field.
- Add chips only if category filtering is implemented without weakening search,
  collapsed groups, recent persistence, or keyboard indexing.
- Use the reference's neutral search treatment in light mode and define a dark
  equivalent rather than hard-coding white into a shared dark surface.

### Recent components

**Reference**

- Padding: `0 16px 10px`.
- Eyebrow: `10px`, weight 700, letter-spacing `.11em`, color `#a3a399`.
- Recent buttons: flexible equal-width items, `7px 9px` padding, `1px solid
  #e9e9e4`, radius `8px`, `12px` semibold text.

**Current**

- Recent items appear under a sticky `Recent` header with a clock icon and a
  separator line.
- The existing recent list is capped and persisted in local storage.

**Target:** retain the current persistence and insertion behavior. Styling may
move toward bordered recent buttons without changing the storage contract.

### Group headers and scroller

**Reference**

- Scroller: `flex: 1`, `min-height: 0`, `overflow-y: auto`,
  `overflow-x: hidden`.
- Top separator: `1px solid #f0f0ec`.
- Scrollbar width: `8px`.
- Thumb: `#dcdcd7`, radius `8px`.
- Sticky header: `top: 0`, z-index 1, padding `10px 16px 8px`.
- Sticky surface: `rgba(255,255,255,.94)`, `backdrop-filter: blur(6px)`.
- Bottom line: `1px solid #f2f2ee`.
- Dot: `7px × 7px`.
- Group name: `11px`, weight 700, uppercase, letter-spacing `.09em`.
- Count: `11px` monospace, weight 500.

**Current:** category headers are sticky and collapsible, but use smaller
padding/font utilities, theme surfaces, and chevron controls. The scroller is a
normal flex overflow container, which is important: do not add transforms or
horizontal overflow that would break sticky positioning.

### List view

**Reference**

- List padding: `6px 10px 12px`.
- Row gap: `1px`.
- Row padding: `7px 8px`.
- Row gap between tile and text: `11px`.
- Row radius: `8px`.
- Hover background: `#f5f5f2`.
- Focus outline: `2px` controls-blue outline with `-2px` offset.
- Glyph tile: `32px × 24px`, background `#fafaf8`, border `1px solid #e9e9e4`,
  radius `5px`, monospace `9px`.
- Name: `13px`, weight 500.
- Description: `11px`, weight 400, faint text color.

**Current:** the list keeps the same basic geometry and 32px glyph tile but
uses smaller `10.5px`/`9px` text and theme-derived tile colors.

### Grid view and thumbnails

**Reference**

- Grid padding: `10px 14px 16px`.
- Columns: two equal columns.
- Column gap: `12px`.
- Row gap: `14px`.
- Cell content is a preview block followed by separate metadata.
- Preview block height: `78px`.
- Preview background: `#f4f4f2`.
- Preview border: `1px solid transparent`.
- Preview radius: `10px`.
- Hover preview background: `#eeeeeb`.
- Hover border: `#d9d9d3`.
- Name: `12.5px`, weight 600, line-height 1.2.
- Description: `11px`, weight 400, line-height 1.3.

**Current:** grid tiles are two-column cells with 78px total height, a visible
theme border, `bg-background`, `rounded-xl`, and a `9.5px` name. Descriptions
are omitted from grid tiles. The current palette now has authored/live preview
resolution and a glyph fallback, but the reference's fixed preview-stage
geometry and neutral mini-preview colors are not yet fully represented.

Thumbnail rules:

- Authored mini previews are preferred for simple atoms.
- Live previews may use the canonical component renderer inside a fixed
  `240px × 160px` stage scaled to the cell.
- All preview subtrees use `pointer-events: none` and `user-select: none`.
- Props must be short, deterministic, and static.
- No remote data, loading state, animation, or user interaction.
- Every entry keeps a three-character glyph fallback.
- The current implementation uses native `content-visibility: auto` beyond
  approximately 60 visible cells. Do not replace this with DOM-removing
  virtualization unless sticky headers, keyboard navigation, drag connectors,
  and stable selectors are preserved.

## Canvas and artboard

### Reference canvas surface

The toolbar handoff's demo canvas uses:

- Background: `#f4f4f2`.
- Dot grid: `radial-gradient(#deded8 1px, transparent 1px)`.
- Dot spacing: `16px × 16px`.
- Bottom padding reserved for toolbar: `76px`.
- Centered artboard: white, `1px solid #dededa`, radius `6px`,
  `0 6px 20px rgba(20,20,18,.07)` shadow.

The current editor canvas is an interactive infinite canvas with its own pan,
zoom, artboard positioning, selection, and fit behavior. The reference's dot
grid and toolbar-band reservation should be treated as target visual guidance,
not as permission to change Craft.js layout or artboard geometry.

### Canvas interaction rules

- Wheel/pinch zoom is cursor-anchored.
- Pointer gestures pan the canvas and support touch pinch zoom.
- Fit view centers all artboards and clamps zoom to a usable range.
- Selection cues must remain distinct from user-configured borders.
- Floating controls must not create a full-width click-blocking layer over the
  canvas.

## Bottom canvas toolbar

### Reference dock

The supplied toolbar uses a two-layer structure:

```text
.kf-toolbar-dock
  .kf-toolbar
```

Dock rules:

- Position: absolute, left 0, right 0, bottom `20px`.
- z-index: `20`.
- Display: flex, justify-content center.
- Dock pointer events: `none`.
- Direct toolbar child pointer events: `auto`.

This pointer-event split is essential. The full-width dock must not consume
canvas drag/pan events; only the pill itself should be interactive.

### Reference toolbar shell

| Property | Reference |
| --- | --- |
| Height | `44px` |
| Horizontal padding | `0 8px` |
| Gap | `4px` |
| Surface | `#ffffff` |
| Border | `1px solid #e2e2dd` |
| Radius | `12px` |
| Shadow | `0 -6px 20px rgba(20,20,18,.12)` |
| Font | `"Helvetica Neue", Helvetica, Arial, sans-serif` |
| White-space | `nowrap` |
| Child sizing | Every direct child `flex: none; white-space: nowrap` |
| Maximum width | `calc(100% - 32px)` |

**Current:** the React toolbar is bottom-centered and interactive, but uses
`bottom-4` (16px), no fixed 44px height, `rounded-2xl` (16px), theme border,
theme background, `backdrop-blur-sm`, and generic `shadow-lg`.  
**Target:** retain the current behavior and test selectors while matching the
fixed 44px shell, 20px inset, warm border, upward shadow, and no-wrap rules.

### Toolbar controls

| Control | Reference |
| --- | --- |
| Standard button | `30px` high, `0 10px` padding, `7px` icon gap, radius `8px`, `500 12px` |
| Primary button | `0 11px` padding, `#131316` background, white text, weight 600 |
| Icon button | `28px × 28px`, radius `7px`, borderless |
| Divider | `1px × 18px`, `margin: 0 4px`, color `#eaeae5` |
| Zoom stepper buttons | `24px × 28px`, borderless |
| Zoom readout | fixed width `46px`, `12px` monospace, weight 600, no surrounding border |
| Fit | text button labeled `Fit`, not icon-only |
| Mode track | `#f2f2ef`, radius `8px`, `2px` internal padding |
| Mode segment | `5px 10px`, radius `6px`, `11px` text |
| Active mode | white background, dark text, `0 1px 2px rgba(0,0,0,.07)` |

The current toolbar includes the required add/import, history, zoom, fit,
mode-switch, and preview-navigation behaviors. It intentionally has additional
editor actions such as duplicate/delete when an artboard is selected. Those
actions should be styled within the same control geometry rather than removed.

### Preview mode

Preview mode is an editor mode, not the public read-only share view.

Current behavior:

- Mode is represented in the URL with `?mode=preview`.
- The palette and editing actions are hidden.
- A clean preview surface renders the selected artboard.
- Preview navigation can update the `screen` URL parameter.
- Escape returns to Design mode.
- Reload restores the preview mode from URL state.

Reference behavior:

- Toolbar controls switch using one `data-mode` attribute.
- Design-only controls are hidden in preview.
- Preview-only screen picker and previous/next controls are shown.
- Preview uses real-size content (`100%` in the handoff).
- Preview menus open upward from the bottom dock.

Target styling must not change the semantic separation between preview mode and
public shared links.

## Menus and overlays

### Reference menu

- Position above toolbar: `bottom: calc(100% + 8px)`.
- Left anchor: `8px`.
- Minimum width: `220px`.
- Surface: `#ffffff`.
- Border: `1px solid #e2e2dd`.
- Radius: `11px`.
- Shadow: `0 -10px 28px rgba(20,20,18,.16)`.
- Padding: `5px`.
- Menu item: full width, `8px 9px`, radius `7px`, `12.5px` text.
- Hover: `#f4f4f1`.
- Keyboard hint: right-aligned, `10px` monospace.

Current editor menus use theme surfaces and Tailwind rounded/shadow utilities.
Any bottom-docked menu must continue opening upward and must not be clipped by
the canvas viewport.

### Popovers and dialogs

- Use `popover` tokens for floating content unless the surface is an editor
  chrome element with an explicit scoped reference token.
- Keep focus within modal dialogs according to the existing UI primitive.
- Provide a description or `aria-describedby` for dialog content.
- Do not portal selection cues or inline palette preview artwork in a way that
  breaks Craft.js pointer hit testing.

## Responsive and overflow constraints

### Side panel

- Fixed width target: `320px`.
- Must shrink vertically: `min-height: 0`.
- Only the body/scroller should consume vertical overflow.
- Do not add transforms to the sticky-header scroller.
- Keep horizontal overflow hidden.
- Grid remains two columns at the reference width.
- At narrower layouts, controls may compress, but search text and toolbar labels
  must not become unreadable or wrap unexpectedly.

### Toolbar

- Bottom inset target: `20px`.
- Maximum width: `calc(100% - 32px)`.
- Direct children are non-shrinking and no-wrap.
- If the viewport becomes too narrow, the toolbar may need a deliberate
  overflow strategy; individual labels should not silently wrap inside controls.
- Menus open upward and must remain within the viewport.

## Accessibility checklist

### Palette

- [ ] Panel has an accessible label.
- [ ] Search input has `role="searchbox"` and an accessible label.
- [ ] View toggle exposes pressed state.
- [ ] Category headers expose expanded state.
- [ ] Each tile exposes an accessible name and keyboard focus.
- [ ] Enter and Space insert the focused component.
- [ ] Drag payload remains `application/x-component` with the stable component id.
- [ ] Focus-visible styling is visible against light and dark surfaces.
- [ ] Decorative preview artwork is hidden from interaction and does not replace
  the tile's accessible name.

### Toolbar

- [ ] Toolbar has `role="toolbar"` and an accessible label.
- [ ] Icon-only controls have labels and useful titles.
- [ ] Undo/redo disabled states are visually clear and not clickable.
- [ ] Mode buttons expose pressed state.
- [ ] Preview screen navigation exposes previous/next labels.
- [ ] Zoom menu exposes menu/menuitem semantics.
- [ ] The dock does not intercept canvas pointer events outside the pill.
- [ ] Focus rings do not get clipped by the bottom edge or menu container.

## Change guidance

When aligning the UI to the references:

1. Prefer scoped editor tokens over changing the global application theme.
2. Keep existing semantic Tailwind names available for shared components.
3. Match measured geometry before adjusting decorative details.
4. Preserve stable selectors such as `data-component-id`,
   `data-testid="canvas-toolbar"`, and preview-mode test ids.
5. Preserve Craft.js connectors, drag/drop, keyboard insertion, and selection
   behavior while changing markup or classes.
6. Test both light and dark mode if fixed neutral values are introduced.
7. Verify the result at narrow and wide viewport sizes.
8. Use DOM rectangles for positioning assertions; do not rely only on text
   presence.

## Known current-versus-reference gaps

These are documented here so they are not mistaken for completed styling:

- The side panel uses theme tokens instead of the reference's scoped warm-neutral
  palette.
- The search field is smaller than the reference and does not show the `⌘K`
  hint.
- Category filter chips are not currently rendered.
- The view toggle is above the search instead of inline with it.
- Recent components use a clock/separator treatment instead of reference-style
  bordered buttons.
- Grid metadata is more compact and omits the reference description line.
- The grid cell currently uses a theme border/background rather than the
  reference's transparent border and `#f4f4f2` preview surface.
- The toolbar has no fixed 44px height, uses a 16px bottom inset, and uses a
  downward generic shadow instead of the reference's upward shadow.
- The zoom cluster currently has a surrounding border; the reference treats the
  stepper as a borderless group.
- The reference's dark ink primary Artboard button is not currently represented
  by the toolbar's add action.
- Undo/redo currently use compact text glyphs in the toolbar rather than the
  reference's 14px SVG icons.

These gaps are styling targets only. They do not authorize changing the editor's
functional behavior, public sharing behavior, Craft.js serialization, or AI
component contracts.