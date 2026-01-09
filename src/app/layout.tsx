import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Facebook Manager - Premium Facebook Profile Toolkit | WeSuccess",
  description:
    "Download Facebook videos, reels, and posts fbntly. Analyze profiles with AI-powered insights. Free, fast, no login required.",
  keywords: [
    "facebook downloader",
    "facebook video download",
    "facebook reels download",
    "facebook profile analytics",
    "fb tools",
  ],
  openGraph: {
    title: "Facebook Manager - Premium Facebook Profile Toolkit",
    description: "Download videos & analyze profiles. No login required.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
