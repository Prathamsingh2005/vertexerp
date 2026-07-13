import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: {
    default: "VertexERP | Run your business with confidence",
    template: "%s | VertexERP",
  },
  description:
    "VertexERP is a cloud business management platform for billing, inventory, accounting, GST, payments, reports and audit controls.",
  applicationName: "VertexERP",
  keywords: [
    "ERP",
    "billing software",
    "inventory management",
    "accounting software",
    "GST billing",
    "business management",
  ],
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
      <body className="min-h-full">{children}</body>
    </html>
  );
}