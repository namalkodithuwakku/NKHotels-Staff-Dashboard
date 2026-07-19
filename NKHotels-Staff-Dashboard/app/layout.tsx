import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import ThemeProvider from "./providers/ThemeProvider";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "NK Hotel OS",
  description: "N K Hotels Work Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={manrope.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}