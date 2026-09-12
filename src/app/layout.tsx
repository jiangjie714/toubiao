import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "标讯通 - 招投标信息服务平台", template: "%s - 标讯通" },
  description: "招投标公告聚合检索平台：招标公告、中标公告、变更更正、询价竞谈",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
