import type { Metadata } from "next";
import { DiscordIcon, StoreIcon } from "@/components/icons";
import { StoreGrid } from "@/components/store/store-grid";
import { getBranding } from "@/lib/branding";
import { getContent } from "@/lib/content";
import { getSettings } from "@/lib/settings";
import { getStorePromotion, listPublicStoreProducts } from "@/lib/store";
import { getStoreBrandName } from "@/lib/store-branding";
import { applyStorePromotion, splitStoreBrandName } from "@/lib/store-types";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: "Store",
    description: `Choose your ${branding.name} rank. Unlock your status and join the community. Payments are handled manually by staff through Discord.`,
  };
}

export const dynamic = "force-dynamic";

const DISCORD_FALLBACK = "https://discord.gg/mFYwCJBTuA";

export default async function StorePage() {
  const [products, settings, brandName, copy, promotion] = await Promise.all([
    listPublicStoreProducts(),
    getSettings(),
    getStoreBrandName(),
    getContent(),
    getStorePromotion(),
  ]);
  const items = applyStorePromotion(products, promotion);
  const discord = settings.discord || DISCORD_FALLBACK;
  const brand = splitStoreBrandName(brandName);
  const theme = promotion.theme;

  return (
    <div
      className={theme === "normal" ? "store-theme" : `store-theme store-theme--${theme}`}
      data-store-theme={theme}
    >
      <section className="hero-shell border-b border-aqua-200/60">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-glow" aria-hidden="true" />
        <div className="container-x relative py-14 sm:py-16" data-reveal>
          <p className="eyebrow flex items-center gap-3">
            <span className="h-px w-8 bg-sun/80" />
            {copy["store.eyebrow"]}
          </p>
          <h1 className="headline mt-3 break-words text-4xl sm:text-5xl">
            {brand.leading && <>{brand.leading} </>}
            <span className="text-sun-deep">{brand.accent}</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-navy-500 sm:text-base">
            {copy["store.description"]}
          </p>
        </div>
      </section>

      <section className="container-x pb-16 pt-10 sm:pt-12">
        {items.length === 0 ? (
          <div className="panel mx-auto flex max-w-2xl flex-col items-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-aqua-100 bg-aqua-50 text-ember">
              <StoreIcon width={20} height={20} />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-navy-900">
              The store is being updated
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-navy-500">
              Our staff is preparing the next set of ranks. Join the Discord to ask what is available
              right now.
            </p>
            <a
              href={discord}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary mt-5 !rounded-full text-xs"
            >
              <DiscordIcon width={16} height={16} />
              JOIN DISCORD
            </a>
          </div>
        ) : (
          <StoreGrid
            items={items}
            promotion={promotion}
            discord={discord}
            brandName={copy["brand.name"]}
          />
        )}
      </section>

      <section className="container-x pb-24">
        <div className="panel relative overflow-hidden border-ember/25 bg-gradient-to-br from-white/95 via-aqua-50/90 to-ember/[0.07]" data-reveal>
          <div className="block-motif pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />
          <div
            className="absolute -left-20 -top-24 h-56 w-56 rounded-full bg-ember/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative flex flex-col items-center gap-5 px-6 py-10 text-center sm:px-10">
            <p className="font-display text-xl font-extrabold uppercase leading-tight tracking-[0.06em] text-navy-900 sm:text-2xl">
              {copy["store.closing.title"]}
            </p>
            <p className="max-w-xl whitespace-pre-line text-sm leading-relaxed text-navy-500">
              {copy["store.closing.description"]}
            </p>
            <a
              href={discord}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary !rounded-full !px-7 !py-3.5 text-sm"
            >
              <DiscordIcon width={18} height={18} />
              {copy["store.closing.cta"]}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
