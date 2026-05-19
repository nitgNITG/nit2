import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const TYPES = [
  { value: 'lms',       labelEn: 'LMS / Moodle Platform',        labelAr: 'منصة تعليمية (Moodle)' },
  { value: 'ecommerce', labelEn: 'eCommerce App',                labelAr: 'تطبيق تجارة إلكترونية' },
  { value: 'blind',     labelEn: 'Blind Accessibility',          labelAr: 'إمكانية وصول المكفوفين' },
  { value: 'deaf',      labelEn: 'Deaf Accessibility',           labelAr: 'إمكانية وصول الصم' },
  { value: 'games',     labelEn: 'Educational Games',            labelAr: 'ألعاب تعليمية' },
  { value: '3d',        labelEn: '3D Work',                      labelAr: 'أعمال ثلاثية الأبعاد' },
];

async function main() {
  for (const t of TYPES) {
    const existing = await prisma.projectType.findUnique({ where: { value: t.value } });
    if (existing) {
      console.log(`  ⏭  "${t.value}" already exists`);
      continue;
    }
    await prisma.projectType.create({ data: t });
    console.log(`  ✅ Created: ${t.value} — ${t.labelEn} / ${t.labelAr}`);
  }
  console.log('\nDone seeding project types.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
