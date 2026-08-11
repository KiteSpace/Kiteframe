---
name: Persisting component state under an id prop
description: Why the "which id does this data belong to" marker must be state rather than a ref, or an id change silently writes the previous entity's data under the new key.
---

When a component holds data in state and persists it under a key derived from
an id **prop** (`designId`, `projectId`, …), track which id the in-memory data
belongs to as **state**, updated in the same batch as the data — never as a ref,
and never by relying on effect declaration order alone.

**Why:** when the id prop changes, React re-runs every effect with the NEW id
but the OLD data, because the reload effect has not been applied yet. A persist
effect that only depends on `[data, id]` therefore writes entity A's data under
entity B's key, and the subsequent hydration reads back the contaminated key.
A ref does not fix it: whichever effect updates the ref runs in the same commit,
so the other effect either sees it too early or too late. Only state changes
atomically with the data it describes.

The shape that works:

```
const [data, setData] = useState(initialFor(id));
const [dataOwnerId, setDataOwnerId] = useState(id);
const isCurrent = dataOwnerId === id;

useEffect(() => { if (!isCurrent) return; persist(id, data); }, [data, id, isCurrent]);
useEffect(() => {                       // declared last
  if (isCurrent) return;
  setData(loadFor(id));
  setDataOwnerId(id);                   // batched with setData
}, [id, isCurrent]);
```

Any callback that folds memory back into storage (a cross-tab subscriber, for
instance) needs the same guard, via a ref mirroring the owner id.

**How to apply:** whenever a persistence effect's storage key comes from a prop
that can change without the component unmounting. Note that a full page reload
hides the bug completely — only in-app navigation between two entities triggers
it, so browser tests that navigate with a fresh page load will not catch it.
