---
name: Tailwind preflight removes list markers
description: Why bullets and numbers are invisible in rich-text/contentEditable output, and the three places that must re-declare them.
---

Tailwind's preflight (`@tailwind base`) resets `ol, ul, menu { list-style: none;
margin: 0; padding: 0 }` globally. Anything that produces real `<ul>`/`<ol>`
markup — a rich-text editor, `dangerouslySetInnerHTML`, `document.execCommand`
— therefore renders lists with no bullets and no numbers. The list *structure*
is correct, which makes it look like the list feature is broken rather than the
styling.

**Rule:** every render path that can emit a list must explicitly set
`list-style-type` (`disc` / `decimal`), `list-style-position: outside` and a
non-zero `padding-left`.

**Why:** a rich-text field typically has three such paths that drift apart —
the live contentEditable DOM (built by `execCommand`, which emits a bare
`<ul>`), the HTML string generated when entering edit mode, and the read-only
React rendering. Fixing only one makes lists appear correct while editing and
vanish on commit, or vice versa.

**How to apply:** keep the marker/padding values in shared constants next to
each other, and after any `insertUnorderedList` / `insertOrderedList` command
re-walk `editor.querySelectorAll('ul, ol')` and re-apply them — `execCommand`
creates fresh unstyled elements every time.

Related: `execCommand` list commands also move a collapsed caret to the start of
the rebuilt list item. Capture the caret's character offset within the editor
before the command and restore it after, or the user's next Enter inserts an
empty bullet above their text.
