// ── Shared FAQ content ────────────────────────────────────────────────────────
// Single source of truth consumed by BOTH:
//   • FAQSchema.tsx     → emits FAQPage JSON-LD (for Google / AI engines)
//   • FAQSection.tsx    → renders the SAME Q&A visibly on the page
// Keeping one source guarantees the structured data always matches what the
// user actually sees — a requirement for valid FAQ rich results.

export type FAQ = { q: string; a: string }
export type FAQPageKey = 'home' | 'moodle' | 'ecommerce' | 'delivery' | 'restaurant' | 'loyalty'

export const FAQS: Record<FAQPageKey, { ar: FAQ[]; en: FAQ[] }> = {

    home: {
        ar: [
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
                q: 'ما الفرق بين Moodle وBlackboard؟',
                a: 'Moodle مفتوح المصدر (مجاني الترخيص) وأقل تكلفة بكثير من Blackboard التجاري. Moodle أكثر مرونة في التخصيص، يدعم العربية بالكامل، ولديه مجتمع دعم ضخم. معظم الجامعات العربية تفضل Moodle لهذه الأسباب.',
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
            {
                q: 'كم تكلفة إنشاء منصة تعليمية؟',
                a: 'تختلف تكلفة إنشاء منصة تعليمية حسب عدد المستخدمين والمميزات (تطبيق جوال، بث مباشر، اختبارات، تكامل أنظمة). نقدم باقات مرنة تبدأ من إعداد منصة Moodle أساسية وحتى منصة مخصصة كاملة — تواصل معنا لعرض سعر مفصّل خلال 24 ساعة.',
            },
            {
                q: 'كيف أنشئ منصة تعليمية إلكترونية لمدرستي أو جامعتي؟',
                a: 'نتولى عنك كل خطوات إنشاء المنصة التعليمية: تحليل احتياجك، إعداد وتخصيص Moodle، تصميم الواجهة بالعربية RTL، إضافة المقررات وأنظمة الاختبارات والشهادات، تطبيق جوال iOS وAndroid، ثم الاستضافة والتدريب والدعم.',
            },
        ],
        en: [
            {
                q: 'What is the difference between Moodle and Blackboard?',
                a: 'Moodle is open-source (free license) and much more affordable than commercial Blackboard. Moodle is highly customizable, has full Arabic RTL support, and a large support community. Most Arab universities prefer Moodle for these reasons.',
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
            {
                q: 'How much does it cost to build an e-learning platform?',
                a: 'The cost of building an e-learning platform depends on the number of users and features (mobile app, live streaming, quizzes, integrations). We offer flexible packages from a basic Moodle setup to a fully custom platform — contact us for a detailed quote within 24 hours.',
            },
            {
                q: 'How do I create an e-learning platform for my school or university?',
                a: 'We handle every step: analyzing your needs, installing and customizing Moodle, designing the Arabic RTL interface, adding courses, quizzes and certificates, building iOS & Android apps, then hosting, training and support.',
            },
        ],
    },

    ecommerce: {
        ar: [
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
            {
                q: 'كم تكلفة تصميم متجر إلكتروني احترافي؟',
                a: 'تعتمد تكلفة تصميم متجر إلكتروني على نوعه (متجر فردي أم متعدد التجار)، المميزات، وبوابات الدفع والشحن المطلوبة. نقدم باقات تناسب المشاريع الناشئة والمؤسسات — تواصل معنا لعرض سعر مفصّل خلال 24 ساعة.',
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

    delivery: {
        ar: [
            {
                q: 'هل تطوّرون تطبيقات توصيل مثل مرسول وهنقرستيشن وجاهز؟',
                a: 'نعم، نطوّر تطبيقات توصيل طلبات متكاملة مشابهة لمرسول وهنقرستيشن وجاهز، تشمل تطبيق العميل وتطبيق السائق ولوحة تحكم إدارية، مع تتبع مباشر للطلب على الخريطة.',
            },
            {
                q: 'هل يشمل التطبيق تطبيقاً خاصاً للسائق؟',
                a: 'نعم، نسلّم منظومة من ثلاثة أطراف: تطبيق للعميل لطلب الخدمة، تطبيق للسائق لاستلام وتوصيل الطلبات، ولوحة تحكم ويب لإدارة الطلبات والسائقين والعمولات.',
            },
            {
                q: 'هل يمكن للتطبيق توصيل أكثر من نوع (طعام، بقالة، صيدلية)؟',
                a: 'نعم، نطوّر تطبيقات توصيل متعددة الخدمات والفئات تجمع الطعام والبقالة والصيدلية والتوريدات في تطبيق واحد مع بائعين متعددين.',
            },
            {
                q: 'هل تدعمون الدفع الإلكتروني ومحافظ السائقين؟',
                a: 'نعم، ندعم مدى وSTC Pay وKNET وفوري والدفع عند الاستلام، مع نظام محافظ للسائقين وتسوية تلقائية للأرباح.',
            },
            {
                q: 'كم تكلفة تطبيق توصيل مثل هنقرستيشن أو مرسول؟',
                a: 'تختلف تكلفة تطبيق التوصيل حسب عدد التطبيقات (عميل، سائق، تاجر)، نوع الخدمة (توصيل طلبات أو ركاب)، والمميزات مثل التتبع المباشر وبوابات الدفع. نبني نسخة أولية (MVP) قابلة للتوسّع — تواصل معنا لعرض سعر مفصّل.',
            },
        ],
        en: [
            {
                q: 'Do you build delivery apps like Mrsool, HungerStation and Jahez?',
                a: 'Yes, we build complete delivery apps similar to Mrsool, HungerStation and Jahez — including a customer app, a driver app, and an admin dashboard, with live map order tracking.',
            },
            {
                q: 'Does the solution include a dedicated driver app?',
                a: 'Yes, we deliver a 3-sided system: a customer ordering app, a driver app to accept and deliver orders, and a web admin dashboard to manage orders, drivers and commissions.',
            },
            {
                q: 'Can one app deliver multiple categories (food, grocery, pharmacy)?',
                a: 'Yes, we build multi-service, multi-category delivery apps that combine food, groceries, pharmacy and supplies in a single app with multiple vendors.',
            },
            {
                q: 'Do you support online payments and driver wallets?',
                a: 'Yes, we support Mada, STC Pay, KNET, Fawry and cash on delivery, with a driver wallet system and automated earnings settlement.',
            },
            {
                q: 'How much does a delivery app like HungerStation or Mrsool cost?',
                a: 'The cost depends on the number of apps (customer, driver, merchant), the service type (parcel or ride-hailing) and features like live tracking and payment gateways. We build a scalable MVP first — contact us for a detailed quote.',
            },
        ],
    },

    restaurant: {
        ar: [
            {
                q: 'هل تطوّرون تطبيق طلبات باسم مطعمي الخاص؟',
                a: 'نعم، نطوّر تطبيق طلب ودليفري بهوية مطعمك على Google Play وApp Store، بحيث تمتلك عملاءك مباشرة دون عمولات تطبيقات الوسطاء.',
            },
            {
                q: 'هل يشمل النظام نقاط بيع POS وإدارة المطبخ؟',
                a: 'نعم، يشمل النظام نقاط بيع للكاشير، شاشة عرض طلبات للمطبخ، وإدارة الطاولات والفروع، بالإضافة إلى تطبيق العملاء.',
            },
            {
                q: 'هل يدعم التطبيق الطلب داخل الصالة والتيك أواي والتوصيل؟',
                a: 'نعم، يدير النظام الطلب داخل الصالة عبر QR، والتيك أواي، والتوصيل للمنزل من منصة واحدة.',
            },
            {
                q: 'هل يناسب النظام المطاعم متعددة الفروع؟',
                a: 'نعم، نطوّر أنظمة مطاعم متعددة الفروع مع قوائم وأسعار وتقارير مستقلة لكل فرع من لوحة تحكم موحدة.',
            },
            {
                q: 'كم تكلفة تصميم و برمجة تطبيق مطعم؟',
                a: 'تعتمد تكلفة تطبيق المطعم على المميزات المطلوبة: تطبيق طلب فقط، أم منظومة كاملة بنقاط بيع وإدارة فروع ومطبخ. نقدم باقات مرنة باسم مطعمك — تواصل معنا لعرض سعر مفصّل خلال 24 ساعة.',
            },
        ],
        en: [
            {
                q: 'Do you build an ordering app under my own restaurant brand?',
                a: 'Yes, we build a branded ordering & delivery app on Google Play and the App Store so you own your customers directly, without aggregator commissions.',
            },
            {
                q: 'Does the system include POS and kitchen management?',
                a: 'Yes, it includes a cashier POS, a kitchen display for orders, and table/branch management, alongside the customer app.',
            },
            {
                q: 'Does the app support dine-in, takeaway and delivery?',
                a: 'Yes, the system handles dine-in QR ordering, takeaway pickup, and home delivery from a single platform.',
            },
            {
                q: 'Is the system suitable for multi-branch restaurants?',
                a: 'Yes, we build multi-branch restaurant systems with per-branch menus, pricing and reports from one unified dashboard.',
            },
        ],
    },

    loyalty: {
        ar: [
            {
                q: 'ما هو نظام ولاء العملاء وكيف يفيد نشاطي؟',
                a: 'نظام ولاء العملاء هو تطبيق يكافئ عملاءك بنقاط وعروض مقابل مشترياتهم وتفاعلهم، مما يزيد تكرار الشراء ويحوّل العملاء العابرين إلى عملاء دائمين.',
            },
            {
                q: 'هل يدعم النظام النقاط والكوبونات وبطاقات العضوية؟',
                a: 'نعم، نطوّر محرك نقاط ومكافآت مرن مع كوبونات خصم، مستويات عضوية، وبطاقات عضوية رقمية بـ QR/باركود يمسحها العميل في المتجر.',
            },
            {
                q: 'هل يمكن ربط نظام الولاء بنقاط البيع أو متجري الإلكتروني؟',
                a: 'نعم، نربط النظام بنقاط البيع أو المتجر الإلكتروني لاحتساب النقاط تلقائياً عند كل عملية شراء.',
            },
            {
                q: 'هل يصلح نظام الولاء للمطاعم والمتاجر والصالونات؟',
                a: 'نعم، نظام الولاء يناسب أي نشاط يريد عملاء يعودون: المتاجر، المطاعم، الكافيهات، الصالونات، الأندية، ومحطات الخدمة.',
            },
            {
                q: 'ما أنواع أنظمة الولاء التي تطوّرونها؟',
                a: 'نطوّر مختلف أنواع أنظمة الولاء: برامج النقاط والمكافآت، أنظمة الكاش باك، بطاقات العضوية ومستوياتها (Tiers)، الكوبونات والعروض، وبرامج الإحالة — مع لوحة تحليلات ودعم السوق السعودي والمصري والخليجي.',
            },
        ],
        en: [
            {
                q: 'What is a customer loyalty system and how does it help my business?',
                a: 'A customer loyalty system is an app that rewards your customers with points and offers for their purchases and engagement, increasing repeat purchases and turning one-time buyers into regulars.',
            },
            {
                q: 'Does the system support points, coupons and membership cards?',
                a: 'Yes, we build a flexible points & rewards engine with discount coupons, membership tiers, and QR/barcode digital membership cards customers scan in-store.',
            },
            {
                q: 'Can the loyalty system integrate with my POS or online store?',
                a: 'Yes, we connect the system to your POS or online store so points are earned automatically on every purchase.',
            },
            {
                q: 'Is a loyalty system suitable for restaurants, retail and salons?',
                a: 'Yes, a loyalty system fits any business that wants returning customers: retail stores, restaurants, cafés, salons, gyms and service stations.',
            },
            {
                q: 'What types of loyalty systems do you build?',
                a: 'We build all types of loyalty systems: points & rewards programs, cashback systems, tiered membership cards, coupons & offers, and referral programs — with an analytics dashboard and support for the Saudi, Egyptian and Gulf markets.',
            },
        ],
    },
}
