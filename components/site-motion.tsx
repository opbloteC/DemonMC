"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export function SiteMotion() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.querySelector(".page-transition") ?? document;
    const targets = root.querySelectorAll<HTMLElement>("[data-reveal], [data-reveal-group]");

    targets.forEach((target) => {
      if (!target.hasAttribute("data-reveal-group")) return;
      Array.from(target.children).forEach((child, index) => {
        if (child instanceof HTMLElement) {
          child.style.setProperty("--reveal-index", String(Math.min(index, 6)));
        }
      });
    });

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      targets.forEach((target) => target.classList.add("is-revealed"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.08 },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const layers = document.querySelectorAll<HTMLElement>("[data-parallax]");
    let frame = 0;

    const update = () => {
      frame = 0;
      const offset = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1.6) * 14;
      layers.forEach((layer) => layer.style.setProperty("--parallax-y", `${offset.toFixed(2)}px`));
    };

    const requestUpdate = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };

    const syncMotionPreference = () => {
      if (motionQuery.matches) {
        window.removeEventListener("scroll", requestUpdate);
        if (frame !== 0) window.cancelAnimationFrame(frame);
        frame = 0;
        layers.forEach((layer) => layer.style.setProperty("--parallax-y", "0px"));
        return;
      }
      update();
      window.addEventListener("scroll", requestUpdate, { passive: true });
    };

    syncMotionPreference();
    motionQuery.addEventListener("change", syncMotionPreference);
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      motionQuery.removeEventListener("change", syncMotionPreference);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="page-transition" key={pathname}>
      {children}
    </div>
  );
}
