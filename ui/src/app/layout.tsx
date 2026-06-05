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
