// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";

import { Provider as JotaiProvider } from "jotai";
import { ReducedMotionProvider } from "../components/ReducedMotionProvider";
import { APP_NAME, APP_TITLE } from "../constants/brand";
import { softwareApplicationJsonLd } from "../constants/structuredData";
// Note: the bare brand is the base <title> on purpose — the tagline is kept out
// of the browser tab (#449); it lives in the on-page subtitle and social cards.
import { ChromeScaleProvider } from "../components/ChromeScaleProvider";
import { ConsentManager } from "../components/ConsentManager";
import { shouldRenderDebugOverlay, buildDebugOverlayScript } from "../utils/debugOverlay";
import { AppUnavailableNotice } from "../components/AppUnavailableNotice";
import { DocModalHost } from "../components/DocModalHost";
import { ErrorBeacon } from "../components/ErrorBeacon";
import { HydrationSentinel } from "../components/HydrationSentinel";
import { STALL_OVERLAY_ID, shouldRenderStallOverlay } from "../utils/hydrationSentinel";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom is intentionally left enabled (no maximumScale / userScalable
  // restrictions): disabling it fails WCAG 2.1 SC 1.4.4 (Resize Text), and a
  // math app especially needs users to be able to zoom small symbols (#213).
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://algebranch.org"),
  title: APP_NAME,
  description: "An interactive step-by-step mathematical exploration and algebraic manipulation system.",
  manifest: "/manifest.json",
  keywords: ["algebra", "math editor", "step by step math", "equation solver", "algebraic identity", "interactive math", "visual math", "study tool", "symbolic manipulation"],
  authors: [{ name: "Algebranch Team" }],
  openGraph: {
    title: APP_TITLE,
    description: "An interactive step-by-step mathematical exploration and algebraic manipulation system.",
    url: "https://algebranch.org",
    siteName: APP_NAME,
    images: [
      {
        url: "/social-preview.png",
        width: 1280,
        height: 640,
        alt: APP_TITLE,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: APP_TITLE,
    description: "An interactive step-by-step mathematical exploration and algebraic manipulation system.",
    images: ["/social-preview.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
};



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  // The fullscreen error-dump overlay below is a dev/debug aid only; in
  // production it would turn an extension-blocked resource into a scary broken
  // screen (#326), so it is suppressed there unless explicitly opted in.
  const debugOverlay = shouldRenderDebugOverlay(
    process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_DEBUG_OVERLAY,
  );
  // The CSS stall overlay guards a production-only failure (a blocked deployed
  // bundle). In dev, on-demand route compilation makes hydration slow enough to
  // trip its 6s reveal as a false positive, so it is rendered only in production
  // (or behind an explicit opt-in). See shouldRenderStallOverlay.
  const stallOverlay = shouldRenderStallOverlay(
    process.env.NODE_ENV,
    process.env.NEXT_PUBLIC_STALL_OVERLAY,
  );

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* schema.org JSON-LD (#501): machine-readable "what is this" for search
            and AI answer engines. Static string, so it ships in the initial HTML
            where crawlers read it. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
        />
        {/* Stand down the CSS stall overlay on every route once JS hydrates
            (#501): secondary pages have no app-init effect to do it. */}
        <HydrationSentinel />
        {/* First-party error beacon (#505): posts a privacy-scrubbed signature
            of uncaught errors/rejections to /api/errbeacon so launch-day
            breakage is visible in server logs, not just user feedback. */}
        <ErrorBeacon />
        {debugOverlay && (
          <script dangerouslySetInnerHTML={{ __html: buildDebugOverlayScript() }} />
        )}
        <JotaiProvider>
          {/* Reactively respect the OS prefers-reduced-motion setting for every
              framer-motion animation (#145); CSS animations are handled by the
              media query in globals.css. */}
          <ReducedMotionProvider>
            {/* Apply the accessibility text-size knob to the root rem (#239)
                so all rem-based chrome scales without touching the equation
                canvas. */}
            <ChromeScaleProvider>
              {children}
              {/* In-app documentation modal (#514): server-rendered doc bodies
                  fed to a client modal, opened from the Help launcher and synced
                  to the crawlable `/<slug>` URL via the History API. */}
              <DocModalHost />
              <ConsentManager />
            </ChromeScaleProvider>
          </ReducedMotionProvider>
        </JotaiProvider>
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('consent', 'default', {
                  'analytics_storage': 'denied',
                  'ad_storage': 'denied',
                  'ad_user_data': 'denied',
                  'ad_personalization': 'denied'
                });
                gtag('js', new Date());
                gtag('config', '${gaId}', {
                  page_path: window.location.pathname,
                });
              `}
            </Script>
          </>
        )}
        {/* Cookieless aggregate traffic counts (#521). Unlike GA above, this is
            deliberately NOT consent-gated: it sets no cookies and stores no
            personal identifiers, and gating it would blind the baseline to
            everyone who never opts in. No-op outside Vercel deployments. */}
        <Analytics />

        {/* Layer 1 — scripting genuinely disabled (browser setting, or a
            NoScript mode that turns scripting off rather than CSP-blocking it).
            Only renders when the UA reports scripting disabled; its <style>
            hides the spinner and the CSS stall overlay so exactly one message
            shows in that case. */}
        <noscript>
          <style>{`[data-initializing-spinner],#${STALL_OVERLAY_ID}{display:none !important}`}</style>
          <div style={{ position: "fixed", inset: 0, zIndex: 2147483647 }}>
            <AppUnavailableNotice />
          </div>
        </noscript>

        {/* Layer 2 — app JS blocked or hydration stalled (e.g. an extension
            injects a CSP that blocks the bundle, so scripting is "enabled" but
            nothing runs and <noscript> never shows). Revealed by a pure-CSS
            delayed animation (.app-stall-overlay) since no JS — not even an
            inline watchdog — can run; React hides it via markAppHydrated() the
            moment it successfully hydrates, so a healthy load never shows it.
            Production-only: dev's on-demand route compilation trips the 6s reveal
            as a false positive (see shouldRenderStallOverlay). */}
        {stallOverlay && (
          <div id={STALL_OVERLAY_ID} className="app-stall-overlay">
            <AppUnavailableNotice />
          </div>
        )}
      </body>
    </html>
  );
}
