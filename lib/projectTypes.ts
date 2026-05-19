export const PROJECT_TYPES = [
  { value: 'lms',       label: 'LMS / Moodle Platform',        labelAr: 'منصة تعليمية (Moodle)' },
  { value: 'ecommerce', label: 'eCommerce App',                labelAr: 'تطبيق تجارة إلكترونية' },
  { value: 'blind',     label: 'Blind Accessibility',          labelAr: 'إمكانية وصول المكفوفين' },
  { value: 'deaf',      label: 'Deaf Accessibility',           labelAr: 'إمكانية وصول الصم' },
  { value: 'games',     label: 'Educational Games',            labelAr: 'ألعاب تعليمية' },
  { value: '3d',        label: '3D Work',                      labelAr: 'أعمال ثلاثية الأبعاد' },
] as const;

export type ProjectType = typeof PROJECT_TYPES[number]['value'];
