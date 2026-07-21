import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Armenian AI — Armenian-first voice intelligence",
    template: "%s · Armenian AI",
  },
  description: "Armenian-first voice assistant for natural speech-to-speech conversations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hy">
      <body>{children}</body>
    </html>
  );
}
