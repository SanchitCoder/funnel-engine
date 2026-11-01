import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

const font = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Funnel Engine", template: "%s · Funnel Engine" },
  description: "Webinar funnel command centre: registration to revenue, follow-ups and ad attribution.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f2ed" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0d" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={font.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
