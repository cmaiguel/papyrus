import type { Metadata, Viewport } from "next";
import { Inter, DM_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1A202C",
};

export const metadata: Metadata = {
  title: "Papyrus by Corello",
  description: "AI Manufacturing Intelligence Platform — upload travelers, SOPs, and drawings for instant AI analysis.",
  applicationName: "Papyrus",
  authors: [{ name: "Corello" }],
  keywords: ["manufacturing", "AI", "traveler", "SOP", "quality"],
  robots: "noindex, nofollow",   // keep prototype private from search engines
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body
        className={`${inter.variable} ${dmMono.variable} h-full antialiased bg-[#1A202C] text-slate-100 overflow-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
