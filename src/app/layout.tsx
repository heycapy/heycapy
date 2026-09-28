import type { ReactNode } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Silkscreen } from "next/font/google";
import "./globals.css";
import { APP_NAME, APP_TAGLINE } from "@/constants";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

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
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${silkscreen.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground h-full font-mono">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
