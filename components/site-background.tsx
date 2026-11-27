import { LivingSky } from "@/components/living-sky";

export function SiteBackground() {
  return (
    <div className="site-background" aria-hidden="true">
      <img
        src="/images/sky-islands.webp"
        alt=""
        decoding="async"
        fetchPriority="high"
        data-parallax
        className="site-background-art site-background-light"
      />
      <img
        src="/images/sky-islands-night.webp"
        alt=""
        decoding="async"
        loading="lazy"
        fetchPriority="low"
        data-parallax
        className="site-background-art site-background-night"
      />
      <LivingSky />
      <div className="site-background-veil site-background-veil-light" />
      <div className="site-background-veil site-background-veil-night" />
      <div className="site-background-glow site-background-glow-light" />
      <div className="site-background-glow site-background-glow-night" />
    </div>
  );
}
