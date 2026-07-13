import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '续费管家',
  description: '订阅、账单与共享成员管理工作台。'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
