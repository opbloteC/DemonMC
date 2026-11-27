import type { CSSProperties } from "react";
import {
  ArrowRightIcon,
  CoinIcon,
  CrownIcon,
  DiscordIcon,
  KeyIcon,
  SparklesIcon,
  StoreIcon,
} from "@/components/icons";
import {
  formatStorePrice,
  STORE_CATEGORY_SINGULAR,
  STORE_DESIGN_LABELS,
  type PublicStoreRank,
} from "@/lib/store-types";

const RAINBOW =
  "linear-gradient(90deg, #ff0044 0%, #ff7a00 18%, #ffe600 36%, #2bff88 54%, #00e5ff 72%, #6a5cff 88%, #ff2bd6 100%)";

/** Background fill for the card's product colour accent. */
export function storeAccentStyle(item: PublicStoreRank): CSSProperties {
  if (item.design === "rainbow") return { backgroundImage: RAINBOW };
  if (item.style === "gradient") {
    return {
      backgroundImage: `linear-gradient(135deg, ${item.gradientFrom} 0%, ${item.gradientTo} 100%)`,
    };
  }
  return { backgroundColor: item.color };
}

/** Gradient text for the card name when the design calls for it. */
export function storeNameStyle(item: PublicStoreRank): CSSProperties {
  if (item.design === "rainbow") {
    return {
      backgroundImage: RAINBOW,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
    };
  }
  if (item.style === "gradient") {
    return {
      backgroundImage: `linear-gradient(135deg, ${item.gradientFrom} 0%, ${item.gradientTo} 100%)`,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
    };
  }
  // Keys and coins carry their own named colour on the product title.
  if (item.category !== "rank") return { color: item.color };
  return {};
}

function ProductGlyph({ item, size = 20 }: { item: PublicStoreRank; size?: number }) {
  if (item.category === "key") return <KeyIcon width={size} height={size} />;
  if (item.category === "coin") return <CoinIcon width={size} height={size} />;
  if (item.design === "featured") return <CrownIcon width={size} height={size} />;
  if (item.design === "rainbow") return <SparklesIcon width={size} height={size} />;
  return <StoreIcon width={size} height={size} />;
}

function categoryBadge(item: PublicStoreRank): string {
  if (item.category === "key") return "Key";
  if (item.category === "coin") return "Coins";
  return STORE_DESIGN_LABELS[item.design];
}

export function StoreCard({
  item,
  compact = false,
  brandName = "community",
  onBuy,
}: {
  item: PublicStoreRank;
  compact?: boolean;
  brandName?: string;
  onBuy?: (item: PublicStoreRank) => void;
}) {
  const featured = item.design === "featured" && item.category === "rank";
  const accent = storeAccentStyle(item);
  const hasSale = item.discountPercent > 0 && item.finalPriceCents < item.priceCents;
  const price = formatStorePrice(item.finalPriceCents);

  return (
    <article
      className={`store-card panel group relative flex h-full flex-col overflow-hidden ${
        featured ? "store-card--featured" : ""
      }`}
      data-store-card
      data-store-rank={item.name}
      data-store-category={item.category}
      data-store-original={item.priceCents}
      data-store-price={item.finalPriceCents}
      data-store-discount={item.discountPercent}
      data-design={item.design}
    >
      <span className="absolute inset-x-0 top-0 h-1.5" style={accent} aria-hidden="true" />
      <span
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-20 blur-3xl transition-opacity duration-300 group-hover:opacity-35"
        style={{ backgroundColor: item.color }}
        aria-hidden="true"
      />

      <div className={`relative flex flex-1 flex-col ${compact ? "p-4" : "p-5 sm:p-6"}`}>
        <div className="flex items-start justify-between gap-3">
          <span
            className="store-card-icon grid h-11 w-11 place-items-center rounded-xl text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.18)]"
            style={accent}
          >
            <ProductGlyph item={item} />
          </span>
          <span className="flex flex-col items-end gap-1">
            <span className="badge border-aqua-200 bg-white/70 text-navy-500">
              {categoryBadge(item)}
            </span>
            {hasSale && (
              <span
                className="badge border-red-200 bg-red-50 font-semibold text-red-700"
                data-sale-badge
              >
                {item.discountPercent}% OFF
              </span>
            )}
          </span>
        </div>

        <div className="mt-5 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-navy-400">
              {item.category === "rank"
                ? STORE_CATEGORY_SINGULAR[item.category]
                : brandName}
            </p>
            <h3
              className={`font-display font-extrabold uppercase leading-none tracking-tight ${
                compact ? "text-xl" : "text-2xl sm:text-[26px]"
              } ${
                item.category === "rank" &&
                item.style === "solid" &&
                item.design !== "rainbow"
                  ? "text-navy-900"
                  : ""
              }`}
              style={storeNameStyle(item)}
            >
              {item.name}
            </h3>
          </div>
          <div className="shrink-0 text-right">
            {item.free ? (
              <>
                <span className="block font-display text-2xl font-extrabold leading-none text-sun-deep">
                  FREE
                </span>
                <span className="badge mt-1.5 border-ember/30 bg-ember/10 text-ember-dark">
                  FREE RANK
                </span>
              </>
            ) : (
              <>
                {hasSale && (
                  <span
                    className="block font-mono text-[11px] leading-none text-navy-400 line-through"
                    data-original-price
                  >
                    {formatStorePrice(item.priceCents)}
                  </span>
                )}
                <span
                  className={`block font-display text-2xl font-extrabold leading-none text-navy-900 ${
                    hasSale ? "mt-1" : ""
                  }`}
                  data-final-price
                >
                  {price}
                </span>
                <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-navy-400">
                  {hasSale ? "sale price" : "one-time"}
                </span>
              </>
            )}
          </div>
        </div>

        <p
          className={`mt-4 text-sm leading-relaxed text-navy-500 ${
            compact ? "line-clamp-3" : ""
          }`}
        >
          {item.description}
        </p>

        {item.free && (
          <p className="mt-3 rounded-xl border border-ember/20 bg-ember/[0.06] px-3 py-2 text-[11px] leading-relaxed text-navy-600">
            Join the {brandName} Discord and ask our staff for your free rank — it is set up by hand.
          </p>
        )}

        <div className="mt-auto pt-5">
          <div className="flex items-center justify-between gap-3 border-t border-aqua-100 pt-4">
            <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-navy-400">
              {item.design === "rainbow" ? (
                <span
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                  style={{ backgroundImage: RAINBOW }}
                  aria-hidden="true"
                />
              ) : (
                <span
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
              )}
              {item.style === "gradient" || item.design === "rainbow"
                ? "Gradient"
                : item.category === "rank"
                  ? item.color
                  : "Solid"}
            </span>
            <button
              type="button"
              onClick={onBuy ? () => onBuy(item) : undefined}
              aria-label={`${item.buttonLabel} — ${item.name}`}
              className={`${
                item.free ? "btn-ghost" : "btn-primary"
              } !rounded-full !px-4 !py-2.5 text-[11px] font-bold uppercase tracking-[0.08em]`}
            >
              {item.free ? <DiscordIcon width={15} height={15} /> : null}
              {item.buttonLabel}
              {item.free ? null : <ArrowRightIcon width={14} height={14} />}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
