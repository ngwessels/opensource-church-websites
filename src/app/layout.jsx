import {
  Cormorant_Garamond,
  Geist,
  Geist_Mono,
  Libre_Baskerville,
  Merriweather,
  Montserrat,
  Oswald,
  Playfair_Display,
  Poppins,
  Source_Sans_3,
  Tenor_Sans,
  Work_Sans,
} from "next/font/google";

import { AnalyticsProvider } from "@/components/providers/AnalyticsProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { TooltipProvider } from "@/components/providers/TooltipProvider";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-theme-display",
  weight: ["400", "600", "700"],
});

const merriweather = Merriweather({
  subsets: ["latin"],
  variable: "--font-theme-serif",
  weight: ["400", "700"],
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-theme-sans",
  weight: ["400", "600", "700"],
});

const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  variable: "--font-theme-classic",
  weight: ["400", "700"],
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-theme-modern",
  weight: ["400", "600", "700"],
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-theme-elegant",
  weight: ["400", "600", "700"],
});

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-theme-condensed",
  weight: ["400", "500", "600", "700"],
});

const tenorSans = Tenor_Sans({
  subsets: ["latin"],
  variable: "--font-theme-tenor",
  weight: ["400"],
});

const workSans = Work_Sans({
  subsets: ["latin"],
  variable: "--font-theme-work",
  weight: ["400", "500", "600", "700"],
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-theme-poppins",
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "Open Source Church Websites",
  description: "An open-source church website builder with Firebase and Stripe donations.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={[
        geistSans.variable,
        geistMono.variable,
        playfair.variable,
        merriweather.variable,
        sourceSans.variable,
        libreBaskerville.variable,
        montserrat.variable,
        cormorant.variable,
        oswald.variable,
        tenorSans.variable,
        workSans.variable,
        poppins.variable,
        "h-full antialiased",
      ].join(" ")}
    >
      <body className="flex min-h-full flex-col font-sans">
        <AuthProvider>
          <TooltipProvider>
            <AnalyticsProvider>{children}</AnalyticsProvider>
          </TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
