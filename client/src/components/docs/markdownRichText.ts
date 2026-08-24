const UNSUPPORTED_MARKDOWN_PATTERNS = [
  /^\s*\|.*\|\s*$/m, // tables
  /!\[[^\]]*]\([^)]*\)/, // images
  /^\s*[-*+]\s+\[[ xX]]\s+/m, // task lists
  /^\s{2,}(?:[-*+]\s+|\d+\.\s+)/m, // nested lists
  /<[/!]?[a-z][^>]*>/i, // embedded HTML
  /^\[\^[^\]]+]:/m, // footnotes
];

export function hasUnsupportedRichMarkdown(markdown: string): boolean {
  if (UNSUPPORTED_MARKDOWN_PATTERNS.some((pattern) => pattern.test(markdown))) {
    return true;
  }

  return Array.from(markdown.matchAll(/\[[^\]]+]\(([^)\s]+)\)/g))
    .some((match) => !safeHref(match[1]));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeHref(href: string): string | null {
  const trimmed = href.trim();
  return /^(https?:\/\/|mailto:|tel:|\/|\.{1,2}\/|#)/i.test(trimmed) ? trimmed : null;
}

function inlineMarkdownToHtml(value: string): string {
  const codeTokens: string[] = [];
  let html = escapeHtml(value).replace(/`([^`\n]+)`/g, (_match, code: string) => {
    const token = `\u0000${codeTokens.length}\u0000`;
    codeTokens.push(`<code>${code}</code>`);
    return token;
  });

  html = html.replace(/\[([^\]]+)]\(([^)\s]+)\)/g, (_match, label: string, href: string) => {
    const safe = safeHref(href);
    return safe ? `<a href="${escapeHtml(safe)}">${label}</a>` : label;
  });
  html = html.replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>');
  html = html.replace(/(^|[^\w])(\*|_)([^*_]+?)\2/g, '$1<em>$3</em>');

  return html.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => codeTokens[Number(index)] ?? '');
}

function listToHtml(lines: string[], ordered: boolean): string {
  const marker = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-+*]\s+(.*)$/;
  const items = lines.map((line) => `<li>${inlineMarkdownToHtml(line.match(marker)?.[1] ?? '')}</li>`).join('');
  return `<${ordered ? 'ol' : 'ul'}>${items}</${ordered ? 'ol' : 'ul'}>`;
}

/**
 * Converts the supported markdown subset to safe, editable HTML. The source is
 * escaped before tags are introduced, so contentEditable never receives raw
 * user-supplied HTML.
 */
export function markdownToRichHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${inlineMarkdownToHtml(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s{0,3}(?:---+|\*\s*\*\s*\*|___+)\s*$/.test(line)) {
      blocks.push('<hr>');
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      blocks.push(`<blockquote><p>${inlineMarkdownToHtml(quote.join('\n')).replace(/\n/g, '<br>')}</p></blockquote>`);
      continue;
    }

    const isUnordered = /^\s*[-+*]\s+/.test(line);
    const isOrdered = /^\s*\d+\.\s+/.test(line);
    if (isUnordered || isOrdered) {
      const matcher = isOrdered ? /^\s*\d+\.\s+/ : /^\s*[-+*]\s+/;
      const items: string[] = [];
      while (index < lines.length && matcher.test(lines[index])) {
        items.push(lines[index]);
        index += 1;
      }
      blocks.push(listToHtml(items, isOrdered));
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^```|^(#{1,3})\s+|^\s*>\s?|^\s*[-+*]\s+|^\s*\d+\.\s+|^\s{0,3}(?:---+|\*\s*\*\s*\*|___+)\s*$/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(`<p>${inlineMarkdownToHtml(paragraph.join('\n')).replace(/\n/g, '<br>')}</p>`);
  }

  return blocks.join('') || '<p><br></p>';
}

function inlineHtmlToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const element = node as HTMLElement;
  const content = Array.from(element.childNodes).map(inlineHtmlToMarkdown).join('');
  switch (element.tagName.toLowerCase()) {
    case 'br':
      return '\n';
    case 'strong':
    case 'b':
      return `**${content}**`;
    case 'em':
    case 'i':
      return `*${content}*`;
    case 'code':
      return element.parentElement?.tagName.toLowerCase() === 'pre' ? content : `\`${content}\``;
    case 'a': {
      const href = safeHref(element.getAttribute('href') ?? '');
      return href ? `[${content}](${href})` : content;
    }
    default:
      return content;
  }
}

function listToMarkdown(list: HTMLElement, depth = 0): string[] {
  const marker = list.tagName.toLowerCase() === 'ol' ? '1.' : '-';
  const indent = '  '.repeat(depth);
  return Array.from(list.children).flatMap((child) => {
    if (child.tagName.toLowerCase() !== 'li') return [];
    const item = child as HTMLElement;
    const inline = Array.from(item.childNodes)
      .filter((node) => !(node instanceof HTMLElement && /^(ul|ol)$/i.test(node.tagName)))
      .map(inlineHtmlToMarkdown)
      .join('')
      .trim();
    const nested = Array.from(item.children)
      .filter((node) => /^(ul|ol)$/i.test(node.tagName))
      .flatMap((node) => listToMarkdown(node as HTMLElement, depth + 1));
    return [`${indent}${marker} ${inline}`.trimEnd(), ...nested];
  });
}

/** Serialises browser editing markup back into the canonical markdown string. */
export function richHtmlToMarkdown(editor: HTMLElement): string {
  const blocks: string[] = [];

  Array.from(editor.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) blocks.push(text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    const content = Array.from(element.childNodes).map(inlineHtmlToMarkdown).join('').trim();
    if (/^h[1-3]$/.test(tag)) {
      blocks.push(`${'#'.repeat(Number(tag[1]))} ${content}`.trim());
    } else if (tag === 'ul' || tag === 'ol') {
      blocks.push(listToMarkdown(element).join('\n'));
    } else if (tag === 'blockquote') {
      const quote = content.split('\n').map((line) => `> ${line}`).join('\n');
      blocks.push(quote);
    } else if (tag === 'pre') {
      blocks.push(`\`\`\`\n${element.textContent?.replace(/\n$/, '') ?? ''}\n\`\`\``);
    } else if (tag === 'hr') {
      blocks.push('---');
    } else if (content) {
      blocks.push(content);
    }
  });

  return blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}