import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jev vs Gemini 判斷比較",
  description: "比較 TypeSafe Jev 與 Gemini 官方 API 在情緒強度、地區、雜訊判斷上的表現與成本",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}
