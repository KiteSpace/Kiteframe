import { describe, expect, it } from 'vitest';
import { isPromptDocument, readPromptDocument, withPromptDocuments } from '../promptDocuments';

function file(name: string, text: string, size = text.length): File {
  return { name, size, text: async () => text } as File;
}

describe('prompt documents', () => {
  it('accepts Markdown and plain text with case-insensitive extensions', () => {
    expect(isPromptDocument(file('brief.MD', 'Brief'))).toBe(true);
    expect(isPromptDocument(file('brief.txt', 'Brief'))).toBe(true);
    expect(isPromptDocument(file('workflow.json', '{}'))).toBe(false);
  });
  it('reads documents without parsing them as workflow JSON', async () => {
    expect(await readPromptDocument(file('brief.md', '# A workflow\nUpload a file'))).toBe('# A workflow\nUpload a file');
  });
  it('rejects empty or oversized documents explicitly', async () => {
    await expect(readPromptDocument(file('brief.txt', '  '))).rejects.toThrow('empty');
    await expect(readPromptDocument(file('brief.txt', 'Brief', 100001))).rejects.toThrow('100 KB');
  });
  it('includes every document in model context without requiring a typed prompt', () => {
    expect(withPromptDocuments('', [
      { name: 'brief.md', textContent: '# Requirements' },
      { name: 'steps.txt', textContent: 'Review\nApprove' },
      { name: 'photo.png' },
    ])).toBe('Attached document "brief.md":\n# Requirements\n\nAttached document "steps.txt":\nReview\nApprove');
  });
});
