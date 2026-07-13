import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '订阅展示 | 续费管家',
  description: '只读展示订阅方案、账期、续费日期与共享成员等演示信息。'
};

export default function DisplayLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
