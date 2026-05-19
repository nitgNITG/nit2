/**
 * Seed 2 SEO-optimised sample articles directly via Prisma.
 * Run: node scripts/seed-articles.mjs
 *
 * Uses a placeholder image URL (Cloudinary). Replace with real images from the dashboard.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Placeholder hero images (replace with real Cloudinary uploads)
const PLACEHOLDER = 'https://res.cloudinary.com/dlrkykxr9/image/upload/f_auto,q_auto/v1/articles/placeholder';

const articles = [

  // ══════════════════════════════════════════════════════════════════════
  // ARTICLE 1 — eCommerce
  // ══════════════════════════════════════════════════════════════════════
  {
    title: 'كيف تبني تطبيق تجارة إلكترونية ناجحًا في مصر 2025 | دليل شامل',
    titleEn: 'How to Build a Successful eCommerce App in Egypt 2025 | Complete Guide',
    content: 'سوق التجارة الإلكترونية في مصر يتجاوز 7 مليار دولار في 2025، وهو في نمو متسارع. لكن معظم التطبيقات التي تُطلق تفشل في السنة الأولى — ليس بسبب الفكرة، بل بسبب ضعف التنفيذ التقني والتجربة الرديئة للمستخدم. في هذا المقال، نشرح بالتفصيل كيف تبني تطبيق تجارة إلكترونية يصمد في السوق المصري والخليجي، بدءًا من اختيار التقنية المناسبة وصولًا إلى الإطلاق الناجح.',
    contentEn: 'Egypt\'s eCommerce market surpasses $7 billion in 2025 and is growing fast. Yet most apps launched fail within the first year — not because of the idea, but due to weak technical execution and poor user experience. In this guide, we explain step by step how to build an eCommerce app that survives in Egypt and the Gulf market, from choosing the right technology to a successful launch.',
    metaDesc: 'دليل عملي لبناء تطبيق تجارة إلكترونية ناجح في مصر 2025 — التقنية، التصميم، الدفع الإلكتروني، والإطلاق.',
    metaDescEn: 'Practical guide to building a successful eCommerce app in Egypt 2025 — tech stack, UX design, payment gateway, and launch strategy.',
    img: PLACEHOLDER,
    sections: [
      {
        title: 'لماذا تحتاج تطبيقًا وليس فقط موقعًا إلكترونيًا؟',
        titleEn: 'Why You Need an App, Not Just a Website?',
        content: '73% من مشتريات التجارة الإلكترونية في مصر تتم عبر الهاتف المحمول. التطبيق يمنحك ميزات لا يستطيع الموقع تحقيقها: الإشعارات الفورية، الدفع بضغطة واحدة، وتجربة أسرع بثلاث مرات.',
        contentEn: '73% of eCommerce purchases in Egypt happen on mobile. An app gives you features a website simply can\'t: push notifications, one-tap checkout, and a 3x faster experience.',
        list: [
          {
            title: 'الإشعارات الفورية تزيد المبيعات 30%',
            titleEn: 'Push Notifications Boost Sales by 30%',
            content: 'بإمكانك إرسال عروض مخصصة للعميل في اللحظة المناسبة — مثل تنبيه بخصم 20% على المنتج الذي تركه في السلة.',
            contentEn: 'You can send personalized offers at the right moment — like alerting a customer about a 20% discount on the item they left in their cart.',
          },
          {
            title: 'تجربة دفع سريعة تقلل معدل التخلي',
            titleEn: 'Fast Checkout Reduces Abandonment',
            content: 'التطبيق يحفظ بيانات الدفع والشحن. العميل يُتم طلبه في ثوانٍ بدل دقائق، مما يرفع معدل الإتمام بنسبة 40%.',
            contentEn: 'The app saves payment and shipping data. Customers complete orders in seconds instead of minutes, raising completion rate by 40%.',
          },
          {
            title: 'ولاء أعلى وتكرار الشراء',
            titleEn: 'Higher Loyalty and Repeat Purchases',
            content: 'مستخدمو التطبيق يشترون أكثر بمعدل 3 مرات من زوار الموقع العادي، وتكلفة استهدافهم أقل بكثير.',
            contentEn: 'App users buy 3x more than regular website visitors, and targeting them costs significantly less.',
          },
        ],
      },
      {
        title: 'المكونات الأساسية لتطبيق تجارة إلكترونية ناجح',
        titleEn: 'Core Components of a Successful eCommerce App',
        content: 'بناء تطبيق تجارة إلكترونية ليس مجرد تصميم صفحات جميلة. هناك منظومة متكاملة من العناصر التقنية والوظيفية يجب أن تعمل معًا بسلاسة.',
        contentEn: 'Building an eCommerce app is not just about beautiful screens. There\'s an integrated system of technical and functional elements that must work together seamlessly.',
        list: [
          {
            title: 'بوابة دفع موثوقة',
            titleEn: 'Reliable Payment Gateway',
            content: 'ندمج بوابات الدفع المحلية (Fawry، Paymob، Kashier) والدولية (Stripe، PayPal) لتغطية كل عملائك في مصر والخليج.',
            contentEn: 'We integrate local gateways (Fawry, Paymob, Kashier) and international ones (Stripe, PayPal) to cover all your customers in Egypt and the Gulf.',
          },
          {
            title: 'إدارة مخزون لحظية',
            titleEn: 'Real-time Inventory Management',
            content: 'نظام متزامن يمنع بيع منتجات نفدت، مع تنبيهات تلقائية لإعادة التخزين ولوحة تحكم كاملة للمدير.',
            contentEn: 'A synchronized system that prevents selling out-of-stock items, with automatic restocking alerts and a full admin dashboard.',
          },
          {
            title: 'محرك توصيات ذكي',
            titleEn: 'Smart Recommendation Engine',
            content: 'يعرض للعميل منتجات مرتبطة بما يتصفحه، مما يرفع متوسط قيمة الطلب بنسبة 25% بشكل مباشر.',
            contentEn: 'Shows customers products related to what they\'re browsing, directly increasing average order value by 25%.',
          },
          {
            title: 'تتبع الطلبات في الوقت الفعلي',
            titleEn: 'Real-time Order Tracking',
            content: 'العميل يرى موقع طلبه لحظة بلحظة من اللحظة التي يُؤكَّد فيها حتى وصوله للباب — مما يبني ثقة عالية في العلامة التجارية.',
            contentEn: 'Customers see their order location in real-time from confirmation to doorstep delivery, building high brand trust.',
          },
        ],
      },
      {
        title: 'كيف تختار شركة التطوير المناسبة؟',
        titleEn: 'How to Choose the Right Development Company?',
        content: 'الشركة التقنية التي تختارها تحدد نجاح أو فشل مشروعك. إليك المعايير الأساسية للاختيار الصحيح.',
        contentEn: 'The technical company you choose determines the success or failure of your project. Here are the key criteria for making the right choice.',
        list: [
          {
            title: 'مشاريع حية على المتاجر (ليس فقط نماذج)',
            titleEn: 'Live Projects on App Stores (Not Just Mockups)',
            content: 'اطلب رابط التطبيق على Google Play أو App Store. إذا لم يستطيعوا تقديم تطبيقات حية تعمل حاليًا، هذه علامة تحذيرية كبيرة.',
            contentEn: 'Ask for the app link on Google Play or App Store. If they can\'t provide currently live apps, that\'s a major red flag.',
          },
          {
            title: 'خبرة في السوق المحلي',
            titleEn: 'Experience with the Local Market',
            content: 'الفريق يجب أن يفهم بوابات الدفع المصرية، متطلبات RTL للعربية، وعادات المستخدم المحلي.',
            contentEn: 'The team must understand Egyptian payment gateways, RTL requirements for Arabic, and local user habits.',
          },
          {
            title: 'صيانة وتحديثات ما بعد الإطلاق',
            titleEn: 'Post-launch Maintenance and Updates',
            content: 'التطبيق يحتاج تحديثات مستمرة لمتجري App Store وGoogle Play. تأكد أن العقد يشمل الدعم بعد الإطلاق.',
            contentEn: 'Apps require continuous updates for App Store and Google Play. Ensure the contract includes post-launch support.',
          },
        ],
      },
      {
        title: 'تكلفة تطوير تطبيق تجارة إلكترونية في مصر',
        titleEn: 'Cost of eCommerce App Development in Egypt',
        content: 'يختلف السعر باختلاف التعقيد والميزات. إليك تقدير واقعي يساعدك في التخطيط الصحيح.',
        contentEn: 'The price varies depending on complexity and features. Here\'s a realistic estimate to help you plan correctly.',
        list: [
          {
            title: 'تطبيق أساسي (متجر واحد)',
            titleEn: 'Basic App (Single Store)',
            content: 'يشمل: كتالوج منتجات، سلة شراء، بوابة دفع واحدة، لوحة تحكم. مناسب للشركات الصغيرة التي تبدأ رحلتها الرقمية.',
            contentEn: 'Includes: product catalog, shopping cart, single payment gateway, admin dashboard. Suitable for small businesses starting their digital journey.',
          },
          {
            title: 'تطبيق متعدد البائعين (Multivendor)',
            titleEn: 'Multivendor Marketplace',
            content: 'يشمل كل ما سبق + إدارة بائعين متعددين، عمولات، تقييمات، ولوحة تحكم منفصلة لكل بائع. أكثر تعقيدًا وقيمة.',
            contentEn: 'Includes everything above + managing multiple vendors, commissions, ratings, and a separate dashboard per vendor. More complex and valuable.',
          },
          {
            title: 'تطبيق مع نقطة بيع (POS)',
            titleEn: 'App with Point of Sale (POS)',
            content: 'متجر رقمي + ربطه بالكاشير الفعلي في المحل. مثالي للشركات التي لديها وجود أونلاين وأوفلاين معًا.',
            contentEn: 'Online store + integration with physical POS in-store. Ideal for businesses with both online and offline presence.',
          },
        ],
      },
      {
        title: 'لماذا تختار NIT لتطوير تطبيقك في مصر؟',
        titleEn: 'Why Choose NIT for Your App Development in Egypt?',
        content: 'منذ 2013، نطور تطبيقات تجارة إلكترونية حية على Google Play وApp Store لعملاء في مصر والسعودية والإمارات والكويت.',
        contentEn: 'Since 2013, we\'ve been developing live eCommerce apps on Google Play and App Store for clients in Egypt, Saudi Arabia, UAE, and Kuwait.',
        list: [
          {
            title: 'تطبيقات حية تعمل الآن',
            titleEn: 'Live Apps Running Right Now',
            content: 'لدينا تطبيقات منشورة على المتاجر يستخدمها آلاف العملاء يوميًا — وليس نماذج أو مشاريع مكتملة بدون نشر.',
            contentEn: 'We have apps published on stores used by thousands of customers daily — not mockups or completed projects without publication.',
          },
          {
            title: 'فريق متخصص في السوق العربي',
            titleEn: 'Team Specialized in the Arab Market',
            content: 'نفهم المستخدم المصري والخليجي: RTL العربي، بوابات الدفع المحلية، وعادات التسوق الإقليمية.',
            contentEn: 'We understand Egyptian and Gulf users: Arabic RTL, local payment gateways, and regional shopping habits.',
          },
          {
            title: 'دعم كامل ما بعد الإطلاق',
            titleEn: 'Full Post-launch Support',
            content: 'نرافق مشروعك بعد الإطلاق: تحديثات iOS وAndroid، إصلاح الأخطاء، وإضافة ميزات جديدة بحسب نمو عملك.',
            contentEn: 'We accompany your project after launch: iOS and Android updates, bug fixes, and adding new features as your business grows.',
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // ARTICLE 2 — eLearning / Moodle LMS
  // ══════════════════════════════════════════════════════════════════════
  {
    title: 'منصة Moodle للتعليم الإلكتروني في مصر 2025 | كيف تختار الأفضل لمؤسستك',
    titleEn: 'Moodle LMS in Egypt 2025 | How to Choose the Best Platform for Your Institution',
    content: 'التعليم الإلكتروني في مصر نما بنسبة 300% بعد عام 2020، والمؤسسات التعليمية — من الجامعات والمدارس حتى الشركات — باتت تبحث عن منصة LMS قادرة على خدمة آلاف المتعلمين بالعربية. Moodle هي الأكثر انتشارًا في العالم (46,000 منصة نشطة) ولسبب وجيه. في هذا المقال، نشرح لماذا Moodle هي الخيار الأمثل للمؤسسات المصرية، وكيف تُطلقها بنجاح.',
    contentEn: 'E-learning in Egypt grew 300% after 2020, and educational institutions — from universities and schools to corporations — are looking for an LMS that can serve thousands of Arabic-speaking learners. Moodle is the world\'s most widely used platform (46,000 active installations) for good reason. In this article, we explain why Moodle is the ideal choice for Egyptian institutions, and how to launch it successfully.',
    metaDesc: 'دليل شامل لاختيار وتطبيق منصة Moodle للتعليم الإلكتروني في مصر والسعودية والإمارات — للجامعات والمدارس والشركات.',
    metaDescEn: 'Comprehensive guide to choosing and implementing Moodle LMS for e-learning in Egypt, Saudi Arabia and UAE — for universities, schools and corporations.',
    img: PLACEHOLDER,
    sections: [
      {
        title: 'لماذا Moodle وليس منصة تجارية أخرى؟',
        titleEn: 'Why Moodle Over Other Commercial Platforms?',
        content: 'هناك عشرات منصات LMS في السوق (Canvas، Blackboard، TalentLMS)، لكن Moodle تتفوق عليها في السوق المصري لأسباب محددة جدًا.',
        contentEn: 'There are dozens of LMS platforms on the market (Canvas, Blackboard, TalentLMS), but Moodle outperforms them in the Egyptian market for very specific reasons.',
        list: [
          {
            title: 'مفتوحة المصدر = تحكم كامل',
            titleEn: 'Open Source = Full Control',
            content: 'أنت تملك المنصة بالكامل — الكود، البيانات، والمحتوى. لا اشتراكات شهرية مفاجئة ولا قيود على عدد المستخدمين.',
            contentEn: 'You own the platform entirely — the code, data, and content. No surprise monthly subscriptions and no user limits.',
          },
          {
            title: 'دعم عربي كامل (RTL)',
            titleEn: 'Full Arabic Support (RTL)',
            content: 'Moodle تدعم اللغة العربية والواجهة من اليمين لليسار بشكل كامل — أمر حيوي لأي منصة تعليمية في مصر.',
            contentEn: 'Moodle fully supports Arabic language and right-to-left interface — vital for any educational platform in Egypt.',
          },
          {
            title: 'تكامل مع كل أنظمة المؤسسة',
            titleEn: 'Integration with All Institutional Systems',
            content: 'Moodle تتكامل مع أنظمة إدارة الطلاب (SIS)، الموارد البشرية، SCORM، وأدوات المؤتمرات مثل Zoom وBigBlueButton.',
            contentEn: 'Moodle integrates with Student Information Systems (SIS), HR systems, SCORM content, and conferencing tools like Zoom and BigBlueButton.',
          },
          {
            title: 'مجتمع عالمي من 400 مليون مستخدم',
            titleEn: 'Global Community of 400 Million Users',
            content: 'أي مشكلة تواجهها في Moodle، هناك حل موثق وجاهز. المجتمع يضمن استمرارية المنصة وتطورها الدائم.',
            contentEn: 'Any problem you face in Moodle, there\'s a documented solution ready. The community ensures platform continuity and continuous development.',
          },
        ],
      },
      {
        title: 'الفرق بين تثبيت Moodle وتطوير Moodle',
        titleEn: 'The Difference Between Installing Moodle and Developing Moodle',
        content: 'كثير من الشركات تعتقد أن تثبيت Moodle من الموقع الرسمي كافٍ. الواقع مختلف تمامًا — التثبيت هو 10% من العمل فقط.',
        contentEn: 'Many companies believe that installing Moodle from the official site is enough. The reality is completely different — installation is only 10% of the work.',
        list: [
          {
            title: 'تخصيص الهوية البصرية',
            titleEn: 'Visual Identity Customization',
            content: 'المنصة الافتراضية لا تعكس هوية مؤسستك. نبني theme مخصص بالألوان والشعار والتصميم الخاص بك لإعطاء انطباع احترافي.',
            contentEn: 'The default platform doesn\'t reflect your institution\'s identity. We build a custom theme with your colors, logo, and design for a professional impression.',
          },
          {
            title: 'تطوير إضافات مخصصة (Plugins)',
            titleEn: 'Custom Plugin Development',
            content: 'إذا احتجت ميزة غير موجودة في Moodle الأساسية — مثل نظام نقاط، شهادات مخصصة، أو ربط بنظام دفع محلي — نطورها لك.',
            contentEn: 'If you need a feature not in core Moodle — like a points system, custom certificates, or local payment integration — we develop it for you.',
          },
          {
            title: 'أداء عالي للمؤسسات الكبيرة',
            titleEn: 'High Performance for Large Institutions',
            content: 'Moodle الافتراضي لا يتحمل آلاف المستخدمين المتزامنين. نقوم بضبط الخوادم وذاكرة التخزين المؤقت لضمان أداء ممتاز حتى مع 10,000 مستخدم.',
            contentEn: 'Default Moodle can\'t handle thousands of concurrent users. We tune servers and caching to ensure excellent performance even with 10,000 users.',
          },
        ],
      },
      {
        title: 'ميزات Moodle الأساسية للمؤسسات التعليمية',
        titleEn: 'Core Moodle Features for Educational Institutions',
        content: 'قبل أن تقرر، تعرّف على المزايا التي ستحصل عليها فور تطبيق Moodle في مؤسستك.',
        contentEn: 'Before deciding, learn about the features you\'ll get upon implementing Moodle in your institution.',
        list: [
          {
            title: 'إدارة المحتوى التعليمي (SCORM & H5P)',
            titleEn: 'Learning Content Management (SCORM & H5P)',
            content: 'رفع دروس تفاعلية، فيديوهات، اختبارات، ومحتوى SCORM من أي نظام خارجي. Moodle يدعم كل صيغ المحتوى التعليمي.',
            contentEn: 'Upload interactive lessons, videos, quizzes, and SCORM content from any external system. Moodle supports all educational content formats.',
          },
          {
            title: 'تتبع تقدم المتعلم',
            titleEn: 'Learner Progress Tracking',
            content: 'المدرب يرى بالضبط أين وقف كل طالب، ما الدروس التي أكملها، ودرجاته في كل اختبار — في تقارير تفصيلية.',
            contentEn: 'Instructors see exactly where each student stopped, which lessons they completed, and their grades in each quiz — in detailed reports.',
          },
          {
            title: 'شهادات رقمية تلقائية',
            titleEn: 'Automatic Digital Certificates',
            content: 'عند إتمام المتعلم للدورة، تُصدر Moodle شهادة PDF مخصصة باسمه وختم المؤسسة — تلقائيًا وبدون تدخل بشري.',
            contentEn: 'When a learner completes a course, Moodle automatically issues a custom PDF certificate with their name and institution\'s seal — no human intervention needed.',
          },
          {
            title: 'نظام اختبارات متقدم',
            titleEn: 'Advanced Assessment System',
            content: 'اختيار من متعدد، صح وخطأ، مطابقة، مقالي، وأسئلة عشوائية من بنك أسئلة. مع منع الغش من خلال تقييد الوقت وترتيب الأسئلة.',
            contentEn: 'Multiple choice, true/false, matching, essay, and random questions from a question bank. With anti-cheating via time limits and question shuffling.',
          },
        ],
      },
      {
        title: 'خطوات تطبيق Moodle في مؤسستك',
        titleEn: 'Steps to Implement Moodle in Your Institution',
        content: 'تطبيق Moodle يمر بمراحل متسلسلة. إليك الخارطة الكاملة لمشروع ناجح.',
        contentEn: 'Implementing Moodle goes through sequential phases. Here\'s the complete roadmap for a successful project.',
        list: [
          {
            title: 'تحليل الاحتياجات وتخطيط البنية',
            titleEn: 'Needs Analysis and Architecture Planning',
            content: 'نفهم احتياجاتك: كم عدد المستخدمين؟ ما أنواع المحتوى؟ هل تحتاج تكاملًا مع نظام قائم؟ ثم نحدد البنية التقنية المناسبة.',
            contentEn: 'We understand your needs: how many users? What content types? Do you need integration with an existing system? Then we determine the appropriate technical architecture.',
          },
          {
            title: 'التثبيت والتخصيص',
            titleEn: 'Installation and Customization',
            content: 'تثبيت Moodle على خوادم مُحسَّنة للأداء + تطبيق هويتك البصرية + إعداد الأدوار والصلاحيات لكل نوع مستخدم.',
            contentEn: 'Installing Moodle on performance-optimized servers + applying your visual identity + setting up roles and permissions for each user type.',
          },
          {
            title: 'التدريب والإطلاق التجريبي',
            titleEn: 'Training and Pilot Launch',
            content: 'ندرّب فريقك التقني والمدربين والإداريين. ثم نطلق المنصة على مجموعة صغيرة أولًا لرصد المشاكل قبل الإطلاق الكامل.',
            contentEn: 'We train your technical team, instructors, and administrators. Then we launch the platform to a small group first to identify issues before full launch.',
          },
        ],
      },
      {
        title: 'NIT وتجربتها في Moodle منذ 2013',
        titleEn: 'NIT\'s Moodle Experience Since 2013',
        content: 'تجاوزنا 50 منصة Moodle نشطة في مصر والسعودية والإمارات والكويت — للجامعات والمدارس الخاصة وشركات التدريب المؤسسي.',
        contentEn: 'We\'ve deployed over 50 active Moodle platforms in Egypt, Saudi Arabia, UAE, and Kuwait — for universities, private schools, and corporate training companies.',
        list: [
          {
            title: 'منصات حية بآلاف المستخدمين',
            titleEn: 'Live Platforms with Thousands of Users',
            content: 'المنصات التي بنيناها تخدم حاليًا آلاف المتعلمين يوميًا بكفاءة ودون انقطاع. ليست نماذج — هي منصات إنتاجية حقيقية.',
            contentEn: 'The platforms we\'ve built currently serve thousands of learners daily, efficiently and without interruption. These aren\'t mockups — they\'re real production platforms.',
          },
          {
            title: 'تخصيص عميق للسوق العربي',
            titleEn: 'Deep Customization for the Arab Market',
            content: 'نبني Moodle بواجهة عربية أصيلة، نظام RTL محسَّن، ودعم لبوابات الدفع المحلية مثل Fawry لمنصات التعلم المدفوع.',
            contentEn: 'We build Moodle with an authentic Arabic interface, optimized RTL system, and support for local payment gateways like Fawry for paid learning platforms.',
          },
          {
            title: 'دعم تقني متواصل',
            titleEn: 'Continuous Technical Support',
            content: 'فريق الدعم لدينا متاح لمساعدتك في أي مشكلة تواجهها، مع تحديثات دورية للمنصة لضمان الأمان والأداء.',
            contentEn: 'Our support team is available to help you with any issue you face, with regular platform updates to ensure security and performance.',
          },
        ],
      },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────
async function main() {
  for (const art of articles) {
    const { sections, ...articleData } = art;

    // Check if article already exists
    const existing = await prisma.article.findFirst({ where: { title: articleData.title } });
    if (existing) {
      console.log(`  ⏭  Already exists: "${articleData.title.slice(0, 60)}..."`);
      continue;
    }

    const article = await prisma.article.create({ data: articleData });
    console.log(`\n✅ Created article: "${article.title.slice(0, 60)}..."`);
    console.log(`   ID: ${article.id}`);
    console.log(`   URL: /ar/blog/${article.id}  |  /en/blog/${article.id}`);

    for (const sec of sections) {
      const { list, ...secData } = sec;
      await prisma.section.create({
        data: { ...secData, list, articleId: article.id }
      });
      console.log(`   + Section: "${sec.title.slice(0, 50)}"`);
    }
  }

  console.log('\n✅ Done! Now go to the dashboard, edit each article to upload a real hero image.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
