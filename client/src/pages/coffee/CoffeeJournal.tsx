import { useMemo } from "react";
import { Link, useSearch } from "wouter";
import { CalendarDays, Clock, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CoffeeLayout } from "@/coffee/components/CoffeeLayout";
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
      <div className="coffee-hero-wash border-b border-border">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Journal
          </h1>
          <p className="mt-3 text-muted-foreground">
            Longer pieces about roasting styles, routes worth walking, and how
            the entries in this atlas get judged.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        {tags.length > 0 && (
          <div className="mb-8 flex flex-wrap items-center gap-1.5">
            <Tag className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
            <TagLink label="All" href="/coffee/journal" active={!activeTag} />
            {tags.map(({ tag, count }) => (
              <TagLink
                key={tag}
                label={`${tag} ${count}`}
                href={`/coffee/journal?tag=${encodeURIComponent(tag)}`}
                active={activeTag === tag}
              />
            ))}
          </div>
        )}

        <div className="space-y-8" data-testid="list-coffee-journal">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="group border-b border-border-soft pb-8 last:border-0"
            >
              <Link
                href={`/coffee/journal/${post.slug}`}
                className="flex flex-col gap-4 sm:flex-row-reverse sm:items-start"
                data-testid={`link-coffee-post-${post.slug}`}
              >
                {post.coverImage && (
                  <img
                    src={post.coverImage}
                    alt=""
                    loading="lazy"
                    className="h-32 w-full shrink-0 rounded-lg border border-border object-cover sm:w-44"
                  />
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-semibold leading-snug tracking-tight group-hover:text-brand-strong">
                    {post.title}
                  </h2>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {formatPostDate(post.date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {post.readingMinutes} min read
                    </span>
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {post.excerpt}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {post.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="font-normal">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Link>
            </article>
          ))}

          {posts.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">
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
        "rounded-full border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-brand bg-brand text-brand-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {label}
    </Link>
  );
}
