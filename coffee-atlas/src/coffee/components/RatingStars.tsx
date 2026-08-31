import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Half-star rating display. The half is drawn by clipping a filled star over an
 * empty one rather than using a separate glyph, so it lines up exactly.
 */
export function RatingStars({
  rating,
  size = "sm",
  showValue = true,
  className,
}: {
  rating: number;
  size?: "sm" | "md";
  showValue?: boolean;
  className?: string;
}) {
  const box = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      aria-label={`${rating} out of 5`}
      data-testid="rating-stars"
    >
      <span className="inline-flex">
        {[0, 1, 2, 3, 4].map((index) => {
          const fill = Math.max(0, Math.min(1, rating - index));
          return (
            <span key={index} className={cn("relative", box)}>
              <Star className={cn(box, "absolute inset-0 text-border")} />
              {fill > 0 && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fill * 100}%` }}
                >
                  <Star className={cn(box, "fill-warning text-warning")} />
                </span>
              )}
            </span>
          );
        })}
      </span>
      {showValue && (
        <span
          className={cn(
            "font-medium tabular-nums",
            size === "md" ? "text-sm" : "text-xs",
          )}
        >
          {rating.toFixed(1)}
        </span>
      )}
    </span>
  );
}
