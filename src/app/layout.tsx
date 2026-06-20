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
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Apply saved appearance prefs before hydration — no flash, lives in the
            always-fresh HTML document so it works even if the PrefsInit chunk is stale. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var fs=localStorage.getItem('nox_font_size');if(fs){fs=JSON.parse(fs);var m={sm:'11px',lg:'16px'};if(m[fs])d.style.setProperty('--nox-font-size',m[fs]);}if(localStorage.getItem('nox_compact_mode')==='true'){d.style.setProperty('--nox-gap','0.375rem');d.style.setProperty('--nox-padding','0.75rem 1.5rem');}}catch(e){}})();`,
          }}
        />
        <PrefsInit />
        {children}
      </body>
    </html>
  );
}
