import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import AdmZip from 'adm-zip';
import nodemailer from 'nodemailer';

const require = createRequire(import.meta.url);
const dependencyRoots = [
  { name: 'application', load: require },
  {
    name: 'mockup sandbox',
    load: createRequire(new URL('../../artifacts/mockup-sandbox/package.json', import.meta.url)),
  },
];

for (const { name, load } of dependencyRoots) {
  describe(`${name} guarded brace parser`, () => {
    const braces = load('braces');

    it('preserves ordinary expansion and compilation', () => {
      expect(braces.expand('src/{client,server}/file-{01..02}.ts')).toEqual([
        'src/client/file-01.ts', 'src/client/file-02.ts',
        'src/server/file-01.ts', 'src/server/file-02.ts',
      ]);
      expect(braces.compile('a/{b,c}/d')).toBe('a/(b|c)/d');
    });

    for (const method of ['parse', 'compile', 'expand', 'stringify']) {
      it(`${method} rejects excessive nesting before a stack overflow`, () => {
        for (const [open, close] of [['{', '}'], ['(', ')']]) {
          const input = open.repeat(4000) + 'x' + close.repeat(4000);
          expect(() => braces[method](input)).toThrow(/exceeds max depth/);
        }
      });
    }

    for (const method of ['compile', 'expand', 'stringify']) {
      it(`${method} also bounds recursion for caller-supplied ASTs`, () => {
        const root: any = { type: 'root', nodes: [] };
        let parent = root;
        for (let depth = 0; depth < 102; depth++) {
          const child = { type: 'paren', nodes: [], parent };
          parent.nodes.push(child);
          parent = child;
        }
        expect(() => braces[method](root)).toThrow(/exceeds max depth/);
      });
    }
  });
}

describe('upgraded server dependencies', () => {
  it('round-trips zip entries with the patched archive library', () => {
    const archive = new AdmZip();
    archive.addFile('design.json', Buffer.from('{"screens":[]}'));
    const reopened = new AdmZip(archive.toBuffer());
    expect(reopened.readAsText('design.json')).toBe('{"screens":[]}');
  });

  it('composes email with Nodemailer without a network connection', async () => {
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const result = await transport.sendMail({
      from: 'sender@example.invalid',
      to: 'recipient@example.invalid',
      subject: 'Compatibility check',
      text: 'Test message',
    });
    expect(result.message.toString()).toContain('Subject: Compatibility check');
    expect(result.message.toString()).toContain('Test message');
  });
});
