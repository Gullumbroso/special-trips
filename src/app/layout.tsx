import type { Metadata } from "next";
import { Inter, Besley } from "next/font/google";
import "./globals.css";
import { PreferencesProvider } from "@/lib/context/PreferencesContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const besley = Besley({
  variable: "--font-besley",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "SpecialTrips - Find Your Perfect Event-Driven Trip",
  description: "Discover curated trip bundles built around concerts, sports, art, and cultural events you'll love.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${besley.variable} antialiased`}
      >
        <PreferencesProvider>
          {children}
        </PreferencesProvider>
      </body>
    </html>
  );
}
