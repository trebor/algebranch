import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";

import { Provider as JotaiProvider } from "jotai";

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
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://algebranch.vercel.app"),
  title: "Algebranch - Interactive Algebraic Steps",
  description: "An interactive step-by-step mathematical exploration and algebraic manipulation system.",
  manifest: "/manifest.json",
  keywords: ["algebra", "math editor", "step by step math", "equation solver", "algebraic identity", "interactive math", "visual math", "study tool", "symbolic manipulation"],
  authors: [{ name: "Algebranch Team" }],
  openGraph: {
    title: "Algebranch - Interactive Algebraic Steps",
    description: "An interactive step-by-step mathematical exploration and algebraic manipulation system.",
    url: "https://algebranch.vercel.app",
    siteName: "Algebranch",
    images: [
      {
        url: "/og-image.png",
        width: 1024,
        height: 1024,
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
    images: ["/og-image.png"],
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
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('error', function(e) {
            var message = e.message;
            var source = '';
            if (e.target && (e.target.src || e.target.href)) {
              message = 'Failed to load resource: ' + (e.target.src || e.target.href);
            } else {
              source = ' <br/><em>' + e.filename + ':' + e.lineno + '</em>';
            }
            var div = document.createElement('div');
            div.style.position = 'fixed';
            div.style.top = '0';
            div.style.left = '0';
            div.style.right = '0';
            div.style.zIndex = '999999';
            div.style.background = '#dc2626';
            div.style.color = 'white';
            div.style.padding = '16px';
            div.style.fontFamily = 'monospace';
            div.style.fontSize = '12px';
            div.style.wordBreak = 'break-all';
            div.style.borderBottom = '4px solid #991b1b';
            div.innerHTML = '<strong>Startup Error:</strong> ' + message + source;
            document.body.appendChild(div);
          }, true);
          window.addEventListener('unhandledrejection', function(e) {
            var div = document.createElement('div');
            div.style.position = 'fixed';
            div.style.top = '0';
            div.style.left = '0';
            div.style.right = '0';
            div.style.zIndex = '999999';
            div.style.background = '#ea580c';
            div.style.color = 'white';
            div.style.padding = '16px';
            div.style.fontFamily = 'monospace';
            div.style.fontSize = '12px';
            div.style.wordBreak = 'break-all';
            div.style.borderBottom = '4px solid #9a3412';
            div.innerHTML = '<strong>Promise Rejection:</strong> ' + e.reason;
            document.body.appendChild(div);
          });
        ` }} />
        <div id="js-status" style={{ position: 'fixed', bottom: '2px', left: '2px', zIndex: 999999, background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.15)', color: '#ef4444', fontFamily: 'monospace', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', pointerEvents: 'none' }}>JS: not started</div>
        <JotaiProvider>
          {children}
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
