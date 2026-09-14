import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Рацион+ — расширение рациона",
  description:
    "Персональный помощник по расширению пищевого рациона: дневник питания, предпочтения и ежедневные ИИ-советы.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
