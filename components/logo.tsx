import type { CSSProperties } from "react";
import { DEFAULT_BRAND_NAME, splitBrandName } from "@/lib/branding-config";

export const NAVBAR_LOGO_SRC = "/api/brand/logo";
export const HERO_LOGO_SRC = "/api/brand/hero-logo";
export const DEFAULT_LOGO_SRC = "/images/dmc-logo.png";

const DEFAULT_NAME = DEFAULT_BRAND_NAME.toLowerCase();

function logoAt(base: string, width: number, format?: "webp"): string {
  return `${base}?w=${width}${format ? `&fmt=${format}` : ""}`;
}

function logoSrcSet(
  base: string,
  widths: number[],
  format?: "webp",
  descriptor: "x" | "w" = "x",
): string {
  return widths
    .map((width, index) =>
      `${logoAt(base, width, format)} ${descriptor === "w" ? `${width}w` : `${index + 1}x`}`,
    )
    .join(", ");
}

export function LogoMark({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <picture className="contents">
        <source
          type="image/webp"
          srcSet={`${logoAt(NAVBAR_LOGO_SRC, size * 3, "webp")} 1x, ${logoAt(NAVBAR_LOGO_SRC, size * 6, "webp")} 2x`}
        />
        <img
          src={logoAt(NAVBAR_LOGO_SRC, size * 3)}
          srcSet={`${logoAt(NAVBAR_LOGO_SRC, size * 3)} 1x, ${logoAt(NAVBAR_LOGO_SRC, size * 6)} 2x`}
          alt=""
          width={size}
          height={size}
          decoding="async"
          className="h-full w-full object-contain"
          style={{ imageRendering: size >= 48 ? "pixelated" : "auto" }}
        />
      </picture>
    </span>
  );
}

function isDefaultBrand(name: string | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === DEFAULT_NAME;
}

export function Wordmark({
  name = DEFAULT_BRAND_NAME,
  className = "",
  style,
}: {
  name?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const parts = splitBrandName(name || DEFAULT_BRAND_NAME);
  return (
    <span
      className={`font-display font-extrabold uppercase leading-none tracking-[0.06em] text-navy-900 ${className}`}
      style={style}
    >
      {parts.leading && `${parts.leading} `}
      <span className="text-sun-deep">{parts.accent}</span>
    </span>
  );
}

export function LogoWordmark({
  height = 34,
  name = DEFAULT_BRAND_NAME,
  className = "",
}: {
  height?: number;
  name?: string;
  className?: string;
}) {
  if (!isDefaultBrand(name)) {
    return (
      <span className={`inline-flex max-w-[240px] items-center gap-2.5 ${className}`}>
        <LogoMark size={height} />
        <Wordmark name={name} style={{ fontSize: Math.max(14, Math.round(height * 0.46)) }} />
      </span>
    );
  }

  const width = Math.round((height * 715) / 179);
  const widths = [width, width * 2];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <picture className="contents">
      <source type="image/webp" srcSet={logoSrcSet(NAVBAR_LOGO_SRC, widths, "webp")} />
      <img
        src={logoAt(NAVBAR_LOGO_SRC, width * 2)}
        srcSet={logoSrcSet(NAVBAR_LOGO_SRC, widths)}
        alt={name}
        height={height}
        width={width}
        decoding="async"
        className={`w-auto max-w-[220px] shrink-0 object-contain ${className}`}
        style={{ height, width: "auto", imageRendering: height >= 80 ? "pixelated" : "auto" }}
      />
    </picture>
  );
}

export function BrandLogo({
  name,
  variant = "navbar",
  className = "",
  widths,
  sizes,
}: {
  name?: string;
  variant?: "navbar" | "hero";
  className?: string;
  widths?: number[];
  sizes?: string;
}) {
  if (isDefaultBrand(name)) {
    const base = variant === "hero" ? HERO_LOGO_SRC : NAVBAR_LOGO_SRC;
    const resolvedWidths =
      widths ?? (variant === "hero" ? [390, 780, 1170] : [190, 380, 570]);
    const descriptor = sizes ? "w" : "x";
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <picture className="contents">
        <source
          type="image/webp"
          srcSet={logoSrcSet(base, resolvedWidths, "webp", descriptor)}
          sizes={sizes}
        />
        <img
          src={logoAt(base, resolvedWidths[1])}
          srcSet={logoSrcSet(base, resolvedWidths, undefined, descriptor)}
          sizes={sizes}
          alt={name ?? DEFAULT_BRAND_NAME}
          decoding="async"
          fetchPriority={variant === "hero" ? "high" : "auto"}
          className={className}
          width={variant === "hero" ? 390 : 190}
          height={variant === "hero" ? 98 : 60}
        />
      </picture>
    );
  }

  if (variant === "hero") {
    return (
      <span className={`inline-flex max-w-full flex-wrap items-center justify-center gap-3 sm:gap-4 ${className}`}>
        <LogoMark size={64} />
        <Wordmark name={name} className="text-4xl sm:text-5xl" />
      </span>
    );
  }

  return (
    <span className={`inline-flex max-w-[220px] items-center gap-2 ${className}`}>
      <LogoMark size={34} />
      <Wordmark name={name} className="text-lg" />
    </span>
  );
}
