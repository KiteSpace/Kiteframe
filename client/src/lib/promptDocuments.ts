export const MAX_PROMPT_DOCUMENT_BYTES = 100_000;
export const PROMPT_DOCUMENT_ACCEPT = '.md,.txt,text/plain,text/markdown';

export function isPromptDocument(file: Pick<File, 'name'>): boolean {
  return /\.(md|txt)$/i.test(file.name);
}

export async function readPromptDocument(file: File): Promise<string> {
  if (!isPromptDocument(file)) throw new Error('Choose a .md or .txt document.');
  if (file.size > MAX_PROMPT_DOCUMENT_BYTES) {
    throw new Error(`${file.name} is too large. Text documents must be under 100 KB.`);
  }
  const content = await file.text();
  if (!content.trim()) throw new Error(`${file.name} is empty.`);
  return content;
}

export function withPromptDocuments(
  prompt: string,
  attachments: Array<{ name: string; textContent?: string }>,
): string {
  return [
    prompt,
    ...attachments.filter(a => a.textContent !== undefined).map(a =>
      `Attached document ${JSON.stringify(a.name)}:\n${a.textContent}`,
    ),
  ].filter(Boolean).join('\n\n');
}
