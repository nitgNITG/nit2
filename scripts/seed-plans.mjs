// Seed the Moodle Academy service plans (packages) — one per local_license tier.
// Run: node scripts/seed-plans.mjs
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const plans = [
    {
        service: 'moodle', tier: 'demo', order: 0, price: 0, currency: 'USD',
        nameEn: 'Demo', nameAr: 'تجريبي',
        featuresEn: ['1 course', '4 videos', '2 quizzes', '14-day trial'],
        featuresAr: ['كورس واحد', '4 فيديوهات', 'اختباران', 'تجربة 14 يوم'],
    },
    {
        service: 'moodle', tier: 'basic', order: 1, price: 50, currency: 'USD',
        nameEn: 'Basic', nameAr: 'أساسي',
        featuresEn: ['3 courses', 'YouTube videos (unlimited)', 'Unlimited quizzes', '1 teacher', '1 year'],
        featuresAr: ['3 كورسات', 'فيديوهات يوتيوب (غير محدودة)', 'اختبارات غير محدودة', 'مدرّس واحد', 'سنة كاملة'],
    },
    {
        service: 'moodle', tier: 'standard', order: 2, price: 150, currency: 'USD',
        nameEn: 'Standard', nameAr: 'قياسي',
        featuresEn: ['10 courses', 'Vimeo videos', 'Unlimited teachers', '10 PDF files', '1 year'],
        featuresAr: ['10 كورسات', 'فيديوهات Vimeo', 'مدرّسون غير محدودين', '10 ملفات PDF', 'سنة كاملة'],
    },
    {
        service: 'moodle', tier: 'professional', order: 3, price: 400, currency: 'USD',
        nameEn: 'Professional', nameAr: 'احترافي',
        featuresEn: ['Everything in Standard', 'DRM video (VdoCipher)', 'Coupons & offers', 'Subscriptions & packages', 'Live sessions (Jitsi)', '1 year'],
        featuresAr: ['كل مميزات القياسي', 'فيديو محمي DRM', 'كوبونات وعروض', 'اشتراكات وباقات', 'جلسات مباشرة', 'سنة كاملة'],
    },
]

for (const p of plans) {
    const existing = await prisma.servicePlan.findFirst({ where: { service: p.service, tier: p.tier } })
    if (existing) {
        await prisma.servicePlan.update({ where: { id: existing.id }, data: { ...p, isActive: true } })
        console.log(`updated ${p.tier} (${p.nameEn})`)
    } else {
        await prisma.servicePlan.create({ data: { ...p, isActive: true } })
        console.log(`created ${p.tier} (${p.nameEn})`)
    }
}
const count = await prisma.servicePlan.count({ where: { service: 'moodle' } })
console.log(`\nmoodle plans in DB: ${count}`)
await prisma.$disconnect()
