import { useState } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Photo } from "@shared/coffee/types";

/**
 * Photo gallery for a shop detail page, with the credit line for each image.
 *
 * Attribution is shown rather than tucked away because the seeded imagery is
 * openly licensed and the licences require it.
 */
export function ShopPhotoGallery({ photos }: { photos: Photo[] }) {
  const [index, setIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-lg border border-dashed border-border bg-muted text-sm text-muted-foreground">
        No photos for this one yet
      </div>
    );
  }

  const photo = photos[Math.min(index, photos.length - 1)];
  const step = (delta: number) =>
    setIndex((current) => (current + delta + photos.length) % photos.length);

  return (
    <figure className="space-y-2" data-testid="gallery-coffee-photos">
      <div className="relative overflow-hidden rounded-lg border border-border bg-muted">
        <img
          src={photo.src}
          alt={photo.alt}
          className="aspect-[16/9] w-full object-cover"
        />

        {photos.length > 1 && (
          <>
            <GalleryButton side="left" onClick={() => step(-1)} />
            <GalleryButton side="right" onClick={() => step(1)} />
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {photos.map((entry, dot) => (
                <button
                  key={entry.src + dot}
                  type="button"
                  onClick={() => setIndex(dot)}
                  aria-label={`Photo ${dot + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    dot === index
                      ? "w-5 bg-background"
                      : "w-1.5 bg-background/60 hover:bg-background/90",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <figcaption className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {photo.isPlaceholder && (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
            <Info className="h-3 w-3" />
            Stand-in photo
          </span>
        )}
        <span>{photo.alt}.</span>
        <span>
          {photo.creditUrl ? (
            <a
              href={photo.creditUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {photo.credit}
            </a>
          ) : (
            photo.credit
          )}
          {` · ${photo.license}`}
        </span>
      </figcaption>
    </figure>
  );
}

function GalleryButton({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={cn(
        "absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow transition hover:bg-background",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
