/**
 * Shared access to the KiteAI chat transcripts.
 *
 * Two surfaces keep a conversation:
 *
 *  - The project/workflow chat, keyed by project under
 *    `kiteframe-kiteai-chat-<projectId>`.
 *  - The design page's right-rail chat, keyed by design under
 *    `kiteframe-design-chat-<designId>`.
 *
 * Historically only the KiteAIChat component read or wrote any of this, which
 * meant the two flows that actually generate interfaces — the home-screen
 * prompt and the workflow→interface bridge — ran completely outside the
 * conversation. The user asked for something, screens appeared, and nothing
 * about it was ever recorded: no prompt, no reply, no preview, and no hint that
 * the result could be changed.
 *
 * This module owns the storage format for both surfaces so those flows can
 * append to the same transcript a chat renders, and so a mounted chat is
 * notified and shows the messages immediately rather than only after a remount.
 *
 * Note: types are intentionally structural (not imported from KiteAIChat) to
 * keep this module free of React/component imports — HomeScreen, DesignEditor
 * and workflow-editor import it on paths where no chat may be mounted at all.
 */

export const CHAT_STORAGE_KEY_PREFIX = 'kiteframe-kiteai-chat-';

/** Right-rail chat on the design page, scoped per design. */
export const DESIGN_CHAT_KEY_PREFIX = 'kiteframe-design-chat-';

/** Bucket for an exchange produced before a project exists to attach it to. */
const PENDING_EXCHANGE_KEY = 'kiteframe-kiteai-pending-exchange';

/** Fired on `window` whenever a transcript is appended to out-of-band. */
export const TRANSCRIPT_APPENDED_EVENT = 'kiteai-transcript-appended';

/**
 * Cap on retained messages per conversation. Browser storage is a shared, hard
 * quota: an unbounded thread eventually throws on write, which would silently
 * stop persisting *every* conversation, not just the long one.
 */
export const MAX_TRANSCRIPT_ENTRIES = 200;

/** Inline preview of a generated design, rendered as a card in the chat. */
export interface DesignPreview {
  designId: string;
  title?: string;
  /** Artboard labels, so the card can list the screens that were produced. */
  screenLabels?: string[];
}

/**
 * Structural subset of KiteAIChat's ChatMessage. Anything written here must
 * stay assignable to that type.
 */
export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant' | 'system';
  type?: string;
  content: string;
  timestamp: Date;
  designPreview?: DesignPreview;
  [key: string]: unknown;
}

export function transcriptStorageKey(projectId: string): string {
  return `${CHAT_STORAGE_KEY_PREFIX}${projectId}`;
}

export function designChatStorageKey(designId: string): string {
  return `${DESIGN_CHAT_KEY_PREFIX}${designId}`;
}

// ─── Storage envelope ────────────────────────────────────────────────────────
//
// Stored as `{ __kt, rev, items }` rather than a bare array so concurrent
// writers can be detected. `rev` increments on every write; a reader that sees
// an unexpected `rev` knows another tab got there first.
//
// Bare arrays are still accepted on read: that is the format every existing
// conversation is already stored in, and downgrading a user's history to an
// empty thread because the envelope was missing would be far worse than the
// race this guards against.

const STORAGE_VERSION = 1;

interface Envelope {
  rev: number;
  items: any[];
}

const EMPTY: Envelope = { rev: 0, items: [] };

