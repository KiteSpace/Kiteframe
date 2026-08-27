import { lazy, Suspense, useCallback } from "react";
import { Link, useParams, useSearch } from "wouter";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, ArrowUpRight, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoffeeHero, CoffeeLayout } from "@/coffee/components/CoffeeLayout";
import { RatingStars } from "@/coffee/components/RatingStars";
import { ShopPhotoGallery } from "@/coffee/components/ShopPhotoGallery";
import { ShopCard } from "@/coffee/components/ShopCard";
import { formatPostDate } from "@/coffee/content/format";
import { shopBySlug, SHOPS } from "@shared/coffee/shops";
import {
  BREW_LABELS,
  PRICE_LABELS,
  TAG_LABELS,
  type CoffeeShop,
} from "@shared/coffee/types";

const GlobeMap = lazy(() =>
  import("@/coffee/map/GlobeMap").then((module) => ({ default: module.GlobeMap })),
);

/** Full write-up for one shop, with the surrounding filters preserved in links. */
export default function CoffeeShopDetailPage() {
  const params = useParams<{ slug: string }>();
  const rawSearch = useSearch();
  const search = rawSearch ? `?${rawSearch}` : "";
  const shop = shopBySlug(params.slug);

  if (!shop) {
    return (
      <CoffeeLayout>
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <h1 className="coffee-display text-4xl">No such shop</h1>
          <p className="mt-3 text-muted-foreground">
            Nothing in the atlas has the slug “{params.slug}”.
          </p>
          <Button asChild className="mt-6">
            <Link href="/coffee/grid">Back to the catalogue</Link>
          </Button>
        </div>
      </CoffeeLayout>
    );
  }

  const nearby = SHOPS.filter(
    (entry) => entry.city === shop.city && entry.slug !== shop.slug,
  );

  return (
    <CoffeeLayout>
      <CoffeeHero
        size="md"
        eyebrow={[shop.neighborhood, shop.city, shop.country]
          .filter(Boolean)
          .join(" · ")}
        title={shop.name}
        lead={shop.summary}
        meta={
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <RatingStars rating={shop.rating} size="md" />
            <span className="coffee-eyebrow coffee-band-muted">
              {PRICE_LABELS[shop.priceBand]}
            </span>
            <span className="coffee-eyebrow coffee-band-muted">
              {shop.visits.length === 1
                ? `Visited ${formatPostDate(shop.visits[0])}`
                : `${shop.visits.length} visits · last ${formatPostDate(shop.visits[0])}`}
            </span>
            {shop.recommended && (
              <span className="coffee-eyebrow bg-brand px-2.5 py-1 text-brand-foreground">
                Recommended
              </span>
            )}
            {shop.sample && (
              <span className="coffee-pill coffee-band-muted">Sample entry</span>
            )}
          </div>
        }
      />

      <article className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 sm:py-12">
        <Link
          href={`/coffee/grid${search}`}
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          data-testid="link-coffee-detail-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to the catalogue
        </Link>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <ShopPhotoGallery photos={shop.photos} />

            <div className="mt-8 border-y-2 border-foreground py-5">
              <p className="coffee-eyebrow text-brand">What to order</p>
              <p className="coffee-display mt-2 max-w-[20ch] text-3xl sm:text-4xl">
                {shop.orderThis}
              </p>
            </div>

            {shop.sample && (
              <p className="mt-6 border-l-2 border-border bg-secondary/60 p-4 text-xs leading-relaxed text-muted-foreground">
                This entry is seeded placeholder content. The cafe and its
                location are real, but the notes are a neutral description
                rather than a first-hand review, and the photography is
                openly-licensed stock standing in for real visit photos.
              </p>
            )}

            <div className="prose prose-stone mt-8 max-w-none dark:prose-invert prose-p:leading-relaxed">
              <ReactMarkdown>{shop.review}</ReactMarkdown>
            </div>
          </div>

          <aside className="space-y-8">
            <section>
              <SidebarHeading>On the map</SidebarHeading>
              <ShopLocationInset shop={shop} />
              <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                <Link
                  href={`/coffee/map?shop=${shop.slug}`}
                  data-testid="link-coffee-detail-map"
                >
                  <Globe2 className="h-4 w-4" />
                  Open in the full map
                </Link>
              </Button>
            </section>

            <FactList
              title="Brew methods"
              values={shop.brewMethods.map((brew) => BREW_LABELS[brew])}
            />
            <FactList title="Vibe" values={shop.tags.map((tag) => TAG_LABELS[tag])} />

            {shop.website && (
              <section>
                <SidebarHeading>Links</SidebarHeading>
                <a
                  href={shop.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
                >
                  {new URL(shop.website).hostname}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </section>
            )}
          </aside>
        </div>
      </article>

      {nearby.length > 0 && (
        <section className="border-t border-border bg-secondary/50">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6">
            <h2 className="coffee-display mb-6 text-3xl sm:text-4xl">
              Also in {shop.city}
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {nearby.map((entry) => (
                <ShopCard key={entry.slug} shop={entry} search={search} />
              ))}
            </div>
          </div>
        </section>
      )}
    </CoffeeLayout>
  );
}

/**
 * A single-shop instance of the same map component used by the map view, so the
 * inset cannot drift from the real thing. Selection is disabled — clicking the
 * pin is handled by the "open in the full map" link below it.
 */
function ShopLocationInset({ shop }: { shop: CoffeeShop }) {
  const noop = useCallback(() => {}, []);
  const renderPopup = useCallback(() => null, []);

  return (
    <div className="h-[200px] overflow-hidden border border-border">
      <Suspense
        fallback={<div className="h-full w-full animate-pulse bg-muted" />}
      >
        <GlobeMap
          shops={[shop]}
          selectedSlug={null}
          onSelect={noop}
          renderPopup={renderPopup}
          initialView={{ center: shop.coords, zoom: 12 }}
          interactive={false}
        />
      </Suspense>
    </div>
  );
}

function SidebarHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="coffee-eyebrow mb-3 border-b border-border pb-2 text-muted-foreground">
      {children}
    </h2>
  );
}

function FactList({ title, values }: { title: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <section>
      <SidebarHeading>{title}</SidebarHeading>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span
            key={value}
            className="border border-border px-2 py-1 text-xs text-foreground"
          >
            {value}
          </span>
        ))}
      </div>
    </section>
  );
}
