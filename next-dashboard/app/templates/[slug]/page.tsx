import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TemplateDashboard } from '@/components/templates/TemplateDashboard';
import { getTemplateBySlug, templates } from '@/lib/templates';

type TemplatePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return templates.map((template) => ({ slug: template.slug }));
}

export async function generateMetadata({ params }: TemplatePageProps): Promise<Metadata> {
  const { slug } = await params;
  const template = getTemplateBySlug(slug);

  if (!template) {
    return { title: '模板未找到 | 续费管家' };
  }

  return {
    title: `${template.name} | 续费管家模板`,
    description: template.description
  };
}

export default async function TemplatePage({ params }: TemplatePageProps) {
  const { slug } = await params;
  const template = getTemplateBySlug(slug);

  if (!template) notFound();

  return <TemplateDashboard template={template} />;
}
