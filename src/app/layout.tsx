import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ИИ Сисадмин Академия — Платформа обучения для системных администраторов и DevOps",
  description: "Современная образовательная платформа с ИИ-наставником для системных администраторов, DevOps-инженеров и специалистов по инфраструктуре. Linux, Docker, Kubernetes, Cloud и многое другое. Актуально на июнь 2026.",
  keywords: ["Сисадмин", "DevOps", "Linux", "Docker", "Kubernetes", "Облако", "ИИ Обучение", "Подготовка к собеседованию", "Bash", "Terraform", "Ansible", "Мониторинг", "Безопасность"],
  authors: [{ name: "ИИ Сисадмин Академия" }],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "ИИ Сисадмин Академия",
    description: "AI-powered образовательная платформа для сисадминов и DevOps",
    images: ["/og-image.png"],
    type: "website",
    locale: "ru_RU",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
