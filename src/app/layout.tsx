import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/lib/providers";
import { SWRegister } from "@/components/shared/sw-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pradeep Medical Store - Online Pharmacy in Mathura",
  description:
    "Order medicines online in Mathura with fast delivery. Upload prescription, request medicines, track orders and get them delivered to your doorstep.",
  keywords: [
    "online pharmacy",
    "medicine delivery Mathura",
    "Pradeep Medical Store",
    "prescription upload",
    "buy medicines online",
  ],
  authors: [{ name: "Pradeep Medical Store" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "icon", url: "/favicon.ico", sizes: "32x32" },
      { rel: "shortcut icon", url: "/favicon.ico" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PMS Pharmacy",
  },
  openGraph: {
    title: "Pradeep Medical Store - Online Pharmacy in Mathura",
    description: "Order medicines online in Mathura with fast delivery.",
    images: [{ url: "/og-image.png", width: 1254, height: 1254 }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png"],
  },
};

export const viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} antialiased bg-background text-foreground min-h-screen`}
        suppressHydrationWarning
      >
        <Providers>
          {children}
          <SonnerToaster position="top-center" richColors />
          <SWRegister />
        </Providers>
      </body>
    </html>
  );
}
