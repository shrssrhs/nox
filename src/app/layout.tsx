import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PrefsInit } from "@/components/PrefsInit";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nox",
  description: "Your space. Your people.",
  manifest: "/manifest.json",
  themeColor: "#09090b",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Nox" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><PrefsInit />{children}</body>
    </html>
  );
}
