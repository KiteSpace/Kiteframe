import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('workflow reader and comments layering', () => {
  it('keeps the reader overlay above the comments overlay without a drop shadow', () => {
    const readerSource = read('client/src/components/reader/ReaderPane.tsx');
    const commentsSource = read('client/src/components/comments/CommentsOverlay.tsx');

    expect(readerSource).toContain("'absolute top-0 bottom-0 right-0 z-[90]'");
    expect(readerSource).not.toContain('shadow-[-10px_0_28px_rgba(0,0,0,0.20)]');
    expect(commentsSource).toContain('className="absolute inset-0 overflow-hidden z-[80]"');
  });
});