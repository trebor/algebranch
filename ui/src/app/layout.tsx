// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";

import { Provider as JotaiProvider } from "jotai";
import { ReducedMotionProvider } from "../components/ReducedMotionProvider";
import { ChromeScaleProvider } from "../components/ChromeScaleProvider";
import { ConsentManager } from "../components/ConsentManager";

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
  title: "Algebranch - Interactive Algebraic Steps",
  description: "An interactive step-by-step mathematical exploration and algebraic manipulation system.",
  manifest: "/manifest.json",
  keywords: ["algebra", "math editor", "step by step math", "equation solver", "algebraic identity", "interactive math", "visual math", "study tool", "symbolic manipulation"],
  authors: [{ name: "Algebranch Team" }],
  openGraph: {
    title: "Algebranch - Interactive Algebraic Steps",
    description: "An interactive step-by-step mathematical exploration and algebraic manipulation system.",
    url: "https://algebranch.org",
    siteName: "Algebranch",
    images: [
      {
        url: "/social-preview.png",
        width: 1280,
        height: 640,
        alt: "Algebranch - Interactive Algebraic Steps",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Algebranch - Interactive Algebraic Steps",
    description: "An interactive step-by-step mathematical exploration and algebraic manipulation system.",
    images: ["/social-preview.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Algebranch",
  },
};



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(event) {
                var container = document.getElementById('mobile-debug-container');
                if (!container) {
                  container = document.createElement('div');
                  container.id = 'mobile-debug-container';
                  container.style.position = 'fixed';
                  container.style.top = '0';
                  container.style.left = '0';
                  container.style.right = '0';
                  container.style.bottom = '0';
                  container.style.zIndex = '999999';
                  container.style.backgroundColor = 'rgba(0,0,0,0.95)';
                  container.style.color = '#ff6b6b';
                  container.style.padding = '20px';
                  container.style.fontFamily = 'monospace';
                  container.style.overflow = 'auto';
                  container.style.fontSize = '12px';
                  container.style.whiteSpace = 'pre-wrap';
                  document.body.appendChild(container);
                }
                var errDiv = document.createElement('div');
                errDiv.style.borderBottom = '1px solid #333';
                errDiv.style.paddingBottom = '10px';
                errDiv.style.marginBottom = '10px';
                
                if (event.target && event.target.tagName) {
                  if (event.target.tagName === 'SCRIPT' || event.target.tagName === 'LINK') {
                    var url = event.target.src || event.target.href;
                    errDiv.innerText = 'RESOURCE FAILED TO LOAD: ' + url + '\\nTag: ' + event.target.tagName;
                    container.appendChild(errDiv);
                  }
                  return;
                }
                
                errDiv.innerText = 'ERROR: ' + event.message + '\\nSource: ' + event.filename + ':' + event.lineno + ':' + event.colno + '\\nStack: ' + (event.error ? event.error.stack : 'N/A');
                container.appendChild(errDiv);
              }, true);

              window.addEventListener('unhandledrejection', function(event) {
                var container = document.getElementById('mobile-debug-container');
                if (!container) {
                  container = document.createElement('div');
                  container.id = 'mobile-debug-container';
                  container.style.position = 'fixed';
                  container.style.top = '0';
                  container.style.left = '0';
                  container.style.right = '0';
                  container.style.bottom = '0';
                  container.style.zIndex = '999999';
                  container.style.backgroundColor = 'rgba(0,0,0,0.95)';
                  container.style.color = '#ff6b6b';
                  container.style.padding = '20px';
                  container.style.fontFamily = 'monospace';
                  container.style.overflow = 'auto';
                  container.style.fontSize = '12px';
                  container.style.whiteSpace = 'pre-wrap';
                  document.body.appendChild(container);
                }
                var errDiv = document.createElement('div');
                errDiv.style.borderBottom = '1px solid #333';
                errDiv.style.paddingBottom = '10px';
                errDiv.style.marginBottom = '10px';
                errDiv.innerText = 'UNHANDLED REJECTION: ' + event.reason + '\\nStack: ' + (event.reason && event.reason.stack ? event.reason.stack : 'N/A');
                container.appendChild(errDiv);
              });
            `
          }}
        />
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
      </body>
    </html>
  );
}
