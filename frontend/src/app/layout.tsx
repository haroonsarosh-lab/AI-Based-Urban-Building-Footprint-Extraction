import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UrbanFootprint AI — Building Footprint Extraction & Geospatial Mapping",
  description: "AI-Powered Building Footprint Extraction & Geospatial Mapping for Aerial and Satellite Imagery (SIH 2026 Problem P24)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
