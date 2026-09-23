import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "./globals.css";

const display = Inter_Tight({ subsets: ["latin"], weight: ["300", "400", "600"], variable: "--font-display" });
const text = Inter({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-text" });

export const metadata: Metadata = {
  title: "Xiang Zhao — Portfolio 2026",
  description:
    "Medical Engineering master’s student building AI agents, autonomous driving tools, and embodied robotics products.",
};

export const viewport: Viewport = {
  themeColor: "#1d1d1d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} is-loading`}>
      <body>{children}</body>
    </html>
  );
}
