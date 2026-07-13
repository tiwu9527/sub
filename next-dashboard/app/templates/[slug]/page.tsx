import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TemplateDashboard } from '@/components/templates/TemplateDashboard';
import { getTemplateBySlug, templates } from '@/lib/templates';

type TemplatePageProps = {
  params: {
    slug: string;
  };
};

export function generateStaticParams() {
  return templates.map((template) => ({ slug: template.slug }));
}

export function generateMetadata({ params }: TemplatePageProps): Metadata {
  const template = getTemplateBySlug(params.slug);

  if (!template) {
    return { title: '模板未找到 | 续费管家' };
  }

  return {
    title: `${template.name} | 续费管家模板`,
    description: template.description
  };
}

export default function TemplatePage({ params }: TemplatePageProps) {
  const template = getTemplateBySlug(params.slug);

  if (!template) notFound();

  return <TemplateDashboard template={template} />;
}
