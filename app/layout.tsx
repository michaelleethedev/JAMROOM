import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JamRoom | Social Listening Demo",
  description: "A polished portfolio demo for a collaborative music listening room."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
