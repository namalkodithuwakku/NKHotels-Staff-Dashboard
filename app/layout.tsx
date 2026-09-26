import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeProvider from "./providers/ThemeProvider";
import PwaManager from "./components/pwa/PwaManager";


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
      <body>
        <ThemeProvider>{children}<PwaManager /></ThemeProvider>
      </body>
    </html>
  );
}
