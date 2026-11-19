import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});
const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Aurelia | The Property Collection",
  description: "A new perspective on considered city living. Discover Aurelia residences.",
  openGraph: {
    title: "Aurelia | Live above the skyline",
    description: "Discover considered residences, private amenities, and a new perspective on city living.",
    siteName: "Aurelia residences",
    type: "website",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: "Aurelia | Live above the skyline", description: "A new perspective on considered city living." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
