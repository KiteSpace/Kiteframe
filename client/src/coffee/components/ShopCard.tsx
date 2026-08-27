import { Link } from "wouter";
import { MapPin, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
        "group flex flex-col overflow-hidden rounded-lg border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg",
        highlighted
          ? "border-brand ring-2 ring-brand/30"
          : "border-border hover:border-brand/40",
      )}
      data-testid={`card-coffee-shop-${shop.slug}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {photo ? (
          <img
            src={photo.src}
            alt={photo.alt}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No photo yet
          </div>
        )}

        {shop.recommended && (
          <Badge className="absolute left-2 top-2 gap-1 bg-brand text-brand-foreground shadow">
            <Sparkles className="h-3 w-3" />
            Recommended
          </Badge>
        )}
        <span className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium tabular-nums">
          {PRICE_LABELS[shop.priceBand]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight tracking-tight group-hover:text-brand-strong">
            {shop.name}
          </h3>
          <RatingStars rating={shop.rating} showValue={false} />
        </div>

        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          {shop.neighborhood ? `${shop.neighborhood}, ` : ""}
          {shop.city}, {shop.country}
        </p>

        <p className="line-clamp-3 text-sm text-muted-foreground">
          {shop.summary}
        </p>

        <p className="mt-auto border-t border-border-soft pt-2 text-xs">
          <span className="font-medium text-brand-strong">Order: </span>
          <span className="text-muted-foreground">{shop.orderThis}</span>
        </p>

        <div className="flex flex-wrap gap-1">
          {shop.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="font-normal">
              {TAG_LABELS[tag]}
            </Badge>
          ))}
          {shop.sample && (
            <Badge
              variant="outline"
              className="font-normal text-muted-foreground"
              title="Seeded placeholder content, not a first-hand review"
            >
              sample
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
