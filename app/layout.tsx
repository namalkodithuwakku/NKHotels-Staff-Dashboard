import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import ThemeProvider from "./providers/ThemeProvider";
import PwaManager from "./components/pwa/PwaManager";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "NKH Dashboard",
  description: "N K Hotels staff operations dashboard",
  applicationName: "NKH Dashboard",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NKH Dashboard",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/api/pwa-icon?size=192",
    apple: "/api/pwa-icon?size=180",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#20252b" },
    { media: "(prefers-color-scheme: dark)", color: "#20252b" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={manrope.className}>
        <ThemeProvider>{children}<PwaManager /></ThemeProvider>
      </body>
    </html>
  );
}
