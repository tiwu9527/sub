export const templateSlugs = ['cards', 'ledger', 'receipt', 'pass'] as const;
export const frontendTemplateStorageKey = 'subscription-dashboard-frontend-template';

export type TemplateSlug = (typeof templateSlugs)[number];

export type TemplateAccent = {
  name: string;
  primary: string;
  secondary: string;
  surface: string;
  ink: string;
  gradient: string;
};

export type TemplateDefinition = {
  slug: TemplateSlug;
  name: string;
  description: string;
  eyebrow: string;
  accent: TemplateAccent;
};

export const templates: readonly TemplateDefinition[] = [
  {
    slug: 'cards',
    name: '卡片陈列',
    eyebrow: 'Card gallery',
    description: '用清爽的响应式卡片逐项展示订阅方案、价格、状态与下次扣费日期。',
    accent: {
      name: '湖水青',
      primary: '#0F8A7C',
      secondary: '#8DDED2',
      surface: '#EFFAF7',
      ink: '#153D37',
      gradient: 'linear-gradient(135deg, #153D37 0%, #0F766E 56%, #20A895 100%)'
    }
  },
  {
    slug: 'ledger',
    name: '明细清单',
    eyebrow: 'Detail ledger',
    description: '以规整的蓝灰清单呈现完整订阅字段，适合快速浏览和横向比较。',
    accent: {
      name: '雾霾蓝',
      primary: '#526D82',
      secondary: '#A9BDCC',
      surface: '#F1F5F7',
      ink: '#263947',
      gradient: 'linear-gradient(135deg, #263947 0%, #526D82 58%, #7893A6 100%)'
    }
  },
  {
    slug: 'receipt',
    name: '账单票据',
    eyebrow: 'Billing receipts',
    description: '把每项订阅塑造成温暖的纸质票据，突出金额、周期与扣费凭据感。',
    accent: {
      name: '焦糖橙',
      primary: '#C66A2B',
      secondary: '#E9B982',
      surface: '#FFF7E9',
      ink: '#4B3020',
      gradient: 'linear-gradient(135deg, #4B3020 0%, #A95526 55%, #DD8745 100%)'
    }
  },
  {
    slug: 'pass',
    name: '会员通行证',
    eyebrow: 'Membership passes',
    description: '用具有收藏感的会员通行证展示服务权益、有效期和共享成员信息。',
    accent: {
      name: '暮光紫',
      primary: '#7457C8',
      secondary: '#C1B2EE',
      surface: '#F6F2FF',
      ink: '#312653',
      gradient: 'linear-gradient(135deg, #312653 0%, #654AB2 55%, #9074DC 100%)'
    }
  }
];

export function isTemplateSlug(value: string): value is TemplateSlug {
  return templateSlugs.some((slug) => slug === value);
}

export function getTemplateBySlug(slug: string) {
  return templates.find((template) => template.slug === slug);
}
