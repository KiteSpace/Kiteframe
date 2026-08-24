---
name: Overriding a shadcn base class that uses a responsive variant
description: Why passing text-[15px] to a shadcn control silently does nothing above the md breakpoint.
---

Several shadcn/ui primitives set type as `text-base md:text-sm` (Textarea and
Input at least). Passing `className="text-[15px]"` appears to work and does
nothing on a desktop viewport.

**Why:** `md:text-sm` is a different tailwind-merge group from the unprefixed
`text-*`, so the merge keeps both — and at ≥768px the responsive variant wins on
CSS ordering. The element keeps 14px and every measurement of it disagrees with
the code.

Restate the override at the same breakpoint: `text-[15px] md:text-[15px]`.

**How to apply:** whenever a size, padding, or display override on a shadcn
control "has no effect", grep the primitive's base class for a `md:` (or other
breakpoint) variant of the same property before assuming a specificity or merge
bug. Assert computed styles, not class names.
