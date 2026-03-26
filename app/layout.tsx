import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "System Health Dashboard",
  description: "Internal marketing and sales operations dashboard.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
