import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cleanup - Photo Cleaner",
  description: "Clean up your device and optimize storage in seconds. Find and remove duplicate, blurry, and unwanted photos.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cleanup",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-black text-white overflow-hidden">
        {children}
      </body>
    </html>
  );
}
