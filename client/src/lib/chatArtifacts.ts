/**
 * Turning generated documents into chat artifacts.
 *
 * When the assistant writes a spec, the conversation should record that it
 * happened without becoming the document. Two thresholds decide whether a
 * generation is worth a card at all:
 *
 *  - Section count: a one-section result is a paragraph, not a document, and a
 *    card around a paragraph is more chrome than content.
 *  - Word count: an empty scaffold of headings is not something the user wants
 *    to be told about; it is something they want filled in.
 *
 * Below either threshold nothing is appended. Silence is better than a card
 * that opens onto an empty document.
 */

import { buildDocId } from '@shared/documents';
import { appendTranscript, type ChatArtifact, type TranscriptEntry } from './kiteaiTranscript';

export const ARTIFACT_MIN_SECTIONS = 2;
export const ARTIFACT_MIN_WORDS = 120;

const EXCERPT_MAX_CHARS = 200;

export interface DocumentArtifactInput {
  docKind: 'project-prd' | 'workflow-prd';
  workflowId?: string;
  title: string;
  kindLabel: string;
  sections: { id: string; title: string; content: string }[];
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Markdown reads badly at excerpt size; strip the syntax, keep the words. */
function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/[*_>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildExcerpt(sections: { content: string }[]): string | undefined {
  const source = sections.map(s => s.content || '').find(c => c.trim().length > 0);
  if (!source) return undefined;
  const plain = toPlainText(source);
  if (!plain) return undefined;
  return plain.length > EXCERPT_MAX_CHARS ? `${plain.slice(0, EXCERPT_MAX_CHARS).trimEnd()}…` : plain;
}

/**
 * Build the artifact for a generated document, or null when the result is too
 * thin to be worth surfacing as one.
 */
export function buildDocumentArtifact(input: DocumentArtifactInput): ChatArtifact | null {
  const sections = input.sections.filter(s => (s.content || '').trim().length > 0);
  if (sections.length < ARTIFACT_MIN_SECTIONS) return null;

  const wordCount = sections.reduce((sum, s) => sum + countWords(s.content), 0);
  if (wordCount < ARTIFACT_MIN_WORDS) return null;

  return {
    docId: buildDocId(input.docKind, input.workflowId),
    docKind: input.docKind,
    workflowId: input.workflowId,
    title: input.title,
    kindLabel: input.kindLabel,
    sectionCount: sections.length,
    wordCount,
    excerpt: buildExcerpt(sections),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Record a generated document in the project's chat as an artifact card.
 *
 * Writes straight to the transcript rather than through the chat component, so
 * a generation triggered from the Project tab or the reader still shows up in
 * the conversation — the chat does not have to be mounted, or even visited.
 */
export function announceDocumentArtifact(
  projectId: string | undefined,
  input: DocumentArtifactInput,
): ChatArtifact | null {
  const artifact = buildDocumentArtifact(input);
  if (!artifact || !projectId) return null;

  const entry: TranscriptEntry = {
    id: `artifact-${artifact.docId}-${Date.now()}`,
    role: 'assistant',
    content: `I've written **${artifact.title}**.`,
    timestamp: new Date(),
    artifact,
  };

  appendTranscript(projectId, [entry]);
  return artifact;
}
