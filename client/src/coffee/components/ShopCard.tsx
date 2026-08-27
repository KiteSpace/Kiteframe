import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRICE_LABELS,
  TAG_LABELS,
  type CoffeeShop,
} from "@shared/coffee/types";
import { RatingStars } from "./RatingStars";

/**
 * Catalogue tile. Links through to the detail page carrying the current filter
 * query string, so the browser back button returns to the same filtered view.
 */
export function ShopCard({
  shop,
  search,
  highlighted = false,
}: {
  shop: CoffeeShop;
  search: string;
  highlighted?: boolean;
}) {
  const photo = shop.photos[0];

  return (
    <Link
      href={`/coffee/shops/${shop.slug}${search}`}
      className={cn(
        "group flex flex-col overflow-hidden border bg-card transition-colors",
        highlighted
          ? "border-brand ring-1 ring-brand"
          : "border-border hover:border-foreground",
      )}
      data-testid={`card-coffee-shop-${shop.slug}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {photo ? (
          <img
            src={photo.src}
            alt={photo.alt}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No photo yet
          </div>
        )}

        {shop.recommended && (
          <span className="coffee-eyebrow absolute left-0 top-3 bg-brand px-2.5 py-1 text-brand-foreground">
            Recommended
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="coffee-display break-words text-2xl transition-colors group-hover:text-brand">
            {shop.name}
          </h3>
          <p className="coffee-eyebrow mt-1.5 text-muted-foreground">
            {shop.city} · {shop.country}
          </p>
        </div>

        <div className="flex items-center gap-2 border-y border-border-soft py-2">
          <RatingStars rating={shop.rating} />
          <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
            {PRICE_LABELS[shop.priceBand]}
          </span>
        </div>

        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {shop.summary}
        </p>

        <p className="text-sm leading-snug">
          <span className="coffee-eyebrow text-brand">Order </span>
          <span className="text-foreground">{shop.orderThis}</span>
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {shop.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {TAG_LABELS[tag]}
            </span>
          ))}
          {shop.sample && (
            <span
              className="border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground"
              title="Seeded placeholder content, not a first-hand review"
            >
              sample
            </span>
          )}
          <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground transition-colors group-hover:text-brand" />
        </div>
      </div>
    </Link>
  );
}
