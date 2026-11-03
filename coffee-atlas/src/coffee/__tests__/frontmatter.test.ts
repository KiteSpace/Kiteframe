import { describe, expect, it } from "vitest";
import { estimateReadingMinutes, parseFrontmatter } from "../content/frontmatter";
import { JOURNAL_POSTS, journalPostBySlug, journalTags } from "../content/posts";
import { shopBySlug } from "@shared/coffee/shops";

describe("parseFrontmatter", () => {
  it("splits fields from the body", () => {
    const { data, body } = parseFrontmatter(
      ["---", "title: A Post", "date: 2024-06-08", "---", "", "Body text."].join("\n"),
    );

    expect(data.title).toBe("A Post");
    expect(data.date).toBe("2024-06-08");
    expect(body).toBe("Body text.");
  });

  it("returns the whole file as body when there is no frontmatter", () => {
    const { data, body } = parseFrontmatter("# Just markdown\n\nNo fence here.");
    expect(data).toEqual({});
    expect(body).toBe("# Just markdown\n\nNo fence here.");
  });

  it("reads inline lists", () => {
    const { data } = parseFrontmatter(
      ['---', 'tags: [tokyo, "two words", japan]', '---', 'body'].join("\n"),
    );
    expect(data.tags).toEqual(["tokyo", "two words", "japan"]);
  });

  it("reads block lists", () => {
    const { data } = parseFrontmatter(
      ["---", "shops:", "  - fuglen-tokyo", "  - koffee-mameya", "---", "body"].join("\n"),
    );
    expect(data.shops).toEqual(["fuglen-tokyo", "koffee-mameya"]);
  });

  it("treats an empty inline list as an empty array", () => {
    const { data } = parseFrontmatter(["---", "tags: []", "---", "body"].join("\n"));
    expect(data.tags).toEqual([]);
  });

  it("gives an empty array to a list header with no items", () => {
    const { data } = parseFrontmatter(
      ["---", "tags:", "title: After", "---", "body"].join("\n"),
    );
    expect(data.tags).toEqual([]);
    expect(data.title).toBe("After");
  });

  it("coerces booleans and numbers but leaves dates as strings", () => {
    const { data } = parseFrontmatter(
      ["---", "draft: true", "readingMinutes: 7", "date: 2024-04-12", "---", "b"].join("\n"),
    );
    expect(data.draft).toBe(true);
    expect(data.readingMinutes).toBe(7);
    expect(data.date).toBe("2024-04-12");
  });

  it("strips surrounding quotes from values", () => {
    const { data } = parseFrontmatter(
      ["---", 'title: "Quoted: with a colon"', "---", "b"].join("\n"),
    );
    expect(data.title).toBe("Quoted: with a colon");
  });

  it("ignores comments and blank lines", () => {
    const { data } = parseFrontmatter(
      ["---", "# a comment", "", "title: Kept", "---", "b"].join("\n"),
    );
    expect(data).toEqual({ title: "Kept" });
  });

  it("handles CRLF line endings and a byte-order mark", () => {
    const { data, body } = parseFrontmatter(
      "\uFEFF---\r\ntitle: Windows\r\n---\r\nBody.",
    );
    expect(data.title).toBe("Windows");
    expect(body).toBe("Body.");
  });

  it("does not treat a horizontal rule in the body as a closing fence", () => {
    const { data, body } = parseFrontmatter(
      ["---", "title: T", "---", "", "Intro", "", "---", "", "After the rule"].join("\n"),
    );
    expect(data.title).toBe("T");
    expect(body).toContain("After the rule");
  });
});

describe("estimateReadingMinutes", () => {
  it("never returns less than a minute", () => {
    expect(estimateReadingMinutes("a few words")).toBe(1);
  });

  it("scales with word count", () => {
    expect(estimateReadingMinutes("word ".repeat(600))).toBe(3);
  });
});

describe("journal posts", () => {
  it("loads the markdown files in the content folder", () => {
    expect(JOURNAL_POSTS.length).toBeGreaterThan(0);
  });

  it("derives the slug from the filename and can look posts up by it", () => {
    for (const post of JOURNAL_POSTS) {
      expect(post.slug).toMatch(/^[a-z0-9-]+$/);
      expect(journalPostBySlug(post.slug)).toBe(post);
    }
  });

  it("gives every post a title, date, excerpt, and body", () => {
    for (const post of JOURNAL_POSTS) {
      expect(post.title.length).toBeGreaterThan(0);
      expect(post.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(post.excerpt.length).toBeGreaterThan(0);
      expect(post.body.length).toBeGreaterThan(0);
    }
  });

  it("orders posts newest first", () => {
    const dates = JOURNAL_POSTS.map((post) => post.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("strips the frontmatter fence out of the rendered body", () => {
    for (const post of JOURNAL_POSTS) {
      expect(post.body.startsWith("---")).toBe(false);
      expect(post.body).not.toContain("excerpt:");
    }
  });

  it("only references shops that exist in the atlas", () => {
    for (const post of JOURNAL_POSTS) {
      for (const slug of post.shops) {
        expect(shopBySlug(slug), `${post.slug} references ${slug}`).toBeDefined();
      }
    }
  });

  it("tallies tags across posts, most used first", () => {
    const tags = journalTags();
    expect(tags.length).toBeGreaterThan(0);
    const counts = tags.map((entry) => entry.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});
