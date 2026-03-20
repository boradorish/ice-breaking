import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ice Break Game",
  description: "팀 아이스브레이킹 게임",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-900 text-slate-100">{children}</body>
    </html>
  );
}
