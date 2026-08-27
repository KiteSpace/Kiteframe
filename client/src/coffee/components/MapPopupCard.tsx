import { Link } from "wouter";
import { ArrowRight, Sparkles } from "lucide-react";
import { PRICE_LABELS, type CoffeeShop } from "@shared/coffee/types";
import { RatingStars } from "./RatingStars";

/** Compact shop summary shown inside the map popup. */
export function MapPopupCard({
  shop,
  search,
}: {
  shop: CoffeeShop;
  search: string;
}) {
  const photo = shop.photos[0];

  return (
    <div className="w-[260px]" data-testid={`popup-coffee-shop-${shop.slug}`}>
      {photo && (
        <div className="relative h-28 overflow-hidden bg-muted">
          <img
            src={photo.src}
            alt={photo.alt}
            className="h-full w-full object-cover"
          />
          {shop.recommended && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-brand-foreground">
              <Sparkles className="h-2.5 w-2.5" />
              Recommended
            </span>
          )}
        </div>
      )}

      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight">{shop.name}</h3>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {PRICE_LABELS[shop.priceBand]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <RatingStars rating={shop.rating} />
          <span className="truncate text-xs text-muted-foreground">
            {shop.neighborhood ? `${shop.neighborhood}, ` : ""}
            {shop.city}
          </span>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {shop.summary}
        </p>

        <p className="rounded-md bg-brand-soft px-2 py-1.5 text-xs text-brand-strong">
          <span className="font-semibold">Order: </span>
          {shop.orderThis}
        </p>

        <Link
          href={`/coffee/shops/${shop.slug}${search}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-strong hover:underline"
          data-testid={`link-coffee-popup-detail-${shop.slug}`}
        >
          Read the full write-up
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
