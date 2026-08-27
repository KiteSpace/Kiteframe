import { journalPostSchema, type JournalPost } from "@shared/coffee/types";
import { estimateReadingMinutes, parseFrontmatter } from "./frontmatter";

/**
 * Journal posts, loaded from the markdown files next to this module.
 *
 * Vite inlines the raw files at build time, so posts are part of the bundle and
 * need no API. Adding a post means adding a `.md` file — the slug comes from
 * the filename and nothing else has to be registered.
 */

const RAW_POSTS = import.meta.glob("./posts/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim() !== "") return [value];
  return [];
}

function loadPosts(): JournalPost[] {
  const posts: JournalPost[] = [];

  for (const [path, source] of Object.entries(RAW_POSTS)) {
    const slug = path.replace(/^.*\//, "").replace(/\.md$/, "");
    const { data, body } = parseFrontmatter(source);

    const candidate = {
      slug,
      title: asString(data.title, slug),
      date: asString(data.date, "1970-01-01"),
      excerpt: asString(data.excerpt, body.slice(0, 180)),
      tags: asStringArray(data.tags),
      shops: asStringArray(data.shops),
      coverImage: typeof data.coverImage === "string" ? data.coverImage : undefined,
      readingMinutes:
        typeof data.readingMinutes === "number"
          ? data.readingMinutes
          : estimateReadingMinutes(body),
      body,
    };

    const parsed = journalPostSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new Error(
        `Invalid journal post "${path}": ${parsed.error.issues
          .map((issue) => `${issue.path.join(".")} ${issue.message}`)
          .join("; ")}`,
      );
    }
    posts.push(parsed.data);
  }

  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

export const JOURNAL_POSTS: JournalPost[] = loadPosts();

export function journalPostBySlug(slug: string): JournalPost | undefined {
  return JOURNAL_POSTS.find((post) => post.slug === slug);
}

/** Every tag used across the journal, most-used first. */
export function journalTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of JOURNAL_POSTS) {
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
