import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '后台管理 | 续费管家',
  description: '管理订阅、工作区配置与前端展示模板。'
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
