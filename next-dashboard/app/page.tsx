import type { Metadata } from 'next';
import { FrontendDisplay } from '@/components/templates/FrontendDisplay';

export const metadata: Metadata = {
  title: '订阅展示 | 续费管家',
  description: '只读展示由后台管理的订阅方案、账期、续费日期与成员信息。'
};

export default function FrontendPage() {
  return <FrontendDisplay />;
}
