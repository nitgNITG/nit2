/**
 * Blog seed script — adds 6 SEO-optimised bilingual articles.
 *
 * Run on the server:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seedBlogs.ts
 *
 * Images are set to a placeholder (/logo.svg) — replace them via the
 * dashboard after running this script.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PLACEHOLDER = '/logo.svg';

/* ─────────────────────────────────────────────────────────────────────────────
   Article data
   Each article has: title (AR), titleEn, content/contentEn (intro), metaDesc,
   and sections[].  Sections have a title, optional content, and optional list[].
───────────────────────────────────────────────────────────────────────────── */

const articles = [

    // ── 1 ─────────────────────────────────────────────────────────────────────
    {
        title: 'تكلفة تطوير منصة Moodle في مصر والخليج: دليل شامل 2024',
        titleEn: 'Cost of Moodle LMS Development in Egypt & the Gulf: A Complete 2024 Guide',
        content: 'يُعدّ Moodle من أكثر أنظمة إدارة التعلم انتشاراً في العالم العربي، غير أن كثيراً من المؤسسات تتساءل: كم تكلّف تطوير منصة Moodle احترافية؟ في هذا المقال نستعرض العوامل التي تؤثر في التكلفة والخيارات المتاحة أمامك لتحقيق أقصى قيمة من استثمارك.',
        contentEn: 'Moodle is the most widely adopted LMS in the Arab world, yet many organisations ask the same question: how much does a professional Moodle platform actually cost? In this guide we break down every factor that shapes the price and show you how to get maximum value from your investment.',
        metaDesc: 'تعرّف على تكلفة تطوير منصة Moodle في مصر والخليج — العوامل المؤثرة، مقارنة الخيارات، ونصائح لتوفير الميزانية.',
        metaDescEn: 'Discover the true cost of Moodle LMS development in Egypt & the Gulf — factors, options, and budget tips from NIT experts.',
        img: PLACEHOLDER,
        sections: [
            {
                title: 'لماذا يختار المؤسسات Moodle؟',
                titleEn: 'Why Organisations Choose Moodle',
                content: 'Moodle هو نظام مفتوح المصدر يمنحك حرية التخصيص الكامل دون رسوم ترخيص سنوية. يدعم العربية بالكامل، ويتوافق مع معايير SCORM وxAPI، ويُمكّن المؤسسات من إدارة آلاف المتدربين من خلال لوحة تحكم مركزية واحدة.',
                contentEn: 'Moodle is open-source, giving you full customisation freedom with no annual licensing fees. It supports Arabic fully, is SCORM/xAPI-compliant, and lets organisations manage thousands of learners from a single control panel.',
                list: [
                    { title: 'تكلفة ترخيص صفرية', titleEn: 'Zero licensing cost', content: 'لا رسوم اشتراك سنوية، يدفع الإدارة تكلفة التطوير والاستضافة فقط.', contentEn: 'No annual subscription fees — you only pay for development and hosting.' },
                    { title: 'تخصيص كامل', titleEn: 'Full customisation', content: 'يمكن تعديل كل جزء من المنصة ليتوافق مع هوية مؤسستك.', contentEn: 'Every part of the platform can be tailored to your institutional identity.' },
                    { title: 'مجتمع دعم ضخم', titleEn: 'Massive support community', content: 'أكثر من 200 مليون مستخدم و80,000 موقع مرجعي حول العالم.', contentEn: 'Over 200 million users and 80,000 reference sites worldwide.' },
                ],
            },
            {
                title: 'العوامل الرئيسية التي تحدد تكلفة تطوير Moodle',
                titleEn: 'Key Factors That Determine Moodle Development Cost',
                content: 'لا توجد تكلفة ثابتة لمنصة Moodle؛ السعر يتشكّل حسب احتياجاتك الخاصة. إليك أبرز المتغيرات:',
                contentEn: 'There is no fixed price for a Moodle platform — cost is shaped by your specific needs. Here are the main variables:',
                list: [
                    { title: 'التصميم والهوية البصرية', titleEn: 'Design & visual identity', content: 'قالب جاهز مُعدَّل مقابل تصميم مخصص من الصفر.', contentEn: 'Modified ready theme vs. fully custom design from scratch.' },
                    { title: 'عدد المستخدمين والاستضافة', titleEn: 'User count & hosting', content: 'منصات صغيرة (حتى 500 مستخدم) تحتاج موارد استضافة أقل بكثير من منصات الآلاف.', contentEn: 'Small platforms (up to 500 users) need far fewer hosting resources than large-scale deployments.' },
                    { title: 'الإضافات والتكاملات', titleEn: 'Plugins & integrations', content: 'بوابة دفع، Zoom، منظومة حضور ذكية، توليد الشهادات التلقائي — كل إضافة تُضيف للتكلفة.', contentEn: 'Payment gateway, Zoom integration, smart attendance, auto-certificate generation — each adds to cost.' },
                    { title: 'تطبيقات الجوال', titleEn: 'Mobile apps', content: 'تطبيق Android وiOS مخصص بدلاً من الاعتماد على تطبيق Moodle الافتراضي.', contentEn: 'Custom Android & iOS apps instead of relying on the default Moodle mobile app.' },
                ],
            },
            {
                title: 'نطاقات التكلفة المتوقعة في مصر والخليج',
                titleEn: 'Expected Cost Ranges in Egypt & the Gulf',
                content: 'بناءً على خبرتنا في تطوير أكثر من 15 منصة Moodle، يمكن تقسيم الحلول إلى ثلاثة مستويات:',
                contentEn: 'Based on our experience building 15+ Moodle platforms, solutions fall into three tiers:',
                list: [
                    { title: 'الحل الأساسي', titleEn: 'Basic solution', content: 'تثبيت وتخصيص قالب، حتى 300 مستخدم، دعم عربي، تكلفة متوسطة منخفضة.', contentEn: 'Installation + theme customisation, up to 300 users, Arabic support — lower-mid budget.' },
                    { title: 'الحل المتوسط', titleEn: 'Mid-tier solution', content: 'تصميم شبه مخصص، تكاملات Zoom + بوابة دفع، تطبيق موبايل أساسي.', contentEn: 'Semi-custom design, Zoom + payment gateway integrations, basic mobile app.' },
                    { title: 'الحل المؤسسي الكامل', titleEn: 'Full enterprise solution', content: 'تصميم كامل على الهوية، تطبيق موبايل مخصص، BI وتقارير متقدمة، SLA مضمون.', contentEn: 'Full brand-aligned design, custom mobile app, advanced BI & reporting, guaranteed SLA.' },
                ],
            },
            {
                title: 'كيف تختار الشريك التقني المناسب لتطوير Moodle؟',
                titleEn: 'How to Choose the Right Technical Partner for Moodle Development',
                content: 'الشريك الصحيح يوفّر عليك أضعاف ما تدفعه. ابحث عن شركة تمتلك مشاريع Moodle مرجعية، فريق دعم عربي، وخبرة في قطاع التعليم والتدريب الحكومي والشركات.',
                contentEn: 'The right partner saves you multiples of what you pay. Look for a company with verifiable Moodle references, Arabic-speaking support, and experience in government training and corporate e-learning.',
                list: [],
            },
        ],
    },

    // ── 2 ─────────────────────────────────────────────────────────────────────
    {
        title: 'كيف تختار شركة برمجة تطبيقات موثوقة في مصر؟ 7 معايير أساسية',
        titleEn: 'How to Choose a Reliable App Development Company in Egypt: 7 Essential Criteria',
        content: 'مع تزايد شركات البرمجة في السوق المصري والعربي، أصبح اختيار الشريك التقني المناسب تحدياً حقيقياً. سواء كنت تبني تطبيق جوال أو منصة تعليمية أو متجراً إلكترونياً، هذه المعايير السبعة ستحميك من اتخاذ قرار خاطئ يكلّفك الوقت والمال.',
        contentEn: 'With app development companies multiplying across the Egyptian and Arab market, picking the right technical partner has become a real challenge. Whether you are building a mobile app, an LMS, or an eCommerce platform, these seven criteria will protect you from a costly wrong decision.',
        metaDesc: '7 معايير لاختيار شركة برمجة تطبيقات موثوقة في مصر — مشاريع مرجعية، فريق متخصص، دعم ما بعد التسليم.',
        metaDescEn: '7 criteria for choosing a reliable app development company in Egypt — references, team, post-launch support, and more.',
        img: PLACEHOLDER,
        sections: [
            {
                title: 'المعيار الأول: المشاريع المرجعية القابلة للتحقق',
                titleEn: 'Criterion 1: Verifiable Reference Projects',
                content: 'لا تكتفِ بمعرض الأعمال على الموقع — اطلب روابط حية أو تواصل مع عملاء سابقين. الشركة الموثوقة تُرحّب بذلك.',
                contentEn: 'Do not rely solely on the portfolio page — ask for live links or contact past clients directly. A trustworthy company welcomes this.',
                list: [],
            },
            {
                title: 'المعيار الثاني: تخصص الفريق التقني',
                titleEn: 'Criterion 2: Technical Team Specialisation',
                content: 'هل يمتلكون مطورين متخصصين في iOS وAndroid والويب؟ أم أن مطوراً واحداً يُنجز كل شيء؟ التخصص يعني جودة أعلى وتسليماً أسرع.',
                contentEn: 'Do they have dedicated iOS, Android, and web developers? Or does one developer do everything? Specialisation means higher quality and faster delivery.',
                list: [
                    { title: 'فريق متعدد التخصصات', titleEn: 'Cross-specialisation team', content: 'Backend، Frontend، UI/UX، QA — كل دور بمختص منفصل.', contentEn: 'Backend, Frontend, UI/UX, QA — each role filled by a dedicated specialist.' },
                    { title: 'خبرة في التقنيات الحديثة', titleEn: 'Modern tech stack experience', content: 'React Native / Flutter للموبايل، Next.js للويب، Node.js أو Laravel للـ API.', contentEn: 'React Native / Flutter for mobile, Next.js for web, Node.js or Laravel for APIs.' },
                ],
            },
            {
                title: 'المعيار الثالث: منهجية العمل والتواصل',
                titleEn: 'Criterion 3: Work Methodology & Communication',
                content: 'الشركات الجادة تعمل بمنهجية Agile أو Scrum، تُرسل تقارير دورية، وتمنحك وصولاً لنظام إدارة المهام لتتابع تقدم مشروعك لحظة بلحظة.',
                contentEn: 'Serious companies work with Agile or Scrum methodology, send periodic reports, and give you access to a task management system so you can track progress in real time.',
                list: [],
            },
            {
                title: 'المعيار الرابع: الدعم الفني بعد التسليم',
                titleEn: 'Criterion 4: Post-Launch Technical Support',
                content: 'المشروع لا ينتهي عند التسليم. احرص على وجود عقد صيانة واضح يحدد وقت الاستجابة وآليات إصلاح الأخطاء وتحديثات الأمان.',
                contentEn: 'A project does not end at delivery. Make sure there is a clear maintenance contract specifying response times, bug-fix processes, and security update schedules.',
                list: [],
            },
            {
                title: 'معايير إضافية لا تتجاهلها',
                titleEn: 'Additional Criteria You Cannot Ignore',
                content: 'إلى جانب المعايير الأربعة الرئيسية، انتبه لهذه النقاط قبل توقيع العقد:',
                contentEn: 'Alongside the four main criteria, watch for these points before signing the contract:',
                list: [
                    { title: 'ملكية الكود البرمجي', titleEn: 'Code ownership', content: 'تأكد أن ملكية الكود تنتقل إليك كاملاً عند الاستلام.', contentEn: 'Confirm full code ownership transfers to you upon delivery.' },
                    { title: 'الشفافية في التسعير', titleEn: 'Pricing transparency', content: 'احذر من الأسعار المنخفضة جداً — عادةً تعني تجميد الميزات أو تكاليف خفية لاحقاً.', contentEn: 'Beware of very low prices — they usually mean feature freezes or hidden costs later.' },
                    { title: 'الخبرة في قطاعك', titleEn: 'Experience in your sector', content: 'شركة سبق لها العمل في التعليم أو التجارة الإلكترونية تفهم متطلباتك بشكل أعمق.', contentEn: 'A company with prior experience in education or eCommerce understands your requirements at a deeper level.' },
                ],
            },
        ],
    },

    // ── 3 ─────────────────────────────────────────────────────────────────────
    {
        title: 'فوائد منصات التعلم الإلكتروني Moodle للشركات والمؤسسات الحكومية',
        titleEn: 'Benefits of Moodle LMS for Businesses & Government Institutions',
        content: 'في عصر التحول الرقمي، لم يعد التدريب التقليدي كافياً لمواكبة التطور السريع. منصة Moodle تمنح المؤسسات — سواء الحكومية أو الخاصة — القدرة على تدريب موظفيها وعملائها بكفاءة عالية وتكلفة أقل بكثير من البرامج التدريبية التقليدية.',
        contentEn: 'In the era of digital transformation, traditional training is no longer enough to keep pace with rapid change. Moodle gives organisations — government and private alike — the ability to train employees and customers with high efficiency at a fraction of the cost of traditional programmes.',
        metaDesc: 'اكتشف فوائد منصة Moodle للتعلم الإلكتروني للشركات والحكومات — خفض التكاليف، مرونة التدريب، وتتبع الأداء.',
        metaDescEn: 'Discover Moodle LMS benefits for businesses and governments — cost reduction, training flexibility, and performance tracking.',
        img: PLACEHOLDER,
        sections: [
            {
                title: 'خفض تكاليف التدريب بنسبة تصل إلى 70%',
                titleEn: 'Reduce Training Costs by Up to 70%',
                content: 'التدريب الإلكتروني يُلغي تكاليف السفر والإقامة وإيجار القاعات وطباعة المواد، مع إمكانية إعادة استخدام نفس المحتوى لآلاف المتدربين دون تكلفة إضافية.',
                contentEn: 'eLearning eliminates travel, accommodation, venue rental, and printing costs, while the same content can be reused for thousands of trainees at no extra cost.',
                list: [],
            },
            {
                title: 'مرونة التعلم في أي وقت ومن أي مكان',
                titleEn: 'Learn Anytime, Anywhere',
                content: 'يستطيع الموظف إكمال تدريبه من هاتفه في المنزل أو خلال تنقله، مما يُزيل عائق الجدول الزمني الصارم ويرفع معدل إتمام الدورات.',
                contentEn: 'Employees can complete training on their phone at home or during commute, removing the rigid schedule barrier and boosting course completion rates.',
                list: [],
            },
            {
                title: 'تتبع الأداء وقياس فاعلية التدريب',
                titleEn: 'Track Performance & Measure Training Effectiveness',
                content: 'لوحة التحكم في Moodle تُظهر نسب الإتمام، نتائج الاختبارات، وقت التفاعل مع المحتوى، ومقارنة أداء الأقسام — بيانات تمكّن المدير من اتخاذ قرارات مبنية على الأرقام.',
                contentEn: "Moodle's dashboard shows completion rates, test results, content interaction time, and department performance comparison — data that empowers managers to make evidence-based decisions.",
                list: [
                    { title: 'تقارير فردية وجماعية', titleEn: 'Individual & group reports', content: 'تتبع أداء كل موظف أو قسم بأكمله.', contentEn: 'Track performance per employee or entire department.' },
                    { title: 'شهادات تلقائية', titleEn: 'Automatic certificates', content: 'إصدار شهادات إتمام مخصصة تلقائياً عند اجتياز الدورة.', contentEn: 'Automatic custom completion certificates issued upon course pass.' },
                    { title: 'تكامل مع أنظمة الموارد البشرية', titleEn: 'HR system integration', content: 'ربط Moodle مع SAP وOdoo وغيرها لمزامنة بيانات الموظفين.', contentEn: 'Connect Moodle with SAP, Odoo, and others to sync employee data.' },
                ],
            },
            {
                title: 'تطبيقات عملية في القطاع الحكومي',
                titleEn: 'Practical Applications in the Government Sector',
                content: 'نفّذت NIT منصات Moodle لوزارة القوى العاملة ودار الإفتاء المصرية، حيث أتاحت التدريب لآلاف الموظفين والمفتين عبر الإنترنت بتكلفة تشغيلية منخفضة جداً.',
                contentEn: 'NIT has delivered Moodle platforms for Egypt\'s Ministry of Manpower and Dar Al Iftaa, enabling online training for thousands of employees and muftis at very low operational cost.',
                list: [],
            },
        ],
    },

    // ── 4 ─────────────────────────────────────────────────────────────────────
    {
        title: 'تطبيقات التجارة الإلكترونية متعددة البائعين: كل ما تحتاج معرفته قبل البناء',
        titleEn: 'Multi-Vendor eCommerce Apps: Everything You Need to Know Before You Build',
        content: 'نموذج التجارة الإلكترونية متعدد البائعين (مثل أمازون وجوميا) يُتيح لمئات البائعين البيع عبر منصة واحدة تمتلكها أنت. يبدو الأمر مُعقّداً؟ في هذا المقال نُبسّط المفهوم ونستعرض متطلبات البناء وأبرز التحديات وكيف نجحنا في تنفيذه لعملاء خليجيين.',
        contentEn: 'The multi-vendor eCommerce model (think Amazon or Jumia) lets hundreds of sellers trade through a single platform that you own. Sounds complex? In this article we simplify the concept, cover build requirements, key challenges, and how we successfully delivered it for Gulf clients.',
        metaDesc: 'دليل شامل لتطبيقات التجارة الإلكترونية متعددة البائعين — المكونات، التحديات، وكيفية البناء بنجاح.',
        metaDescEn: 'Complete guide to multi-vendor eCommerce apps — components, challenges, and how to build one successfully.',
        img: PLACEHOLDER,
        sections: [
            {
                title: 'ما الفرق بين متجر عادي ومنصة متعددة البائعين؟',
                titleEn: 'What Is the Difference Between a Regular Store and a Multi-Vendor Platform?',
                content: 'في المتجر العادي أنت البائع الوحيد. في المنصة متعددة البائعين، تُحوّل موقعك إلى سوق رقمي يبيع فيه آخرون وتأخذ أنت عمولة أو رسوم اشتراك.',
                contentEn: 'In a regular store, you are the only seller. In a multi-vendor platform, you turn your site into a digital marketplace where others sell and you earn commission or subscription fees.',
                list: [
                    { title: 'المشتري', titleEn: 'Buyer', content: 'يتصفح المنتجات من بائعين متعددين ويُتمّ الدفع في سلة واحدة.', contentEn: 'Browses products from multiple vendors and checks out in a single cart.' },
                    { title: 'البائع/المورّد', titleEn: 'Seller / Vendor', content: 'يُدير متجره الخاص داخل المنصة — مخزون، أسعار، عروض.', contentEn: 'Manages their own store within the platform — inventory, pricing, promotions.' },
                    { title: 'شركة الشحن', titleEn: 'Shipping company', content: 'تستقبل الطلبات وتتتبع التوصيل عبر لوحة تحكم مخصصة.', contentEn: 'Receives orders and tracks delivery through a dedicated dashboard.' },
                    { title: 'المدير العام', titleEn: 'Platform admin', content: 'يُراقب كل العمليات، يُدير العمولات، ويحلّ النزاعات.', contentEn: 'Monitors all operations, manages commissions, and resolves disputes.' },
                ],
            },
            {
                title: 'المكونات التقنية الأساسية لتطبيق متعدد البائعين',
                titleEn: 'Core Technical Components of a Multi-Vendor App',
                content: 'المنصة الناجحة تحتاج أكثر من مجرد "متجر". هذه هي الأنظمة الفرعية التي يجب تصميمها بعناية:',
                contentEn: 'A successful platform needs more than just a "store". These are the sub-systems that must be carefully designed:',
                list: [
                    { title: 'نظام إدارة البائعين', titleEn: 'Vendor management system', content: 'تسجيل، موافقة، لوحة تحكم، ومحفظة مالية لكل بائع.', contentEn: 'Registration, approval, dashboard, and digital wallet for each vendor.' },
                    { title: 'محرك البحث والتصفية', titleEn: 'Search & filter engine', content: 'بحث نصي، فلاتر متعددة، فرز بالسعر والتقييم والمسافة.', contentEn: 'Text search, multi-filter, sort by price, rating, and distance.' },
                    { title: 'بوابة الدفع والتحويل التلقائي', titleEn: 'Payment gateway & auto-split', content: 'تقسيم المبالغ تلقائياً بين المنصة والبائع وشركة الشحن.', contentEn: 'Automatic split of payments between the platform, vendor, and shipper.' },
                    { title: 'نظام التقييمات والمراجعات', titleEn: 'Ratings & reviews system', content: 'تقييم البائع والمنتج والتوصيل بشكل منفصل.', contentEn: 'Separate rating for vendor, product, and delivery.' },
                ],
            },
            {
                title: 'أبرز التحديات في تطوير منصة متعددة البائعين',
                titleEn: 'Top Challenges in Multi-Vendor Platform Development',
                content: 'تجنُّب هذه التحديات منذ البداية يوفّر عليك إعادة بناء أجزاء من المشروع لاحقاً.',
                contentEn: 'Avoiding these challenges from the start saves you from rebuilding parts of the project later.',
                list: [
                    { title: 'الأمان والصلاحيات', titleEn: 'Security & permissions', content: 'كل بائع يرى بياناته فقط — عزل البيانات أمر حرج.', contentEn: 'Each vendor sees only their own data — data isolation is critical.' },
                    { title: 'الأداء مع البيانات الضخمة', titleEn: 'Performance at scale', content: 'آلاف المنتجات والطلبات اليومية تتطلب بنية تحتية مُحسَّنة.', contentEn: 'Thousands of products and daily orders require optimised infrastructure.' },
                    { title: 'تجربة المستخدم المعقدة', titleEn: 'Complex UX', content: 'تبسيط تجربة 4 أنواع مستخدمين في تطبيق واحد — مهمة UX متقدمة.', contentEn: 'Simplifying the experience for 4 user types in one app — an advanced UX task.' },
                ],
            },
        ],
    },

    // ── 5 ─────────────────────────────────────────────────────────────────────
    {
        title: 'التحول الرقمي للمؤسسات التعليمية في مصر: من أين تبدأ؟',
        titleEn: 'Digital Transformation for Educational Institutions in Egypt: Where to Start?',
        content: 'التحول الرقمي لم يعد خياراً للمدارس والجامعات ومراكز التدريب — بل أصبح ضرورة تفرضها التغييرات المتسارعة في سوق العمل وتوقعات الطلاب والأهالي. لكن كثيراً من المؤسسات لا تعرف من أين تبدأ. هذا المقال يضع بين يديك خارطة طريق عملية.',
        contentEn: "Digital transformation is no longer optional for schools, universities, and training centres — it is a necessity driven by rapid labour market changes and evolving expectations from students and parents. Yet many institutions don't know where to start. This article puts a practical roadmap in your hands.",
        metaDesc: 'خارطة طريق للتحول الرقمي للمؤسسات التعليمية في مصر — الخطوات، الأدوات، ونماذج ناجحة من الواقع.',
        metaDescEn: 'Digital transformation roadmap for Egyptian educational institutions — steps, tools, and real-world success stories.',
        img: PLACEHOLDER,
        sections: [
            {
                title: 'تقييم الوضع الراهن: نقطة البداية الصحيحة',
                titleEn: 'Assess the Current State: The Right Starting Point',
                content: 'قبل شراء أي تقنية، أجرِ تقييماً صادقاً لعملياتك الحالية. ما هي النقاط الأكثر إهداراً للوقت؟ التسجيل؟ الجداول الدراسية؟ التواصل مع الأهالي؟ ابدأ من أكبر نقطة ألم.',
                contentEn: 'Before buying any technology, conduct an honest assessment of your current operations. What wastes the most time? Registration? Scheduling? Parent communication? Start from the biggest pain point.',
                list: [],
            },
            {
                title: 'المراحل الثلاث لتحول رقمي ناجح',
                titleEn: 'Three Phases of Successful Digital Transformation',
                content: 'التحول الرقمي ليس مشروعاً واحداً — بل رحلة تدريجية ينبغي أن تسير في هذه المراحل:',
                contentEn: 'Digital transformation is not a single project — it is a gradual journey that should progress through these phases:',
                list: [
                    { title: 'المرحلة الأولى: الرقمنة', titleEn: 'Phase 1: Digitisation', content: 'تحويل العمليات الورقية إلى رقمية — سجلات الطلاب، الحضور، الدرجات.', contentEn: 'Converting paper processes to digital — student records, attendance, grades.' },
                    { title: 'المرحلة الثانية: التكامل', titleEn: 'Phase 2: Integration', content: 'ربط الأنظمة المختلفة في منظومة موحدة — LMS + نظام مالي + بوابة أهالي.', contentEn: 'Connecting different systems into a unified ecosystem — LMS + finance + parent portal.' },
                    { title: 'المرحلة الثالثة: الذكاء', titleEn: 'Phase 3: Intelligence', content: 'استخدام البيانات لاتخاذ قرارات — تحليل أداء الطلاب، التنبؤ بالتسرب الدراسي.', contentEn: 'Using data to drive decisions — student performance analysis, dropout prediction.' },
                ],
            },
            {
                title: 'منصة Moodle كركيزة للتحول الرقمي التعليمي',
                titleEn: 'Moodle as the Cornerstone of Educational Digital Transformation',
                content: 'Moodle تُوفّر نقطة انطلاق مثالية: مفتوحة المصدر، قابلة للتوسع، ومُدعومة بمجتمع ضخم من المطورين العرب. يمكن البدء بها لإدارة المحتوى التدريبي وتوسيعها لاحقاً بنظام مالي وبوابة أهالي.',
                contentEn: 'Moodle provides an ideal starting point: open-source, scalable, and backed by a large Arabic developer community. Start with it for training content management and extend it later with a financial system and parent portal.',
                list: [],
            },
            {
                title: 'نماذج ناجحة من السوق المصري',
                titleEn: 'Success Stories from the Egyptian Market',
                content: 'عملنا مع وزارة القوى العاملة ودار الإفتاء المصرية على منصات Moodle تُدير تدريب آلاف الموظفين. التجربة أثبتت أن المفتاح ليس في التقنية وحدها، بل في إدارة التغيير وتدريب المستخدمين.',
                contentEn: "We worked with Egypt's Ministry of Manpower and Dar Al Iftaa on Moodle platforms managing training for thousands of employees. The experience proved that the key is not just technology — it is change management and user training.",
                list: [],
            },
        ],
    },

    // ── 6 ─────────────────────────────────────────────────────────────────────
    {
        title: 'iOS أم Android أم Web App؟ دليلك لاختيار المنصة الصحيحة لمشروعك',
        titleEn: 'iOS vs Android vs Web App: Your Guide to Choosing the Right Platform for Your Project',
        content: 'أحد أكثر الأسئلة التي يطرحها عملاؤنا: "هل أبدأ بـ iOS أم Android؟ وماذا عن Web App؟" الإجابة لا تعتمد على التفضيل الشخصي — بل على جمهورك المستهدف، ميزانيتك، والتسارع الذي تريده في الوصول للسوق. هذا الدليل يُجيب بشكل عملي.',
        contentEn: 'One of the most common questions our clients ask: "Should I start with iOS or Android? What about a Web App?" The answer does not depend on personal preference — it depends on your target audience, budget, and how quickly you need to reach market. This guide gives you practical answers.',
        metaDesc: 'مقارنة iOS وAndroid وWeb App — كيف تختار المنصة الصحيحة لمشروعك حسب جمهورك وميزانيتك.',
        metaDescEn: 'iOS vs Android vs Web App comparison — how to choose the right platform based on your audience and budget.',
        img: PLACEHOLDER,
        sections: [
            {
                title: 'الفروقات الجوهرية بين الثلاث منصات',
                titleEn: 'Core Differences Between the Three Platforms',
                content: 'لكل منصة طبيعتها ومزاياها وقيودها. فهم هذه الفروقات هو الخطوة الأولى لاتخاذ القرار الصحيح.',
                contentEn: 'Each platform has its own nature, advantages, and constraints. Understanding these differences is the first step to making the right decision.',
                list: [
                    { title: 'iOS (آبل)', titleEn: 'iOS (Apple)', content: 'جمهور أعلى قدرة شرائية، متجر أكثر صرامة في المراجعة، تجانس الأجهزة يُسهّل الاختبار.', contentEn: 'Higher purchasing-power audience, stricter App Store review, device uniformity simplifies testing.' },
                    { title: 'Android (جوجل)', titleEn: 'Android (Google)', content: 'الحصة الأكبر في السوق المصري والعربي، تنوع الأجهزة يتطلب اختباراً أوسع.', contentEn: 'Dominant market share in Egypt and the Arab world; device variety requires broader testing.' },
                    { title: 'Web App (PWA)', titleEn: 'Web App (PWA)', content: 'لا تحتاج تثبيتاً، تصل لجميع الأجهزة، تكلفة أقل، لكن وصول محدود للميزات الأصيلة.', contentEn: 'No installation needed, reaches all devices, lower cost, but limited access to native device features.' },
                ],
            },
            {
                title: 'متى تختار Android أولاً؟',
                titleEn: 'When to Choose Android First',
                content: 'إذا كان جمهورك في مصر أو دول عربية متوسطة الدخل، فـ Android هو اختيارك الأول. أكثر من 80% من مستخدمي الهواتف في مصر يستخدمون Android.',
                contentEn: 'If your audience is in Egypt or middle-income Arab countries, Android is your first choice. Over 80% of smartphone users in Egypt are on Android.',
                list: [],
            },
            {
                title: 'متى تبدأ بـ Web App؟',
                titleEn: 'When to Start with a Web App',
                content: 'Web App هو الأنسب عندما: الميزانية محدودة، المنتج لا يزال في مرحلة التحقق من الفكرة (MVP)، أو المستخدمون يحتاجون الوصول من أجهزة متعددة (موبايل + لابتوب + تابلت).',
                contentEn: 'A Web App is most suitable when: the budget is limited, the product is still in MVP validation stage, or users need access from multiple devices (mobile + laptop + tablet).',
                list: [],
            },
            {
                title: 'الحل الأمثل: Cross-platform مع React Native أو Flutter',
                titleEn: 'The Optimal Solution: Cross-Platform with React Native or Flutter',
                content: 'في معظم المشاريع، نوصي ببناء تطبيق واحد يعمل على iOS وAndroid معاً باستخدام React Native أو Flutter. يُوفّر ذلك 40-60% من تكلفة وزمن التطوير مقارنة ببناء تطبيقين منفصلين.',
                contentEn: 'For most projects, we recommend building a single app that runs on iOS and Android using React Native or Flutter. This saves 40-60% of development cost and time compared to building two separate native apps.',
                list: [
                    { title: 'React Native', titleEn: 'React Native', content: 'مثالي إذا كان فريقك يمتلك خبرة JavaScript / React.', contentEn: 'Ideal if your team has JavaScript / React experience.' },
                    { title: 'Flutter', titleEn: 'Flutter', content: 'أداء أعلى وتصميم أكثر اتساقاً — مثالي للتطبيقات ذات الواجهات الثرية.', contentEn: 'Higher performance and more consistent design — ideal for UI-rich applications.' },
                ],
            },
        ],
    },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Main
───────────────────────────────────────────────────────────────────────────── */

async function main() {
    console.log(`\nSeeding ${articles.length} blog articles…\n`);

    let added = 0;
    let skipped = 0;

    for (const a of articles) {
        const existing = await prisma.article.findFirst({ where: { titleEn: a.titleEn } });

        if (existing) {
            console.log(`⏭  Skip (exists): ${a.titleEn}`);
            skipped++;
            continue;
        }

        const { sections, ...articleData } = a;

        const created = await prisma.article.create({
            data: {
                ...articleData,
                Section: {
                    create: sections.map(s => ({
                        title: s.title,
                        titleEn: s.titleEn,
                        content: s.content ?? null,
                        contentEn: s.contentEn ?? null,
                        list: s.list ?? [],
                    })),
                },
            },
        });

        console.log(`✅ Added: ${a.titleEn} (${sections.length} sections)`);
        added++;
    }

    console.log(`\nDone — ${added} added, ${skipped} skipped.\n`);
    console.log('📝 Remember to add real cover images via the dashboard:');
    console.log('   https://nitg-eg.com/ar/dashboard/blogs\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
