import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Caddy",
  description: "Glasses-style AI golf caddy prototype",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
