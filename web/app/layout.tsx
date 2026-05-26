import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MultiMind — Multi-Agent AI Workspace",
  description:
    "Watch four specialized AI agents simultaneously analyze your problem from different perspectives, then synthesize their insights into one comprehensive answer.",
  keywords: ["AI", "multi-agent", "debate", "analysis", "Gemini"],
  openGraph: {
    title: "MultiMind — Multi-Agent AI Workspace",
    description:
      "Four AI agents. One problem. Real-time collaborative intelligence.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
