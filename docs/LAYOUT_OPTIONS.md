# Design Layout Options

This reference describes the layout behavior currently implemented in the
design editor. It covers artboards, parent/container nodes, and their
children. Values below are the editor defaults when a property is not set.

## Document structure

```text
ROOT (canvas anchor)
└── AstryxArtboard (screen)
    ├── child
    ├── child
    └── child
```

- `ROOT` is the immutable canvas anchor. It is not a screen and must not be
  counted as an `AstryxArtboard`.
- Direct children of `ROOT` must be `AstryxArtboard` nodes.
- If imported or AI-generated state places non-artboard nodes directly under
  `ROOT`, state repair wraps those nodes in a generated `Screen 1` artboard.
- Non-root containers cannot contain an `AstryxArtboard`.

## Artboard options

| Option | Implemented values or behavior | Default |
| --- | --- | --- |
| Screen type | `AstryxArtboard` | — |
| Parent | Direct child of `ROOT` | `ROOT` |
| Label | Editable text; double-click the label to rename it | `Artboard` |
| Canvas X | Numeric `x` coordinate; label dragging updates it | `64` |
| Canvas Y | Numeric `y` coordinate; label dragging updates it | `64` |
| Width | Numeric width; editor resize minimum is `100px` | `390px` UI fallback |
| Height | Numeric height; editor resize minimum is `100px` | `480px` UI fallback, or content-sized when unset |
| Internal direction | `row`, `column` | `column` |
| Align items | `start`, `center`, `end`, `stretch` | `stretch` |
| Justify content | `start`, `center`, `end`, `between`, `around` | `start` |
| Child gap | Non-negative numeric pixels | `16px` |
| Padding | Uniform numeric pixels on all sides | `24px` |
| Background color | Transparent or a color value | Theme/card background |
| Background gradient | CSS gradient value through the background settings | Not set |
| Background image | Image URL; rendered as cover, centered, and non-repeating | Not set |
| Text color | Color value inherited by artboard content | Inherited/default |
| Resize handles | North, south, east, west, and all four corners | — |

### Artboard placement

When the server lays out multiple direct artboard children of `ROOT`, it:

- starts at `x = 64`, `y = 64`;
- preserves the order in `ROOT.nodes`;
- uses each artboard’s positive numeric `width`, or `390px` when absent; and
- places the next artboard `80px` after the previous artboard’s width.

The artboard label has a custom drag interaction. Dragging the label changes
`x` and `y`; dragging a resize handle changes width and/or height. North and
west resizing also adjusts the position so the opposite edge stays fixed.

## Parent/container options

### Container types

| Container | Direction | Gap default | Padding prop | Child acceptance |
| --- | --- | ---: | --- | --- |
| `AstryxSection` | Configurable: `row` or `column` | `16px` | Yes, `16px` | `ROOT` accepts artboards only; non-root sections accept non-artboards |
| `AstryxStack` | Fixed `column` | `8px` | No independent padding prop | Any child component |
| `AstryxHStack` | Fixed `row` | `8px` | No independent padding prop | Any child component |
| `AstryxCard` | Fixed `column` | `12px` | Built-in visual padding: `16px` | Any child component |
| `AstryxList` | List-style vertical presentation | — | No general flex padding prop | Children are allowed |
| `AstryxArtboard` | Configurable: `row` or `column` | `16px` | Yes, `24px` | Children are allowed |

All container types above use a visible drop zone when empty and can be
selected and resized. `AstryxSection`, `AstryxStack`, `AstryxHStack`, and
`AstryxCard` support the shared `flow`/`absolute` positioning behavior for
the container itself. `AstryxArtboard` is positioned on the canvas through
its own `x`/`y` coordinates.

### Shared flex controls

Where a container exposes the control, the editor supports:

| Control | Values |
| --- | --- |
| Direction | `row`, `column` (`AstryxStack` and `AstryxHStack` use fixed directions) |
| Align items | `start`, `center`, `end`, `stretch` |
| Justify content | `start`, `center`, `end`, `between`, `around` |
| Gap | Numeric pixels, minimum `0` |
| Padding | One uniform numeric value, only on `AstryxSection` and `AstryxArtboard` |
| Width / height | Numeric value or automatic sizing |
| Container position | `flow` or `absolute`, where supported |
| Absolute X / Y | Numeric coordinates when `position="absolute"` |

The editor includes these spacing presets for containers that support
padding:

| Preset | Gap | Padding |
| --- | ---: | ---: |
| Compact | `4px` | `8px` |
| Default | `8px` | `12px` |
| Comfortable | `12px` | `16px` |
| Spacious | `20px` | `24px` |

The presets are convenience combinations; gap and padding can also be edited
independently.

## Child options

Most components are leaf nodes. They participate in the layout of their
parent rather than defining a layout for their own children.

| Option | Implemented behavior | Default |
| --- | --- | --- |
| Flow position | Child remains in the parent’s normal layout flow | `flow` |
| Absolute position | Child is removed from normal flow and positioned with `x`/`y` | Not set |
| Absolute X | Numeric horizontal offset inside the parent | `0` |
| Absolute Y | Numeric vertical offset inside the parent | `0` |
| Width | Numeric value or `auto`; component-specific full-width fallback | Component-specific |
| Height | Numeric value or `auto` | Component-specific |
| Child dragging | Flow nodes use Craft.js drag/reparent behavior; absolute nodes update `x`/`y` | — |
| Resizing | Eight-direction resize handles | — |
| Border radius | `None`, `S`, `M`, `L`, `Full`, where supported | Usually `M` |
| Background color | Color value, where supported | Component default |
| Text color | Color value or inherited color | Inherited/default |

### Full-width and shrink-to-content behavior

These components are configured to fill their parent’s width when no explicit
width is set:

- `AstryxCarousel`
- `AstryxResizable`
- `AstryxTable`
- `AstryxTabs`
- `AstryxAccordion`
- `AstryxSlider`
- `AstryxCalendar`
- `AstryxCommand`
- `AstryxBanner`
- `AstryxEmptyState`
- `AstryxChatMessage`
- `AstryxDivider`
- `AstryxProgressBar`
- `AstryxTextInput`
- `AstryxSelect`
- `AstryxRadioGroup`
- `AstryxHeading`
- `AstryxBarChart`
- `AstryxLineChart`
- `AstryxPieChart`

Other leaf nodes generally shrink to `fit-content` when no explicit width is
set.

### Component-specific layout controls

| Component | Additional layout-related option | Values or behavior |
| --- | --- | --- |
| `AstryxResizable` | Resize direction | `horizontal`, `vertical` |
| `AstryxTable` | Column widths | Per-column widths with interactive resizing |
| `AstryxCard` | Visual variant | `elevated`, `outlined`, `ghost` |

## Not currently implemented as general layout options

The following are not general controls in the current editor:

- CSS Grid layout
- Flex wrapping (`flex-wrap`)
- Per-side padding
- Margins
- Responsive breakpoints
- `space-evenly` justification
- General child ordering
- General `flex-grow`, `flex-shrink`, or `flex-basis`
- Snap-to-grid positioning

This list describes current behavior only; it does not imply that these
features cannot be added later.

## Source of truth

The renderer and editor controls are implemented in:

- `client/src/design/resolver.tsx`
- `client/src/design/DesignEditor.tsx`

The state structure and parent-child repair rules are implemented in:

- `client/src/design/craftValidator.ts`
- `server/lib/designPatchMerge.ts`