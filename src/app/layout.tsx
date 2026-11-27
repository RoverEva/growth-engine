import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HatchElite SEO Engine",
  description: "Keyword research, article quality control and publishing for hatchelite.com",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
