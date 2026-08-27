import { Link, useParams } from "wouter";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, CalendarDays, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CoffeeLayout } from "@/coffee/components/CoffeeLayout";
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
          <h1 className="text-2xl font-semibold">No such post</h1>
          <p className="mt-2 text-muted-foreground">
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
      <article className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/coffee/journal"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          data-testid="link-coffee-post-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to the journal
        </Link>

        <header className="space-y-4">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {formatPostDate(post.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {post.readingMinutes} min read
            </span>
            <span className="flex flex-wrap gap-1">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="font-normal">
                  {tag}
                </Badge>
              ))}
            </span>
          </div>
        </header>

        {post.coverImage && (
          <img
            src={post.coverImage}
            alt=""
            className="mt-6 aspect-[16/7] w-full rounded-lg border border-border object-cover"
          />
        )}

        <div className="prose prose-stone mt-8 max-w-none dark:prose-invert prose-headings:tracking-tight prose-p:leading-relaxed prose-li:leading-relaxed">
          <ReactMarkdown>{post.body}</ReactMarkdown>
        </div>

        {mentioned.length > 0 && (
          <>
            <Separator className="my-10" />
            <section>
              <h2 className="mb-4 text-lg font-semibold tracking-tight">
                Shops in this post
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {mentioned.map((shop) => (
                  <ShopCard key={shop.slug} shop={shop} search="" />
                ))}
              </div>
            </section>
          </>
        )}
      </article>
    </CoffeeLayout>
  );
}
