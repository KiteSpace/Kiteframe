import { useMemo } from "react";
import { Link, useSearch } from "wouter";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoffeeHero, CoffeeLayout } from "@/coffee/components/CoffeeLayout";
import { JOURNAL_POSTS, journalTags } from "@/coffee/content/posts";
import { formatPostDate } from "@/coffee/content/format";

/**
 * Journal index. Tag filtering is a `?tag=` param rather than component state,
 * so a filtered list of posts is a shareable link, matching how the map and
 * catalogue behave.
 */
export default function CoffeeJournalPage() {
  const rawSearch = useSearch();
  const activeTag = new URLSearchParams(rawSearch).get("tag");
  const tags = useMemo(() => journalTags(), []);

  const posts = activeTag
    ? JOURNAL_POSTS.filter((post) => post.tags.includes(activeTag))
    : JOURNAL_POSTS;

  return (
    <CoffeeLayout>
      <CoffeeHero
        eyebrow={`${JOURNAL_POSTS.length} pieces`}
        title="Journal"
        lead="Longer pieces about roasting styles, routes worth walking, and how the entries in this atlas get judged."
      />

      <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 sm:py-12">
        {tags.length > 0 && (
          <div className="mb-10 flex flex-wrap items-center gap-2 border-b border-border pb-6">
            <span className="coffee-eyebrow mr-2 text-muted-foreground">
              Filter
            </span>
            <TagLink label="All" href="/coffee/journal" active={!activeTag} />
            {tags.map(({ tag, count }) => (
              <TagLink
                key={tag}
                label={`${tag} (${count})`}
                href={`/coffee/journal?tag=${encodeURIComponent(tag)}`}
                active={activeTag === tag}
              />
            ))}
          </div>
        )}

        <div data-testid="list-coffee-journal">
          {posts.map((post) => (
            <article key={post.slug} className="border-b border-border">
              <Link
                href={`/coffee/journal/${post.slug}`}
                className="group grid items-start gap-6 py-8 md:grid-cols-[200px_minmax(0,1fr)_auto]"
                data-testid={`link-coffee-post-${post.slug}`}
              >
                {post.coverImage ? (
                  <img
                    src={post.coverImage}
                    alt=""
                    loading="lazy"
                    className="h-32 w-full border border-border object-cover md:h-28"
                  />
                ) : (
                  <div className="hidden md:block" />
                )}

                <div>
                  <p className="coffee-eyebrow text-muted-foreground">
                    {formatPostDate(post.date)} · {post.readingMinutes} min read
                  </p>
                  <h2 className="coffee-display mt-2 max-w-[24ch] text-3xl transition-colors group-hover:text-brand sm:text-4xl">
                    {post.title}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {post.excerpt}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <ArrowUpRight className="hidden h-7 w-7 self-center text-muted-foreground transition-colors group-hover:text-brand md:block" />
              </Link>
            </article>
          ))}

          {posts.length === 0 && (
            <p className="py-16 text-center text-muted-foreground">
              Nothing tagged “{activeTag}” yet.
            </p>
          )}
        </div>
      </div>
    </CoffeeLayout>
  );
}

function TagLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "coffee-pill",
        active
          ? "border-brand bg-brand text-brand-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}
