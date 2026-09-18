import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Рацион+ — расширение рациона",
  description:
    "Персональный помощник по расширению пищевого рациона: дневник питания, предпочтения и ежедневные ИИ-советы.",
  applicationName: "Рацион+",
  // iOS: иконка на домашнем экране и запуск «как приложение»
  appleWebApp: {
    capable: true,
    title: "Рацион+",
    statusBarStyle: "default",
  },
  other: {
    // legacy-имя, которое понимают старые версии iOS Safari
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#10b981",
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
