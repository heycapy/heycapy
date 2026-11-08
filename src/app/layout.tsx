import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Silkscreen } from "next/font/google";
import "./globals.css";
import { APP_NAME, APP_TAGLINE } from "@/constants";
import { DEFAULT_APPEARANCE } from "@/lib/account/constants";
import { getSession } from "@/lib/auth/session";
import { appearanceFor } from "@/lib/account/look";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { LookProvider } from "@/components/looks/LookProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const silkscreen = Silkscreen({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-pixel",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return {
    metadataBase: new URL(`${proto}://${host}`),
    title: APP_NAME,
    description: APP_TAGLINE,
    openGraph: { title: "heycapy", description: APP_TAGLINE, siteName: "heycapy", type: "website" },
    twitter: { card: "summary_large_image" },
    // search engines should find the website (heycapy.xyz), not a login screen
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const appearance = session ? await appearanceFor(session.userId) : DEFAULT_APPEARANCE;

  return (
    <html
      lang="en"
      data-look={appearance.look}
      data-size={appearance.controlSize}
      data-text={appearance.textSize}
      data-motion={appearance.reduceMotion ? "reduce" : undefined}
      className={`${geistSans.variable} ${geistMono.variable} ${silkscreen.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground font-ui h-full pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
        <LookProvider {...appearance}>
          <ThemeProvider>{children}</ThemeProvider>
        </LookProvider>
      </body>
    </html>
  );
}
