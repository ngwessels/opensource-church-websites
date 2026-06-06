import { Geist, Geist_Mono } from "next/font/google";

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

export const metadata = {
  title: "Open Source Church Websites",
  description: "An open-source church website builder with Firebase and Stripe donations.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
