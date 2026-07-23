---
name: Interface generation concurrency plan
description: Plan for blocking multiple concurrent AI interface generation requests from the Create Interface button on workflow pills.
---

## The problem
`isGeneratingInterface` is React `useState` — updates are async. Two clicks before the first re-render both read `false`, both pass the guard, and both fire full AI + design-create requests simultaneously. With a button on every workflow pill this is more likely.

**Relevant state location:** `workflow-editor.tsx` line ~2257  
**Guard location:** `workflow-editor.tsx` line ~10617 (inside `onGenerateInterface` handler)

## Recommended fix — `useRef` mutex (minimal, correct)

```js
const generatingInterfaceRef = useRef(false);

// Replace the state guard in the handler:
if (generatingInterfaceRef.current) return;
generatingInterfaceRef.current = true;
setIsGeneratingInterface(true);   // keeps the UI spinner/disabled state
try {
  // ... fetch /api/ai/design, then fetch /api/designs ...
} finally {
  generatingInterfaceRef.current = false;
  setIsGeneratingInterface(false);
}
```

**Why:** ref reads/writes are synchronous — no two clicks in the same tick can both pass through. `useState` stays alongside it purely for UI (spinner + disabled on all pills).

## Additive improvement — AbortController for stale-request cancellation

Useful if the user switches workflow tabs mid-generation and wants to generate a different one.

```js
const abortControllerRef = useRef<AbortController | null>(null);

// On new generation attempt:
abortControllerRef.current?.abort();
abortControllerRef.current = new AbortController();

// Pass signal to both fetches:
fetch("/api/ai/design", { ..., signal: abortControllerRef.current.signal })
fetch("/api/designs",   { ..., signal: abortControllerRef.current.signal })
```

**Why:** Cancels the in-flight request rather than ignoring the new click entirely — better UX when the user genuinely wants to switch flows.

## Options considered and rejected

| Approach | Why not |
|---|---|
| `disabled` alone | Race between click and re-render — doesn't close the gap |
| AbortController alone | Doesn't prevent double-launch, only cancels previous |
| Backend idempotency key | Correct but heavy — server + client change needed |

## Implementation scope
- File: `client/src/pages/workflow-editor.tsx`
- ~10 line change total (add ref, replace guard, update finally)
- No server changes needed for the mutex approach
