/**
 * Seed script — adds projects from the company profile PDF that are
 * not yet in the database.
 *
 * Run on the server:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seedProjects.ts
 *
 * Images are set to a placeholder (/logo.svg) — replace them via the
 * dashboard after running this script.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLACEHOLDER = '/logo.svg';

const projects = [
    // ── LMS / E-learning ─────────────────────────────────────────────────────
    {
        title: 'أكاديمية القوى العاملة',
        titleEn: 'Manpower Training Academy',
        description: 'منصة تدريب إلكترونية لوزارة القوى العاملة في مصر، تقدم الدورات التدريبية المهنية عبر الإنترنت على الويب وأندرويد و iOS.',
        descriptionEn: 'Electronic training platform for the Ministry of Manpower in Egypt. Delivers vocational training courses online — web, Android, and iOS.',
        types: ['lms'],
        important: true,
        img: PLACEHOLDER,
        links: [],
    },
    {
        title: 'أكاديمية دار الإفتاء',
        titleEn: 'Dar Al Iftaa Training Academy',
        description: 'منصة تدريب إلكترونية لدار الإفتاء المصرية لتأهيل المفتين عبر الإنترنت، متاحة على أندرويد و iOS.',
        descriptionEn: 'Training academy for the Egyptian Dar Al Iftaa to qualify muftis online. Delivered on Android and iOS.',
        types: ['lms'],
        important: true,
        img: PLACEHOLDER,
        links: [],
    },
    {
        title: 'منصة Step2English',
        titleEn: 'Step2English Academy',
        description: 'أكاديمية تعليم اللغة الإنجليزية عبر الإنترنت (IELTS وTOEFL وSTEP) للكبار والمراهقين والأطفال.',
        descriptionEn: 'E-learning academy for English teaching — IELTS, TOEFL, and STEP — for adults, teens, and kids.',
        types: ['lms'],
        important: false,
        img: PLACEHOLDER,
        links: [],
    },
    {
        title: 'أكاديمية نجاح',
        titleEn: 'Nagaah Academy',
        description: 'أكاديمية تعليمية إلكترونية للأطفال والشباب العرب، تقدم دورات للكبار والمراهقين والأطفال.',
        descriptionEn: 'E-learning academy for Arab kids and youth, offering courses for adults, teens, and children.',
        types: ['lms'],
        important: false,
        img: PLACEHOLDER,
        links: [],
    },
    {
        title: 'أكاديمية PM-Lounge',
        titleEn: 'PM-Lounge Academy',
        description: 'أكاديمية إلكترونية متخصصة في دورات إدارة المشاريع والتحضير لاختبار PMP.',
        descriptionEn: 'E-learning academy for Project Management courses and PMP exam preparation.',
        types: ['lms'],
        important: false,
        img: PLACEHOLDER,
        links: [],
    },

    // ── eCommerce ─────────────────────────────────────────────────────────────
    {
        title: 'الدوراشو',
        titleEn: 'Eldorasho',
        description: 'تطبيق تجارة إلكترونية متعدد البائعين على الويب وأندرويد و iOS لعميل في الخليج — مشتري، مورد، شركة شحن، وراكب.',
        descriptionEn: 'Multi-vendor eCommerce app on web, Android, and iOS for a Gulf client — buyer, supplier, shipping company, and rider.',
        types: ['ecommerce'],
        important: false,
        img: PLACEHOLDER,
        links: [],
    },
    {
        title: 'قطع الغيار',
        titleEn: 'Spare Parts',
        description: 'تطبيق تجارة إلكترونية متعدد البائعين لقطع الغيار على أندرويد و iOS لعميل في الخليج.',
        descriptionEn: 'Multi-vendor eCommerce app for spare parts on Android and iOS for a Gulf client.',
        types: ['ecommerce'],
        important: false,
        img: PLACEHOLDER,
        links: [],
    },
    {
        title: 'سباق الإبل',
        titleEn: 'Camel Race',
        description: 'تطبيق تجارة إلكترونية متعدد البائعين لسباقات الإبل على أندرويد و iOS — مشتري، موردو أدوية وغذاء وملحقات، مدرب إبل، شركة شحن.',
        descriptionEn: 'Multi-vendor eCommerce app for camel racing on Android and iOS — buyer, medicine/food/accessories suppliers, trainer, shipping.',
        types: ['ecommerce'],
        important: false,
        img: PLACEHOLDER,
        links: [],
    },
    {
        title: 'بلاي بابا',
        titleEn: 'Play Papa',
        description: 'تطبيق تجارة إلكترونية متعدد البائعين على أندرويد و iOS لعميل في الخليج.',
        descriptionEn: 'Multi-vendor eCommerce app on Android and iOS for a Gulf client.',
        types: ['ecommerce'],
        important: false,
        img: PLACEHOLDER,
        links: [],
    },
    {
        title: 'بازار',
        titleEn: 'Bazar',
        description: 'تطبيق تجارة إلكترونية متعدد البائعين على أندرويد و iOS لعميل في الخليج.',
        descriptionEn: 'Multi-vendor eCommerce app on Android and iOS for a Gulf client.',
        types: ['ecommerce'],
        important: false,
        img: PLACEHOLDER,
        links: [],
    },

    // ── Games / Special ───────────────────────────────────────────────────────
    {
        title: 'قصص الأطفال 360°',
        titleEn: 'Children Stories 360°',
        description: 'قصص أطفال ثلاثية الأبعاد وبالواقع الافتراضي 360° على أندرويد و iOS، مقدمة لوزارة الاتصالات لذوي الإعاقة السمعية.',
        descriptionEn: '360° children stories in 3D and virtual reality for Android and iOS, delivered to the Ministry of Communications for people with hearing disabilities.',
        types: ['lms'],
        important: false,
        img: PLACEHOLDER,
        links: [],
    },
    {
        title: 'سبيدو',
        titleEn: 'Speedo',
        description: 'لعبة سباق سيارات ثلاثية الأبعاد للأجهزة الذكية والواقع الافتراضي، مقدمة لوزارة الاتصالات لذوي الإعاقة السمعية.',
        descriptionEn: '3D car racing game on Android, iOS, and VR on PC, delivered to the Ministry of Communications for people with hearing disabilities.',
        types: ['lms'],
        important: false,
        img: PLACEHOLDER,
        links: [],
    },
    {
        title: 'العابي',
        titleEn: 'Al3aby',
        description: 'منصة ألعاب إلكترونية للمكفوفين وضعاف البصر، مقدمة لوزارة الاتصالات. تضم لعبة الدومينو كأول لعبة متاحة للمكفوفين.',
        descriptionEn: 'Electronic gaming platform for blind and visually impaired people, delivered to the Ministry of Communications. Features Dominos as the first blind-accessible platform game.',
        types: ['lms'],
        important: false,
        img: PLACEHOLDER,
        links: [],
    },
];

async function main() {
    console.log(`\nSeeding ${projects.length} projects…\n`);

    let added = 0;
    let skipped = 0;

    for (const p of projects) {
        // Check by English title to avoid duplicates
        const existing = await prisma.project.findFirst({
            where: { titleEn: p.titleEn },
        });

        if (existing) {
            console.log(`⏭  Skip (exists): ${p.titleEn}`);
            skipped++;
        } else {
            await prisma.project.create({ data: p });
            console.log(`✅ Added: ${p.titleEn}`);
            added++;
        }
    }

    console.log(`\nDone — ${added} added, ${skipped} skipped.\n`);
    console.log('📝 Remember to add real screenshots via the dashboard:');
    console.log('   https://nitg-eg.com/ar/dashboard/projects\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
