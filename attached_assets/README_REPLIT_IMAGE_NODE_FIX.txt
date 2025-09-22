# ImageNode & Handles Behavior Fix — Replit Instructions

This patch bundle fixes:
- ImageNode auto-resize in `contain` mode
- Click/drag parity with basic nodes
- Handle placement & connection accuracy
- "Add Image" clickability and accessibility
- Prevent native image drag interference

## Files in this bundle
- `src/utils/size.ts` — shared `toPxNumber` util
- `patches/ImageNode.tsx` — full drop-in replacement for `src/components/nodes/ImageNode.tsx`
- `patches/NodeHandles.diff` — minimal patch you can apply to your existing `NodeHandles.tsx`
- `patches/NodeHandles.patched.tsx` — full reference NodeHandles file (if you prefer to replace)

---

## Step-by-step (copy/paste friendly)

1. **Create the shared size util**
   - Create file: `src/utils/size.ts`
   - Paste contents from this bundle’s `src/utils/size.ts`

2. **Replace ImageNode with the patched version**
   - Open your project file: `src/components/nodes/ImageNode.tsx`
   - Replace entire file with contents from `patches/ImageNode.tsx`

3. **Patch NodeHandles so handles align with actual node size**
   - Option A (recommended): Apply minimal diff
     - Open `src/components/nodes/NodeHandles.tsx`
     - Add the `toPxNumber` helper (exactly as shown in `patches/NodeHandles.diff`)
     - Replace the width/height lines with the normalized versions
     - Add `className="node-handles"` on the wrapper `<div>`
   - Option B: Replace the file with `patches/NodeHandles.patched.tsx`

4. **Wire up canvas handlers (parity with basic nodes)**
   - Ensure the **same** handlers you use for basic nodes are passed to ImageNode:
     - `onStartDrag` for node drag start (client→world conversion + set dragging state)
     - `onHandleConnect` for starting edge connections (client→world conversion + set connecting state)
   - The patched ImageNode forwards these props and no longer blocks them.

5. **Ensure CSS is consistent**
   - If you have CSS rules targeting `.node-handles`, they will now apply consistently.
   - The `<img>` has `pointer-events: none` and `draggable={false}` to avoid native drag.

6. **TypeScript path alias note**
   - The patched ImageNode imports `toPxNumber` from `@/src/utils/size`.
   - If your alias differs, adjust the import path accordingly (e.g. `@/utils/size`).

7. **Build & test checklist**
   - Add image via placeholder (anywhere in the area is clickable)
   - Drag the image node (matches basic node behavior)
   - Start connections from any handle (handles align to the resized node)
   - Resize the node; in `contain`, height updates to `header + width * aspect`
   - Switch `imageSize` between `contain | cover | fill | fit` and verify behavior

---

## Troubleshooting

- **Handles feel offset after resize**
  - Ensure NodeHandles uses *normalized* width/height (`toPxNumber`) or reads the numeric `width`/`height` you pass from ImageNode.

- **Node doesn’t drag from image area**
  - The `<img>` has `pointer-events: none`; drag should be on the container. Make sure your canvas `onStartDrag` is wired to the ImageNode via its `onMouseDown`.

- **Modal doesn’t open**
  - The placeholder area is clickable and keyboard-accessible; verify `ImageUploadModal` is correctly imported and rendered (the patched file includes it).

- **Type errors on import path**
  - Adjust `import { toPxNumber } from '@/src/utils/size'` to your alias (e.g., `@/utils/size`).

Happy building!
