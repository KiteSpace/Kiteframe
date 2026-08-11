/**
 * Shared access to the KiteAI chat transcript.
 *
 * The chat transcript is persisted per project under
 * `kiteframe-kiteai-chat-<projectId>`. Historically only the KiteAIChat
 * component read or wrote it, which meant the two flows that actually generate
 * interfaces — the home-screen prompt and the workflow→interface bridge — ran
 * completely outside the conversation. The user asked for something, screens
 * appeared, and nothing about it was ever recorded: no prompt, no reply, no
 * preview, and no hint that the result could be changed.
 *
 * This module lets those flows append to the same transcript the chat renders,
 * and notifies any mounted chat so the messages show up immediately rather than
 * only after a remount.
 *
 * Note: types are intentionally structural (not imported from KiteAIChat) to
 * keep this module free of React/component imports — HomeScreen and
 * workflow-editor import it on paths where the chat may not be mounted at all.
 */

export const CHAT_STORAGE_KEY_PREFIX = 'kiteframe-kiteai-chat-';

/** Bucket for an exchange produced before a project exists to attach it to. */
const PENDING_EXCHANGE_KEY = 'kiteframe-kiteai-pending-exchange';

/** Fired on `window` whenever a transcript is appended to out-of-band. */
export const TRANSCRIPT_APPENDED_EVENT = 'kiteai-transcript-appended';

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

function readRaw(storageKey: string): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function notify(projectId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TRANSCRIPT_APPENDED_EVENT, { detail: { projectId } }));
}

/**
 * Append messages to a project's transcript.
 *
 * Appends rather than replaces, so any clarifying back-and-forth that happened
 * before generation stays in the thread and in order. Entries whose id already
 * exists are skipped, which makes this safe to call twice for the same
 * generation (e.g. a retried request).
 */
export function appendTranscript(projectId: string, entries: TranscriptEntry[]): void {
  if (typeof window === 'undefined' || !projectId || entries.length === 0) return;
  const storageKey = transcriptStorageKey(projectId);
  try {
    const existing = readRaw(storageKey);
    const seen = new Set(existing.map((m: any) => m?.id).filter(Boolean));
    const additions = entries.filter((e) => !seen.has(e.id));
    if (additions.length === 0) return;
    localStorage.setItem(storageKey, JSON.stringify([...existing, ...additions]));
    notify(projectId);
  } catch {
    // Storage full or unavailable — the generation itself still succeeded, so
    // failing to record it must never surface as an error to the user.
  }
}

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
 * Move a stashed pre-project exchange into this project's transcript, but only
 * if it belongs to the current user and has not expired.
 *
 * The stash is removed *before* it is appended, so a stash can only ever be
 * claimed once even if two chats mount at the same moment.
 *
 * Returns the adopted entries (already appended) so a mounted chat can merge
 * them into its in-memory state without re-reading storage.
 */
export function adoptPendingTranscript(
  projectId: string,
  currentUserId: string | undefined,
): TranscriptEntry[] {
  if (typeof window === 'undefined' || !projectId || !currentUserId) return [];
  try {
    const raw = localStorage.getItem(PENDING_EXCHANGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as Partial<PendingStash> | unknown;
    const stash = parsed as PendingStash;
    if (!stash || !Array.isArray(stash.entries) || stash.entries.length === 0) {
      clearPendingStash();
      return [];
    }

    // Not ours — leave it alone. The rightful owner may still sign back in and
    // claim it; expiry (below, on their own read) will clean it up otherwise.
    if (stash.ownerId !== currentUserId) return [];

    if (typeof stash.createdAt === 'number' && Date.now() - stash.createdAt > PENDING_TTL_MS) {
      clearPendingStash();
      return [];
    }

    // Claim before appending so a concurrent mount cannot adopt it too.
    clearPendingStash();
    appendTranscript(projectId, stash.entries);
    return stash.entries;
  } catch {
    return [];
  }
}

/**
 * Subscribe to out-of-band appends for a project's transcript. Covers both
 * same-tab appends (custom event) and other-tab appends (storage event).
 */
export function subscribeTranscript(projectId: string | undefined, onChange: () => void): () => void {
  if (typeof window === 'undefined' || !projectId) return () => {};
  const key = transcriptStorageKey(projectId);
  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent<{ projectId?: string }>).detail;
    if (!detail || detail.projectId === projectId) onChange();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === key) onChange();
  };
  window.addEventListener(TRANSCRIPT_APPENDED_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(TRANSCRIPT_APPENDED_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

/** Read a project's transcript, with timestamps rehydrated to Date objects. */
export function readTranscript(projectId: string): TranscriptEntry[] {
  return readRaw(transcriptStorageKey(projectId)).map((m: any) => ({
    ...m,
    timestamp: m?.timestamp instanceof Date ? m.timestamp : new Date(m?.timestamp ?? Date.now()),
  }));
}

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