function parseEnvelope(raw: string | null): Envelope {
  if (!raw) return { ...EMPTY };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { rev: 0, items: parsed };
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).items)) {
      const rev = (parsed as any).rev;
      return { rev: typeof rev === 'number' && Number.isFinite(rev) ? rev : 0, items: (parsed as any).items };
    }
    return { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

function readEnvelope(storageKey: string): Envelope {
  if (typeof window === 'undefined') return { ...EMPTY };
  try {
    return parseEnvelope(localStorage.getItem(storageKey));
  } catch {
    return { ...EMPTY };
  }
}

/** Keep the most recent entries when a thread exceeds the cap. */
function applyCap(items: any[]): any[] {
  return items.length > MAX_TRANSCRIPT_ENTRIES ? items.slice(items.length - MAX_TRANSCRIPT_ENTRIES) : items;
}

/**
 * Write items back, bumping the revision. Returns false when storage rejected
 * the write (quota, disabled, private mode) so callers can keep what they have
 * in memory rather than assume it was saved.
 *
 * There is deliberately no compare-and-swap on `rev`. Every read-modify-write
 * in this module is a single synchronous block with no await between the read
 * and the write, and localStorage access is serialised across tabs, so no other
 * tab can interleave inside one. Safety against concurrent tabs comes from the
 * merge being a union by id — order-independent and idempotent — rather than
 * from locking. `rev` exists so a stale write is identifiable in diagnostics.
 */
function writeEnvelope(storageKey: string, items: any[], baseRev: number): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const payload = { __kt: STORAGE_VERSION, rev: baseRev + 1, items: applyCap(items) };
    localStorage.setItem(storageKey, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

function timeOf(entry: any): number {
  const t = entry?.timestamp;
  if (t instanceof Date) return t.getTime();
  const parsed = new Date(t ?? 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Union two message lists by id, in chronological order.
 *
 * Messages are only ever appended and each carries a stable id, so a union is
 * the correct merge: two tabs that each added something converge on both
 * additions rather than one clobbering the other.
 *
 * The sort is stable and `base` comes first, which matters for messages sharing
 * a timestamp: existing history keeps its recorded order and new arrivals land
 * after it, instead of same-millisecond entries being shuffled. Tabs still
 * converge because `base` is always what is currently in storage — whoever
 * writes second builds on the first writer's order, and both then read it back.
 */
function unionByIdChronological(base: any[], incoming: any[]): any[] {
  const seen = new Set(base.map((m) => m?.id).filter(Boolean));
  const additions: any[] = [];
  for (const m of incoming) {
    // `seen` grows as we go, so a batch that repeats an id internally cannot
    // insert the same message twice.
    if (!m?.id || seen.has(m.id)) continue;
    seen.add(m.id);
    additions.push(m);
  }
  if (additions.length === 0) return base;
  return [...base, ...additions].sort((a, b) => timeOf(a) - timeOf(b));
}

function notifyKey(storageKey: string, projectId?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(TRANSCRIPT_APPENDED_EVENT, { detail: { key: storageKey, projectId } }),
  );
}

/**
 * Append messages to a conversation, merging rather than overwriting.
 *
 * Reads immediately before writing and unions by id, so an append cannot drop
 * messages another tab added in the meantime. Entries whose id already exists
 * are skipped, which makes this safe to call twice for the same generation
 * (e.g. a retried request).
 */
function appendToKey(storageKey: string, entries: TranscriptEntry[], projectId?: string): void {
  if (typeof window === 'undefined' || entries.length === 0) return;
  const { rev, items } = readEnvelope(storageKey);
  const merged = unionByIdChronological(items, entries);
  if (merged === items) return; // Nothing new.
  if (writeEnvelope(storageKey, merged, rev)) notifyKey(storageKey, projectId);
}

/**
 * Fold anything a mounted chat holds in memory back into storage.
 *
 * Called when another tab writes the same key. Because both tabs read-modify-
 * write the same slot, the later write would otherwise erase the earlier tab's
 * messages. Unioning what we still hold back in makes the two converge instead.
 *
 * Returns the reconciled list so the caller can render it.
 */
function reconcileKey(storageKey: string, known: TranscriptEntry[]): TranscriptEntry[] {
  const { rev, items } = readEnvelope(storageKey);

  // Do not resurrect history that was intentionally trimmed. Once a thread is
  // at the cap, older entries a tab still holds in memory are expected to be
  // absent from storage — re-adding them would fight the trim forever.
  //
  // The cutoff is strict. An entry sharing the oldest stored timestamp but
  // absent from storage was trimmed, so re-admitting it would push a newer one
  // out and rotate the retained window on every reconcile. Nothing legitimate
  // is lost: a genuinely new message on a capped thread carries a current
  // timestamp, nowhere near the oldest one still stored.
  const atCap = items.length >= MAX_TRANSCRIPT_ENTRIES;
  const oldestStored = atCap ? Math.min(...items.map(timeOf)) : -Infinity;
  const candidates = atCap ? known.filter((k) => timeOf(k) > oldestStored) : known;

  // Deliberately does not fire the same-tab notification. Reconcile is called
  // *by* the component that owns this thread, which is about to render the
  // returned list anyway; notifying would synchronously re-enter the very
  // subscriber that triggered this call. Other tabs are still woken by the
  // browser's own storage event.
  const merged = unionByIdChronological(items, candidates);
  if (merged !== items) writeEnvelope(storageKey, merged, rev);
  return rehydrate(applyCap(merged));
}

function rehydrate(items: any[]): TranscriptEntry[] {
  return items.map((m: any) => ({
    ...m,
    timestamp: m?.timestamp instanceof Date ? m.timestamp : new Date(m?.timestamp ?? Date.now()),
  }));
}

// ─── Generic key-based access ────────────────────────────────────────────────
//
// Exposed for conversations that are keyed by something other than a project or
// design (the read-only discussion thread). Everything must go through here
// rather than touching localStorage directly, or that surface would write bare
// arrays and silently opt out of cross-tab merging.

/** Read any conversation by its storage key, timestamps rehydrated to Dates. */
export function readStoredMessages(storageKey: string): TranscriptEntry[] {
  if (!storageKey) return [];
  return rehydrate(readEnvelope(storageKey).items);
}

/** Persist any conversation by storage key, merging with concurrent writers. */
export function saveStoredMessages(storageKey: string, entries: TranscriptEntry[]): TranscriptEntry[] {
  if (!storageKey) return entries;
  return reconcileKey(storageKey, entries);
}

/** Subscribe to changes for any conversation, in this or another tab. */
export function subscribeStoredMessages(storageKey: string | undefined, onChange: () => void): () => void {
  if (typeof window === 'undefined' || !storageKey) return () => {};
  return subscribeKey(storageKey, onChange);
}

// ─── Project transcript (project/workflow chat) ──────────────────────────────

export function appendTranscript(projectId: string, entries: TranscriptEntry[]): void {
  if (!projectId) return;
  appendToKey(transcriptStorageKey(projectId), entries, projectId);
}

/** Read a project's transcript, with timestamps rehydrated to Date objects. */
export function readTranscript(projectId: string): TranscriptEntry[] {
  if (!projectId) return [];
  return rehydrate(readEnvelope(transcriptStorageKey(projectId)).items);
}

/**
 * Persist the full thread a mounted chat is rendering, merged with whatever
 * else is in storage. Doubles as the cross-tab reconciler: calling it after
 * another tab writes folds this tab's messages back in, so neither side loses
 * what the other added. Returns the merged thread to render.
 */
export function saveTranscript(projectId: string, entries: TranscriptEntry[]): TranscriptEntry[] {
  if (!projectId) return entries;
  return reconcileKey(transcriptStorageKey(projectId), entries);
}

// ─── Design-page transcript (right-rail chat) ────────────────────────────────

export function readDesignChat(designId: string): TranscriptEntry[] {
  if (!designId) return [];
  return rehydrate(readEnvelope(designChatStorageKey(designId)).items);
}

export function appendDesignChat(designId: string, entries: TranscriptEntry[]): void {
  if (!designId) return;
  appendToKey(designChatStorageKey(designId), entries);
}

/**
 * Persist the design chat thread. Reconciles rather than overwrites so a second
 * tab open on the same design cannot erase this one's messages.
 */
export function saveDesignChat(designId: string, entries: TranscriptEntry[]): TranscriptEntry[] {
  if (!designId) return entries;
  return reconcileKey(designChatStorageKey(designId), entries);
}

/** Subscribe to design-chat changes made in this or another tab. */
export function subscribeDesignChat(designId: string | undefined, onChange: () => void): () => void {
  if (typeof window === 'undefined' || !designId) return () => {};
  return subscribeKey(designChatStorageKey(designId), onChange);
}

// ─── Pre-project handoff ─────────────────────────────────────────────────────

/**
 * How long a pre-project exchange stays claimable. The handoff normally happens
 * within seconds of generation (create design → open it → chat mounts). A stale
 * stash must expire rather than linger and attach itself to some unrelated
 * project the user opens hours later.
 */
const PENDING_TTL_MS = 10 * 60 * 1000;

interface PendingStash {
  /** Owner of the exchange. Prevents a different signed-in user on the same
   *  browser from inheriting the previous user's prompt and preview. */
  ownerId: string;
  /** Design the exchange describes, so adoption can be verified/traced. */
  designId: string;
  createdAt: number;
  entries: TranscriptEntry[];
}

/**
 * Stash an exchange that happened before a project existed (the home screen
 * generates a design with no project attached yet).
 *
 * The stash is scoped to the generating user and expires, because it is held in
 * shared browser storage: without an owner it could be adopted by a different
 * account signed in later on the same machine, which would both misattribute
 * the conversation and disclose the previous user's prompt.
 */
export function stashPendingTranscript(
  entries: TranscriptEntry[],
  meta: { ownerId: string; designId: string },
): void {
  if (typeof window === 'undefined' || entries.length === 0) return;
  if (!meta?.ownerId) return; // Unattributable — never stash it.
  try {
    const stash: PendingStash = {
      ownerId: meta.ownerId,
      designId: meta.designId,
      createdAt: Date.now(),
      entries,
    };
    localStorage.setItem(PENDING_EXCHANGE_KEY, JSON.stringify(stash));
  } catch {
    /* non-fatal */
  }
}

/** Drop the stash without adopting it. */
function clearPendingStash(): void {
  try {
    localStorage.removeItem(PENDING_EXCHANGE_KEY);
  } catch {
    /* non-fatal */
  }
}

/**
 * Read and validate the stash for a given owner, claiming it if it is theirs.
 * Returns null when there is nothing claimable.
 *
 * `expectedDesignId`, when given, additionally requires the stash to describe
 * that specific design — used by the design page, which knows exactly which
 * design it is showing and must not absorb an exchange about a different one.
 */
function claimPendingStash(
  currentUserId: string | undefined,
  expectedDesignId?: string,
): PendingStash | null {
  if (typeof window === 'undefined' || !currentUserId) return null;
  try {
    const raw = localStorage.getItem(PENDING_EXCHANGE_KEY);
    if (!raw) return null;

    const stash = JSON.parse(raw) as PendingStash;
    if (!stash || !Array.isArray(stash.entries) || stash.entries.length === 0) {
      clearPendingStash();
      return null;
    }

    // Not ours — leave it alone. The rightful owner may still sign back in and
    // claim it; expiry (below, on their own read) will clean it up otherwise.
    if (stash.ownerId !== currentUserId) return null;

    // A stash with a missing or nonsensical timestamp is treated as expired
    // rather than immortal — otherwise a hand-edited or truncated entry would
    // bypass the TTL and be adopted into a conversation indefinitely.
    if (!Number.isFinite(stash.createdAt) || Date.now() - stash.createdAt > PENDING_TTL_MS) {
      clearPendingStash();
      return null;
    }

    // A design page showing a different design must leave it for the right one.
    if (expectedDesignId && stash.designId !== expectedDesignId) return null;

    // Claim before returning so a concurrent mount cannot adopt it too.
    clearPendingStash();
    return stash;
  } catch {
    return null;
  }
}

/**
 * Move a stashed pre-project exchange into this project's transcript, but only
 * if it belongs to the current user and has not expired.
 *
 * Returns the adopted entries (already appended) so a mounted chat can merge
 * them into its in-memory state without re-reading storage.
 */
export function adoptPendingTranscript(
  projectId: string,
  currentUserId: string | undefined,
): TranscriptEntry[] {
  if (!projectId) return [];
  const stash = claimPendingStash(currentUserId);
  if (!stash) return [];
  appendTranscript(projectId, stash.entries);
  return stash.entries;
}

/**
 * Design-page equivalent: adopt the exchange that produced *this* design.
 *
 * The design page knows which design it is rendering, so unlike the project
 * chat it can require the stash to match rather than accepting whatever is
 * pending.
 */
export function adoptPendingDesignTranscript(
  designId: string,
  currentUserId: string | undefined,
): TranscriptEntry[] {
  if (!designId) return [];
  const stash = claimPendingStash(currentUserId, designId);
  if (!stash) return [];
  appendDesignChat(designId, stash.entries);
  return stash.entries;
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

function subscribeKey(storageKey: string, onChange: () => void): () => void {
  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent<{ key?: string }>).detail;
    if (!detail || detail.key === storageKey) onChange();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === storageKey) onChange();
  };
  window.addEventListener(TRANSCRIPT_APPENDED_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(TRANSCRIPT_APPENDED_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Subscribe to out-of-band appends for a project's transcript. Covers both
 * same-tab appends (custom event) and other-tab appends (storage event).
 */
export function subscribeTranscript(projectId: string | undefined, onChange: () => void): () => void {
  if (typeof window === 'undefined' || !projectId) return () => {};
  return subscribeKey(transcriptStorageKey(projectId), onChange);
}

// ─── Generation exchange ─────────────────────────────────────────────────────

/** Pull artboard labels out of a craft state so the preview card can list screens. */
export function extractScreenLabels(craftState: unknown): string[] {
  let state: Record<string, any> | null = null;
  if (typeof craftState === 'string') {
    try { state = JSON.parse(craftState); } catch { return []; }
  } else if (craftState && typeof craftState === 'object') {
    state = craftState as Record<string, any>;
  }
  if (!state) return [];
  const rootNodes: string[] = Array.isArray(state.ROOT?.nodes) ? state.ROOT.nodes : [];
  const labels: string[] = [];
  for (const id of rootNodes) {
    const node = state[id];
    const name = node?.type?.resolvedName ?? node?.displayName;
    if (name === 'AstryxArtboard') {
      labels.push(String(node?.props?.label ?? id));
    }
  }
  return labels;
}

let seq = 0;
function entryId(kind: string): string {
  seq += 1;
  return `gen-${kind}-${Date.now()}-${seq}`;
}

export interface GenerationExchangeInput {
  /** What the user asked for, in their own words where available. */
  prompt: string;
  /** Design that was created. */
  designId: string;
  title?: string;
  screenLabels?: string[];
  /**
   * How the generation was started. `home` is a directly typed prompt;
   * `workflow` is the workflow→interface bridge, where the prompt is derived
   * from the workflow rather than typed.
   */
  origin: 'home' | 'workflow';
  /** Workflow name, used to phrase the workflow-bridge messages. */
  workflowName?: string;
}

/**
 * Build the full set of messages recording one interface generation:
 * the user's request, KiteAI's reply, an inline preview of the result, and a
 * closing message making it explicit that the design can still be changed.
 */
export function buildGenerationExchange(input: GenerationExchangeInput): TranscriptEntry[] {
  const { prompt, designId, title, screenLabels = [], origin, workflowName } = input;
  const now = Date.now();
  const at = (offset: number) => new Date(now + offset);

  const userContent = origin === 'workflow'
    ? `Generate an interface from${workflowName ? ` the "${workflowName}"` : ' this'} workflow.`
    : prompt;

  const screenCount = screenLabels.length;
  const screenSummary = screenCount > 0
    ? `${screenCount} screen${screenCount === 1 ? '' : 's'}: ${screenLabels.map((l) => `**${l}**`).join(', ')}`
    : 'your interface';

  const assistantContent = origin === 'workflow'
    ? `I turned${workflowName ? ` the "${workflowName}"` : ' this'} workflow into ${screenSummary}. Each step that needs its own screen became one, laid out side by side on the canvas.`
    : `I designed ${screenSummary} based on your description.`;

  const entries: TranscriptEntry[] = [
    {
      id: entryId('prompt'),
      role: 'user',
      type: 'user_prompt',
      content: userContent,
      timestamp: at(0),
    },
    {
      id: entryId('reply'),
      role: 'assistant',
      type: 'workflow_generated',
      content: assistantContent,
      timestamp: at(1),
      designPreview: { designId, title, screenLabels },
    },
    {
      id: entryId('offer'),
      role: 'assistant',
      type: 'discussion',
      content:
        "You can keep going from here — tell me what to change and I'll update the design. For example: rename a screen, add a field or button, change the layout, or add another screen.",
      timestamp: at(2),
    },
  ];

  return entries;
}
