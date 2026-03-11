import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Investor Listings",
  description: "AI-powered real estate deal analysis",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: "#f8fafc", color: "#1e293b" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
