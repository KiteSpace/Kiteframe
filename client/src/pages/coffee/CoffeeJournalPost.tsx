import { Link, useParams } from "wouter";
import ReactMarkdown from "react-markdown";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoffeeHero, CoffeeLayout } from "@/coffee/components/CoffeeLayout";
import { ShopCard } from "@/coffee/components/ShopCard";
import { journalPostBySlug } from "@/coffee/content/posts";
import { formatPostDate } from "@/coffee/content/format";
import { shopBySlug } from "@shared/coffee/shops";
import type { CoffeeShop } from "@shared/coffee/types";

/** A single journal post, with cards for any shops it mentions. */
export default function CoffeeJournalPostPage() {
  const params = useParams<{ slug: string }>();
  const post = journalPostBySlug(params.slug);

  if (!post) {
    return (
      <CoffeeLayout>
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <h1 className="coffee-display text-4xl">No such post</h1>
          <p className="mt-3 text-muted-foreground">
            Nothing in the journal has the slug “{params.slug}”.
          </p>
          <Button asChild className="mt-6">
            <Link href="/coffee/journal">Back to the journal</Link>
          </Button>
        </div>
      </CoffeeLayout>
    );
  }

  // A post can reference a shop that has since been removed from the atlas, so
  // resolve defensively rather than trusting the slug list.
  const mentioned = post.shops
    .map((slug) => shopBySlug(slug))
    .filter((shop): shop is CoffeeShop => Boolean(shop));

  return (
    <CoffeeLayout>
      <CoffeeHero
        size="md"
        width="article"
        eyebrow={`${formatPostDate(post.date)} · ${post.readingMinutes} min read`}
        title={post.title}
        meta={
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <span key={tag} className="coffee-pill coffee-band-muted">
                {tag}
              </span>
            ))}
          </div>
        }
      />

      <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {post.coverImage && (
          <img
            src={post.coverImage}
            alt=""
            className="mb-10 aspect-[16/7] w-full border border-border object-cover"
          />
        )}

        <div className="prose prose-stone max-w-none dark:prose-invert prose-p:leading-relaxed prose-li:leading-relaxed">
          <ReactMarkdown>{post.body}</ReactMarkdown>
        </div>

        <Link
          href="/coffee/journal"
          className="mt-12 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          data-testid="link-coffee-post-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to the journal
        </Link>
      </article>

      {mentioned.length > 0 && (
        <section className="border-t border-border bg-secondary/50">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6">
            <h2 className="coffee-display mb-6 text-3xl sm:text-4xl">
              Shops in this post
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {mentioned.map((shop) => (
                <ShopCard key={shop.slug} shop={shop} search="" />
              ))}
            </div>
          </div>
        </section>
      )}
    </CoffeeLayout>
  );
}
