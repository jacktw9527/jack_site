import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QR Code Generator",
  description: "Create and manage dynamic QR code mappings.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
