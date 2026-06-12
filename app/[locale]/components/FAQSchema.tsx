import { getLocale } from 'next-intl/server'

// ── Types ────────────────────────────────────────────────────────────────────
type FAQ = { q: string; a: string }
type Page = 'home' | 'moodle' | 'ecommerce'

// ── FAQ content ───────────────────────────────────────────────────────────────

const FAQS: Record<Page, { ar: FAQ[]; en: FAQ[] }> = {

    home: {
        ar: [
            {
                q: 'كم تكلفة تطوير منصة Moodle في مصر؟',
                a: 'تبدأ تكلفة تطوير منصة Moodle من 2,000 دولار وتزيد حسب حجم المؤسسة ومتطلبات المشروع. السعر يشمل التخصيص الكامل، دعم اللغة العربية، وتدريب الفريق. تواصل معنا للحصول على عرض سعر مخصص خلال 24 ساعة.',
            },
            {
                q: 'كم تكلفة تطوير تطبيق تجارة إلكترونية في مصر؟',
                a: 'تبدأ تكلفة تطوير تطبيق تجارة إلكترونية من 3,000 دولار لتطبيق iOS وAndroid مع لوحة تحكم متكاملة ودعم بوابات الدفع الخليجية (مدى، STC Pay، Apple Pay).',
            },
            {
                q: 'هل تخدمون السعودية والخليج العربي؟',
                a: 'نعم، ننفذ مشاريع في السعودية والإمارات وقطر والكويت والبحرين وعُمان والأردن ومصر منذ 2013. لدينا خبرة واسعة بمتطلبات السوق الخليجي، بوابات الدفع المحلية، والأنظمة الحكومية.',
            },
            {
                q: 'كم سنة خبرة شركة N.I.T في البرمجة؟',
                a: 'تأسست شركة N.I.T عام 2013، ولدينا أكثر من 12 سنة خبرة في تطوير المنصات التعليمية وتطبيقات التجارة الإلكترونية. نفذنا أكثر من 150 مشروعاً ناجحاً للجامعات والشركات في الخليج ومصر.',
            },
            {
                q: 'هل يوجد ضمان بعد تسليم المشروع؟',
                a: 'نعم، جميع مشاريعنا تشمل ضماناً لمدة سنة كاملة مع دعم فني مستمر وتدريب الفريق.',
            },
            {
                q: 'كيف أحصل على عرض سعر من شركة N.I.T؟',
                a: 'يمكنك ملء نموذج طلب عرض السعر على موقعنا وسنرد عليك خلال 24 ساعة بعرض مفصّل، أو التواصل مباشرة عبر واتساب على الرقم 201091568240+.',
            },
        ],
        en: [
            {
                q: 'How much does Moodle LMS development cost in Egypt?',
                a: 'Moodle LMS development starts from $2,000, depending on institution size and project requirements. The price includes full customization, Arabic RTL support, and team training. Contact us for a custom quote within 24 hours.',
            },
            {
                q: 'How much does eCommerce app development cost in Egypt?',
                a: 'eCommerce app development starts from $3,000 for a full iOS & Android app with admin dashboard and Gulf payment gateway support (Mada, STC Pay, Apple Pay, KNET).',
            },
            {
                q: 'Do you serve Saudi Arabia and the Gulf region?',
                a: 'Yes, we deliver projects in Saudi Arabia, UAE, Qatar, Kuwait, Bahrain, Oman, Jordan and Egypt since 2013. We have extensive experience with Gulf market requirements, local payment gateways, and government systems.',
            },
            {
                q: 'How many years of experience does N.I.T have?',
                a: 'N.I.T was founded in 2013 and has 12+ years of experience in LMS platform and eCommerce app development. We have successfully delivered 150+ projects for universities and businesses across the Gulf and Egypt.',
            },
            {
                q: 'Is there a warranty after project delivery?',
                a: 'Yes, all our projects include a full 1-year warranty with ongoing technical support and team training.',
            },
            {
                q: 'How do I get a quote from N.I.T?',
                a: 'Fill out the quote request form on our website and we\'ll respond within 24 hours with a detailed proposal, or contact us directly via WhatsApp at +201091568240.',
            },
        ],
    },

    moodle: {
        ar: [
            {
                q: 'كم تكلفة تطوير منصة Moodle في مصر؟',
                a: 'تبدأ تكلفة تطوير منصة Moodle من 2,000 دولار للمؤسسات الصغيرة، وتزيد حسب عدد المستخدمين والإضافات المطلوبة. السعر يشمل التخصيص الكامل، الإضافات، التعريب، والتدريب.',
            },
            {
                q: 'ما الفرق بين Moodle وBlackboard؟',
                a: 'Moodle مفتوح المصدر (مجاني الترخيص) وأقل تكلفة بكثير من Blackboard التجاري. Moodle أكثر مرونة في التخصيص، يدعم العربية بالكامل، ولديه مجتمع دعم ضخم. معظم الجامعات العربية تفضل Moodle لهذه الأسباب.',
            },
            {
                q: 'كم يستغرق تطوير وتسليم منصة Moodle؟',
                a: 'يستغرق تطوير منصة Moodle من 4 إلى 10 أسابيع حسب حجم المشروع والإضافات المطلوبة. المشاريع الأساسية تنتهي في 4 أسابيع، والمشاريع الكبيرة (100+ مقرر) تستغرق من 8 إلى 12 أسبوعاً.',
            },
            {
                q: 'هل تدعمون اللغة العربية والواجهة RTL في Moodle؟',
                a: 'نعم، جميع منصات Moodle التي نطورها تدعم اللغة العربية كاملاً مع واجهة RTL احترافية، وتدعم التبديل بين العربية والإنجليزية.',
            },
            {
                q: 'هل تقدمون استضافة منصة Moodle؟',
                a: 'نعم، نقدم خدمة استضافة Moodle على سيرفرات سحابية عالية الأداء. يمكننا أيضاً الاستضافة على بنيتكم التحتية الخاصة.',
            },
            {
                q: 'هل Moodle مناسب للجامعات في السعودية والخليج؟',
                a: 'نعم، نفذنا منصات Moodle للجامعات والمؤسسات التعليمية في السعودية والإمارات وقطر والكويت. نفهم متطلبات السوق الخليجي واشتراطات وزارات التعليم.',
            },
        ],
        en: [
            {
                q: 'How much does Moodle LMS development cost?',
                a: 'Moodle LMS development starts from $2,000 for small institutions and increases based on the number of users, plugins, and customizations required. The price includes full setup, Arabic support, plugins, and team training.',
            },
            {
                q: 'What is the difference between Moodle and Blackboard?',
                a: 'Moodle is open-source (free license) and much more affordable than commercial Blackboard. Moodle is highly customizable, has full Arabic RTL support, and a large support community. Most Arab universities prefer Moodle for these reasons.',
            },
            {
                q: 'How long does Moodle development and delivery take?',
                a: 'Moodle development takes 4–10 weeks depending on project size and required plugins. Basic projects finish in 4 weeks; large projects (100+ courses) take 8–12 weeks.',
            },
            {
                q: 'Do you support Arabic and RTL in Moodle?',
                a: 'Yes, all Moodle platforms we develop have full Arabic RTL support with a professional interface, and support switching between Arabic and English.',
            },
            {
                q: 'Do you offer Moodle hosting?',
                a: 'Yes, we offer Moodle hosting on high-performance cloud servers. We can also deploy on your own infrastructure.',
            },
            {
                q: 'Is Moodle suitable for universities in Saudi Arabia and the Gulf?',
                a: 'Yes, we have delivered Moodle platforms for universities and educational institutions in Saudi Arabia, UAE, Qatar and Kuwait. We understand Gulf market requirements and Ministry of Education standards.',
            },
        ],
    },

    ecommerce: {
        ar: [
            {
                q: 'كم تكلفة تطوير تطبيق تجارة إلكترونية في مصر؟',
                a: 'تبدأ تكلفة تطوير تطبيق تجارة إلكترونية من 3,000 دولار لتطبيق iOS وAndroid مع لوحة تحكم ادمن متكاملة. السعر يزيد حسب الميزات المطلوبة مثل multi-vendor أو تكامل الشحن.',
            },
            {
                q: 'هل تدعمون بوابات الدفع الخليجية؟',
                a: 'نعم، ندعم جميع بوابات الدفع الخليجية: مدى (السعودية)، KNET (الكويت)، STC Pay، Apple Pay، Google Pay، وبوابات الدفع المصرية (فوري، فودافون كاش).',
            },
            {
                q: 'هل يعمل التطبيق على iOS وAndroid معاً؟',
                a: 'نعم، نطور تطبيقاً واحداً يعمل على iOS وAndroid معاً باستخدام Flutter، مما يوفر تكلفة التطوير ويضمن تجربة موحدة على جميع الأجهزة.',
            },
            {
                q: 'كم يستغرق تطوير تطبيق تجارة إلكترونية؟',
                a: 'يستغرق تطوير تطبيق تجارة إلكترونية من 6 إلى 14 أسبوعاً حسب التعقيد. التطبيق الأساسي ينتهي في 6 أسابيع، والتطبيقات متعددة البائعين أو المتكاملة مع ERP تستغرق أكثر.',
            },
            {
                q: 'هل يوجد لوحة تحكم لإدارة المتجر؟',
                a: 'نعم، كل تطبيق نطوره يأتي مع لوحة تحكم ويب متكاملة لإدارة المنتجات، الطلبات، العملاء، التقارير، والكوبونات.',
            },
            {
                q: 'هل تدعمون multi-vendor (متعدد البائعين)؟',
                a: 'نعم، نطور منصات تجارة إلكترونية multi-vendor (مثل أمازون وجملة) تتيح لعدة بائعين البيع على نفس المنصة مع لوحة تحكم مستقلة لكل بائع.',
            },
        ],
        en: [
            {
                q: 'How much does eCommerce app development cost in Egypt?',
                a: 'eCommerce app development starts from $3,000 for an iOS & Android app with a full admin dashboard. The price increases based on features like multi-vendor, shipping integrations, or ERP connections.',
            },
            {
                q: 'Do you support Gulf payment gateways?',
                a: 'Yes, we support all Gulf payment gateways: Mada (Saudi Arabia), KNET (Kuwait), STC Pay, Apple Pay, Google Pay, and Egyptian gateways (Fawry, Vodafone Cash).',
            },
            {
                q: 'Does the app work on both iOS and Android?',
                a: 'Yes, we develop a single cross-platform app for iOS and Android using Flutter, which saves development cost and ensures a consistent experience across all devices.',
            },
            {
                q: 'How long does eCommerce app development take?',
                a: 'eCommerce app development takes 6–14 weeks depending on complexity. A standard app is finished in 6 weeks; multi-vendor or ERP-integrated apps take longer.',
            },
            {
                q: 'Is there an admin dashboard to manage the store?',
                a: 'Yes, every app we develop comes with a full web admin dashboard to manage products, orders, customers, reports, and discount codes.',
            },
            {
                q: 'Do you support multi-vendor eCommerce?',
                a: 'Yes, we develop multi-vendor eCommerce platforms (like Amazon or Jumia) that allow multiple sellers on the same platform, each with their own independent dashboard.',
            },
        ],
    },
}

// ── Component ────────────────────────────────────────────────────────────────

export default async function FAQSchema({ page }: { page: Page }) {
    const locale = await getLocale()
    const faqs = FAQS[page][locale === 'ar' ? 'ar' : 'en']

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(({ q, a }) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: {
                '@type': 'Answer',
                text: a,
            },
        })),
    }

    return (
        <script
            type='application/ld+json'
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    )
}
