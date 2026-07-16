import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteTitle = "VertexERP | Business Control Center";

const siteDescription =
  "Cloud-based billing, inventory, accounting, GST, payments, reports and business management software.";

export const metadata: Metadata = {
  title: {
    default: siteTitle,
    template: "%s | VertexERP",
  },

  description: siteDescription,

  applicationName: "VertexERP",

  authors: [
    {
      name: "Pratham Consultancy and Services",
    },
  ],

  creator: "Pratham Consultancy and Services",
  publisher: "Pratham Consultancy and Services",

  category: "Business Management Software",

  keywords: [
    "VertexERP",
    "ERP software",
    "billing software",
    "inventory management",
    "accounting software",
    "GST billing software",
    "invoice software",
    "business management software",
    "cloud ERP",
    "payment management",
    "business reports",
  ],

  icons: {
    icon: [
      {
        url: "/icon.png",
        type: "image/png",
      },
    ],
    shortcut: "/icon.png",
    apple: "/icon.png",
  },

  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "VertexERP",
    title: siteTitle,
    description: siteDescription,
  },

  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },

  robots: {
    index: true,
    follow: true,
  },

  other: {
    "support-email": "prathamgaur2005@gmail.com",
    "support-phone": "+918737072778",
    "support-whatsapp": "+918737072778",
  },
};

export const viewport: Viewport = {
  themeColor: "#6d28d9",
  colorScheme: "light",
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
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}