import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Literature Agent", description: "材料科学文献智能助手" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
        {children}
      </body>
    </html>
  );
}
