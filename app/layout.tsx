import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { SiteBackground } from "@/components/site-background";
import { SiteClouds } from "@/components/cloud-background";
import { SiteMotion } from "@/components/site-motion";
import { ThemeSync } from "@/components/theme-sync";
import { WelcomeTheme } from "@/components/welcome-theme";
import { getBranding } from "@/lib/branding";
import { getSettings } from "@/lib/settings";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
  variable: "--font-sora",
});

// Pages read live database data; keeping the shell dynamic stops builds from querying the database for /_not-found.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [branding, settings] = await Promise.all([getBranding(), getSettings()]);
  const description = branding.metaDescription.replace(/\{ip\}/g, settings.ip);

  return {
    title: {
      default: branding.siteTitle,
      template: `%s · ${branding.name}`,
    },
    description,
    applicationName: branding.name,
    icons: { icon: "/images/dmc-logo.png", apple: "/images/dmc-logo.png" },
    openGraph: {
      title: branding.siteTitle,
      description,
      siteName: branding.name,
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#060d1f",
  width: "device-width",
  initialScale: 1,
};

const themeBoot = `(function(){try{var key="demonmc-theme";var stored=null;try{stored=localStorage.getItem(key);}catch(e){}var systemDark=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;var pref=stored==="light"||stored==="dark"||stored==="rainy"?stored:(stored==="system"?(systemDark?"dark":"light"):"light");if(stored==="system"){try{localStorage.setItem(key,pref);}catch(e){}}var dark=pref==="dark"||pref==="rainy";var root=document.documentElement;root.classList.add("motion-js");root.setAttribute("data-theme",dark?"dark":"light");root.setAttribute("data-theme-pref",pref);root.setAttribute("data-weather",pref==="rainy"?"rainy":"clear");var syncMeta=function(){var meta=document.querySelector('meta[name="theme-color"]');if(meta){meta.setAttribute("content",dark?"#060d1f":"#e7ece9");}};syncMeta();document.addEventListener("DOMContentLoaded",syncMeta,{once:true});var valid=function(p){return p==="light"||p==="dark"||p==="rainy";};var apply=function(p){var d=p==="dark"||p==="rainy";dark=d;root.setAttribute("data-theme",d?"dark":"light");root.setAttribute("data-theme-pref",p);root.setAttribute("data-weather",p==="rainy"?"rainy":"clear");syncMeta();};var consistent=function(){var p=root.getAttribute("data-theme-pref");if(!valid(p))return false;var d=p==="dark"||p==="rainy";return root.getAttribute("data-theme")===(d?"dark":"light")&&root.getAttribute("data-weather")===(p==="rainy"?"rainy":"clear");};try{new MutationObserver(function(){if(consistent())return;var saved=null;try{saved=localStorage.getItem(key);}catch(e){}apply(valid(saved)?saved:"light");}).observe(root,{attributes:true,attributeFilter:["data-theme","data-theme-pref","data-weather"]});}catch(e){}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = await getBranding();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${sora.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        <link rel="preload" as="image" href="/images/sky-islands.webp" />
      </head>
      <body className="relative isolate">
        <SiteBackground />
        <SiteClouds />
        <SiteMotion />
        <ThemeSync />
        {children}
        <WelcomeTheme brandName={branding.name} />
      </body>
    </html>
  );
}
