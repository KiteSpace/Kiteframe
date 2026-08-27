import { lazy, Suspense, useCallback } from "react";
import { Link, useParams, useSearch } from "wouter";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  Globe2,
  Info,
  MapPin,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CoffeeLayout } from "@/coffee/components/CoffeeLayout";
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
          <h1 className="text-2xl font-semibold">No such shop</h1>
          <p className="mt-2 text-muted-foreground">
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
      <article className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href={`/coffee/grid${search}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          data-testid="link-coffee-detail-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to the catalogue
        </Link>

        <header className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {shop.recommended && (
              <Badge className="gap-1 bg-brand text-brand-foreground">
                <Sparkles className="h-3 w-3" />
                Recommended
              </Badge>
            )}
            <Badge variant="secondary">{PRICE_LABELS[shop.priceBand]}</Badge>
            {shop.sample && (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Info className="h-3 w-3" />
                Sample entry
              </Badge>
            )}
          </div>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {shop.name}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {shop.neighborhood ? `${shop.neighborhood}, ` : ""}
              {shop.city}, {shop.region}, {shop.country}
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {shop.visits.length === 1
                ? `Visited ${formatPostDate(shop.visits[0])}`
                : `${shop.visits.length} visits, last ${formatPostDate(shop.visits[0])}`}
            </span>
            <RatingStars rating={shop.rating} size="md" />
          </div>
        </header>

        <ShopPhotoGallery photos={shop.photos} />

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <div className="rounded-lg border border-brand/30 bg-brand-soft p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-strong">
                What to order
              </p>
              <p className="mt-1 text-lg font-medium text-foreground">
                {shop.orderThis}
              </p>
            </div>

            {shop.sample && (
              <p className="mt-4 rounded-md border border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
                This entry is seeded placeholder content. The cafe and its
                location are real, but the notes are a neutral description
                rather than a first-hand review, and the photography is
                openly-licensed stock standing in for real visit photos.
              </p>
            )}

            <div className="prose prose-stone mt-6 max-w-none dark:prose-invert prose-headings:tracking-tight prose-p:leading-relaxed">
              <ReactMarkdown>{shop.review}</ReactMarkdown>
            </div>
          </div>

          <aside className="space-y-6">
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                On the map
              </h2>
              <ShopLocationInset shop={shop} />
              <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                <Link
                  href={`/coffee/map?shop=${shop.slug}`}
                  data-testid="link-coffee-detail-map"
                >
                  <Globe2 className="h-4 w-4" />
                  Open in the full map
                </Link>
              </Button>
            </section>

            <FactList title="Brew methods" values={shop.brewMethods.map((brew) => BREW_LABELS[brew])} />
            <FactList title="Vibe" values={shop.tags.map((tag) => TAG_LABELS[tag])} />

            {shop.website && (
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Links
                </h2>
                <a
                  href={shop.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-brand-strong hover:underline"
                >
                  {new URL(shop.website).hostname}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </section>
            )}
          </aside>
        </div>

        {nearby.length > 0 && (
          <>
            <Separator className="my-10" />
            <section>
              <h2 className="mb-4 text-lg font-semibold tracking-tight">
                Also in {shop.city}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {nearby.map((entry) => (
                  <ShopCard key={entry.slug} shop={entry} search={search} />
                ))}
              </div>
            </section>
          </>
        )}
      </article>
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
    <div className="h-[200px] overflow-hidden rounded-lg border border-border">
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

function FactList({ title, values }: { title: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <Badge key={value} variant="secondary" className="font-normal">
            {value}
          </Badge>
        ))}
      </div>
    </section>
  );
}

