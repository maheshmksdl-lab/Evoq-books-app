import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers/providers";
import { themeInitScript } from "@/providers/theme-provider";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "EVOQ Books", template: "%s · EVOQ Books" },
  description: "EVOQ Books — accounting and financial management (frontend demonstration with sample data).",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="aubergine" suppressHydrationWarning className={`${inter.variable} h-full`}>
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body className="h-full font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
