"use client";

import { useState } from "react";
import { CoinIcon, CrownIcon, DiscordIcon, KeyIcon, SparklesIcon } from "@/components/icons";
import { Modal } from "@/components/staff/ui";
import {
  formatStorePrice,
  STORE_CATEGORIES,
  STORE_CATEGORY_LABELS,
  storeProductTitle,
  type PublicStoreRank,
  type StoreCategory,
  type StorePromotion,
} from "@/lib/store-types";
import { StoreCard, storeAccentStyle } from "./store-card";

const CATEGORY_ICONS = {
  rank: CrownIcon,
  key: KeyIcon,
  coin: CoinIcon,
} as const;

const CATEGORY_BLURB: Record<StoreCategory, string> = {
  rank: "Permanent rank upgrades, styled to match the server.",
  key: "Crate keys with their own colours. Pick the crate you want to open next.",
  coin: "Gold coin packs for the in-game shop, upgrades and seasonal offers.",
};

function BuyDialog({
  item,
  discord,
  brandName,
  promotion,
  onClose,
}: {
  item: PublicStoreRank;
  discord: string;
  brandName: string;
  promotion: StorePromotion;
  onClose: () => void;
}) {
  const title = storeProductTitle(item);
  const heading = item.free ? `GET ${title.toUpperCase()} FOR FREE` : `BUY ${title.toUpperCase()}`;
  const hasSale = item.discountPercent > 0 && item.finalPriceCents < item.priceCents;

  return (
    <Modal
      title={heading}
      description={`Purchases are completed by hand by ${brandName} staff through Discord.`}
      onClose={onClose}
    >
      <div
        data-store-dialog
        data-checkout-price={item.finalPriceCents}
        data-checkout-original={item.priceCents}
        data-checkout-discount={item.discountPercent}
        className="rounded-2xl border border-aqua-200/80 bg-aqua-50/60 p-4"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xs font-extrabold text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)]"
              style={storeAccentStyle(item)}
              aria-hidden="true"
            >
              {item.name.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-navy-400">
                Selected item
              </p>
              <p className="truncate font-display text-sm font-bold uppercase tracking-wide text-navy-900">
                {title}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            {hasSale && (
              <p className="font-mono text-[11px] leading-none text-navy-400 line-through">
                {formatStorePrice(item.priceCents)}
              </p>
            )}
            <p className="font-display text-xl font-extrabold leading-none text-navy-900">
              {item.free ? "FREE" : formatStorePrice(item.finalPriceCents)}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-navy-400">
              {item.free
                ? "Free rank"
                : hasSale
                  ? `${item.discountPercent}% off`
                  : "One-time"}
            </p>
          </div>
        </div>
      </div>

      {hasSale && (
        <p className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-red-200/70 bg-red-50/60 px-3 py-2 text-[11px] text-red-800">
          <SparklesIcon width={13} height={13} />
          <strong className="font-semibold">{promotion.title}</strong>
          <span>
            — {item.discountPercent}% off this item. The original price stays saved at{" "}
            {formatStorePrice(item.priceCents)}.
          </span>
        </p>
      )}

      {item.free ? (
        <p className="mt-4 text-sm leading-relaxed text-navy-600">
          Join the official {brandName} Discord and ask the staff about receiving your free{" "}
          <strong className="font-semibold text-navy-900">{title}</strong>.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm leading-relaxed text-navy-600">
            You selected the <strong className="font-semibold text-navy-900">{title}</strong> for{" "}
            <strong className="font-semibold text-navy-900">
              {formatStorePrice(item.finalPriceCents)}
            </strong>
            {hasSale ? " during the active sale." : "."}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-navy-600">
            To purchase, join our official {brandName} Discord and contact the server staff. The
            price above is the exact price staff will confirm with you.
          </p>
        </>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
        <a
          href={discord}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex-1 !rounded-xl !py-3 text-xs"
        >
          <DiscordIcon width={16} height={16} />
          {item.free ? "JOIN DISCORD" : "CONTINUE TO DISCORD"}
        </a>
        <button type="button" onClick={onClose} className="btn-ghost flex-1 !rounded-xl !py-3 text-xs">
          CANCEL
        </button>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-navy-400">
        No payment is collected on this website and nothing is delivered automatically. {brandName}{" "}
        staff confirm payment and deliver every key, coin pack and rank inside Discord.
      </p>
    </Modal>
  );
}

export function StoreGrid({
  items,
  promotion,
  discord,
  brandName,
}: {
  items: PublicStoreRank[];
  promotion: StorePromotion;
  discord: string;
  brandName: string;
}) {
  const present = STORE_CATEGORIES.filter((category) =>
    items.some((item) => item.category === category),
  );
  const [selected, setSelected] = useState<PublicStoreRank | null>(null);
  const [tab, setTab] = useState<StoreCategory>(present[0] ?? "rank");

  const activeTab = present.includes(tab) ? tab : (present[0] ?? "rank");
  const visible = items.filter((item) => item.category === activeTab);
  const discounted = items.filter((item) => item.discountPercent > 0);
  const showPromotion = promotion.enabled && promotion.active && discounted.length > 0;

  const promoTheme =
    promotion.theme === "christmas"
      ? "border-emerald-200/80 bg-[linear-gradient(105deg,rgba(220,38,38,0.08),rgb(var(--white)/0.65)_45%,rgba(16,185,129,0.10))]"
      : promotion.theme === "summer"
        ? "border-amber-200/80 bg-[linear-gradient(105deg,rgba(251,191,36,0.16),rgb(var(--white)/0.7)_55%,rgba(249,115,22,0.10))]"
        : "border-ember/25 bg-[linear-gradient(105deg,rgba(244,132,45,0.10),rgb(var(--white)/0.65))]";

  return (
    <>
      {showPromotion && (
        <div
          className={`panel mb-5 flex flex-col gap-3 overflow-hidden border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${promoTheme}`}
          data-store-promotion
          data-promotion-percent={promotion.discountPercent}
          data-promotion-theme={promotion.theme}
        >
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-600 text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)]">
              <SparklesIcon width={17} height={17} />
            </span>
            <div>
              <p className="font-display text-sm font-extrabold uppercase tracking-[0.06em] text-navy-900">
                {promotion.title}
              </p>
              {promotion.description && (
                <p className="mt-0.5 text-[11px] leading-relaxed text-navy-500">
                  {promotion.description}
                </p>
              )}
            </div>
          </div>
          <span className="badge shrink-0 self-start border-red-200 bg-white/80 px-2.5 py-1 font-display text-sm font-extrabold text-red-700 sm:self-center">
            {promotion.discountPercent}% OFF
          </span>
        </div>
      )}

      <div
        className="mb-6 flex flex-wrap gap-1.5 rounded-xl border border-aqua-200/70 bg-white/50 p-1.5"
        role="tablist"
        aria-label="Store categories"
        data-store-tabs
      >
        {present.map((category) => {
          const Icon = CATEGORY_ICONS[category];
          const count = items.filter((item) => item.category === category).length;
          const isActive = category === activeTab;
          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(category)}
              data-store-tab={category}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${
                isActive
                  ? "store-tab-active shadow-sm"
                  : "text-navy-500 hover:bg-aqua-50 hover:text-navy-800"
              }`}
            >
              <Icon width={14} height={14} />
              {STORE_CATEGORY_LABELS[category]}
              <span className={`font-mono text-[10px] ${isActive ? "store-tab-count" : "text-navy-400"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-sm font-extrabold uppercase tracking-[0.1em] text-navy-900">
            {STORE_CATEGORY_LABELS[activeTab]}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-navy-500">
            {CATEGORY_BLURB[activeTab]}
          </p>
        </div>
      </div>

      <div
        className="mx-auto grid max-w-5xl items-stretch gap-4 sm:gap-5 md:grid-cols-2"
        data-reveal-group
        data-store-panel={activeTab}
      >
        {visible.map((item) => (
          <div
            key={item.id}
            className={
              item.design === "featured" && item.category === "rank" ? "md:col-span-2" : ""
            }
          >
            <StoreCard item={item} brandName={brandName} onBuy={setSelected} />
          </div>
        ))}
      </div>

      {selected && (
        <BuyDialog
          item={selected}
          discord={discord}
          brandName={brandName}
          promotion={promotion}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
