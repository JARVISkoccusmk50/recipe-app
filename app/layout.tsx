import type { Metadata } from "next";
import "./globals.css";

// アプリ全体のレイアウト設定
export const metadata: Metadata = {
  title: "マイレシピ帳",
  description: "URLからレシピを取り込んで自分版として保存するアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
