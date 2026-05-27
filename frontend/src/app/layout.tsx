import type { Metadata } from "next";
import { SideNav } from "@/components/side-nav";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Literature Agent",
  description: "材料科学文献智能助手",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="h-screen overflow-hidden flex">
        <Providers>
          <SideNav />
          <main className="flex-1 min-w-0 overflow-hidden">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
