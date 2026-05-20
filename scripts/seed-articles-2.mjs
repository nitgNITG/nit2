/**
 * Seed 8 more SEO articles (4 eCommerce + 4 eLearning)
 * Run: node scripts/seed-articles-2.mjs
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PLACEHOLDER = 'https://res.cloudinary.com/dlrkykxr9/image/upload/f_auto,q_auto/v1/articles/placeholder';

const articles = [

  // ══════════════════════════════════════════════════════════════════
  // eCOMMERCE 2 — Cost of building an eCommerce app
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'تكلفة برمجة تطبيق متجر إلكتروني في مصر 2025 | أرقام حقيقية',
    titleEn: 'Cost of Building an eCommerce App in Egypt 2025 | Real Numbers',
    content: 'تكلفة برمجة تطبيق متجر إلكتروني في مصر تتراوح بين أرقام متفاوتة جدًا — وكثير من أصحاب المشاريع يجدون أنفسهم في حيرة حقيقية أمام هذه الفجوة. في هذا الدليل، نكشف الأرقام الحقيقية والعوامل التي تحدد التكلفة الفعلية لمشروعك.',
    contentEn: 'The cost of building an eCommerce app in Egypt varies widely — and many business owners find themselves genuinely confused by this gap. In this guide, we reveal the real numbers and the factors that determine the actual cost of your project.',
    metaDesc: 'تعرّف على التكلفة الحقيقية لبرمجة تطبيق متجر إلكتروني في مصر 2025 — من التطبيق الأساسي حتى المتجر متعدد البائعين.',
    metaDescEn: 'Discover the real cost of building an eCommerce app in Egypt 2025 — from a basic store to a full multivendor marketplace.',
    img: PLACEHOLDER,
    sections: [
      {
        title: 'لماذا يختلف السعر كثيرًا بين الشركات؟',
        titleEn: 'Why Do Prices Vary So Much Between Companies?',
        content: 'كثير من الشركات تعطيك أسعارًا متضاربة لأن "تطبيق متجر إلكتروني" مصطلح فضفاض — التكلفة الحقيقية تعتمد على خمسة محاور أساسية.',
        contentEn: 'Many companies give wildly different prices because "eCommerce app" is a broad term — the real cost depends on five core factors.',
        list: [
          { title: 'عدد المنصات (iOS فقط أم iOS + Android)', titleEn: 'Number of Platforms (iOS Only or iOS + Android)', content: 'تطوير منصة واحدة أرخص بكثير من الاثنتين. معظم الشركات المصرية تطلق Android أولًا لأنه يمثل 85% من السوق المحلي.', contentEn: 'Developing one platform is much cheaper than both. Most Egyptian businesses launch Android first as it represents 85% of the local market.' },
          { title: 'بوابات الدفع المدمجة', titleEn: 'Integrated Payment Gateways', content: 'كل بوابة دفع (Fawry، Paymob، Stripe) تستغرق وقت تطوير منفصل وتكاليف ترخيص. كلما زادت البوابات، زادت التكلفة.', contentEn: 'Each payment gateway (Fawry, Paymob, Stripe) requires separate development time and licensing costs. More gateways mean higher cost.' },
          { title: 'مستوى تخصيص التصميم', titleEn: 'Level of Design Customization', content: 'القوالب الجاهزة أرخص لكنها تبدو متشابهة. التصميم المخصص بالكامل يعكس هوية علامتك التجارية ويزيد ثقة العميل.', contentEn: 'Ready templates are cheaper but look generic. Fully custom design reflects your brand identity and increases customer trust.' },
        ],
      },
      {
        title: 'جدول تكاليف تطوير تطبيق المتجر — حسب الحجم',
        titleEn: 'eCommerce App Development Cost Table — By Size',
        content: 'إليك تقسيمًا واقعيًا للتكاليف المتوقعة في السوق المصري عام 2025، بناءً على مشاريع حقيقية نفذناها.',
        contentEn: 'Here\'s a realistic cost breakdown expected in the Egyptian market in 2025, based on real projects we\'ve executed.',
        list: [
          { title: 'تطبيق أساسي — متجر واحد', titleEn: 'Basic App — Single Store', content: 'كتالوج منتجات، سلة شراء، بوابة دفع واحدة، لوحة تحكم بسيطة. مناسب للأعمال التي تبدأ رحلتها الرقمية.', contentEn: 'Product catalog, shopping cart, single payment gateway, basic admin panel. Suitable for businesses starting their digital journey.' },
          { title: 'تطبيق متوسط — متجر متكامل', titleEn: 'Mid-range App — Full Store', content: 'كل ما سبق + برامج ولاء، إشعارات ذكية، تتبع طلبات، تقارير مبيعات، ودعم لغتين. مناسب للأعمال المتنامية.', contentEn: 'Everything above + loyalty programs, smart notifications, order tracking, sales reports, and dual-language support. For growing businesses.' },
          { title: 'تطبيق متقدم — multivendor أو POS', titleEn: 'Advanced App — Multivendor or POS', content: 'إدارة بائعين متعددين، عمولات، تكامل كاشير فعلي، API خارجية، وأداء عالي لآلاف المنتجات والمستخدمين.', contentEn: 'Multi-vendor management, commissions, physical POS integration, external APIs, and high performance for thousands of products and users.' },
        ],
      },
      {
        title: 'تكاليف خفية يجب أن تعرفها قبل التعاقد',
        titleEn: 'Hidden Costs You Must Know Before Signing',
        content: 'كثير من العملاء يصطدمون بتكاليف غير متوقعة بعد الإطلاق. هذه أشهرها وكيف تتجنبها.',
        contentEn: 'Many clients face unexpected costs after launch. Here are the most common ones and how to avoid them.',
        list: [
          { title: 'رسوم Google Play و App Store السنوية', titleEn: 'Annual Google Play and App Store Fees', content: 'Google Play: 25 دولار مرة واحدة. Apple Developer: 99 دولار سنويًا. هذه تكاليف ثابتة مستقلة عن شركة التطوير.', contentEn: 'Google Play: $25 one-time. Apple Developer: $99/year. These are fixed costs independent of the development company.' },
          { title: 'رسوم استضافة الخادم الشهرية', titleEn: 'Monthly Server Hosting Fees', content: 'التطبيق يحتاج خادمًا لتشغيل API والبيانات. تأكد أن العقد يوضح من يدفع الاستضافة وبكم شهريًا.', contentEn: 'The app needs a server to run the API and data. Ensure the contract clarifies who pays hosting and how much monthly.' },
          { title: 'تحديثات iOS و Android السنوية', titleEn: 'Annual iOS and Android Updates', content: 'Apple و Google يغيران متطلبات المتاجر سنويًا. التطبيق يحتاج تحديثات إلزامية وإلا يُوقَف. تأكد من وجود عقد صيانة.', contentEn: 'Apple and Google change store requirements annually. Apps need mandatory updates or they get removed. Ensure you have a maintenance contract.' },
        ],
      },
      {
        title: 'كيف تقارن عروض الأسعار بشكل صحيح؟',
        titleEn: 'How to Compare Quotes Correctly?',
        content: 'أقل سعر ليس دائمًا الأفضل. إليك الأسئلة التي يجب أن تطرحها على كل شركة قبل أن تختار.',
        contentEn: 'The lowest price is not always the best. Here are the questions you must ask every company before choosing.',
        list: [
          { title: 'هل السعر يشمل iOS وAndroid معًا؟', titleEn: 'Does the Price Include Both iOS and Android?', content: 'بعض الشركات تعطيك سعر Android فقط ثم تطلب ضعف المبلغ لإضافة iOS. وضّح هذا من البداية.', contentEn: 'Some companies quote Android only then ask double for iOS. Clarify this upfront.' },
          { title: 'ما مدة الضمان بعد التسليم؟', titleEn: 'What Is the Warranty Period After Delivery?', content: 'الشركة الموثوقة تمنحك 3 أشهر على الأقل لإصلاح أي خطأ تقني بعد الإطلاق بدون تكلفة إضافية.', contentEn: 'A reliable company gives you at least 3 months to fix any technical bug after launch at no extra cost.' },
          { title: 'من يملك الكود بعد التسليم؟', titleEn: 'Who Owns the Code After Delivery?', content: 'يجب أن تنص العقود صراحةً على أن الكود المصدري ملكك بالكامل بعد اكتمال الدفع. لا تقبل غير ذلك.', contentEn: 'Contracts must explicitly state that the source code is fully yours after payment completion. Accept nothing less.' },
        ],
      },
      {
        title: 'لماذا تُعدّ NIT الخيار الأمثل من حيث التكلفة والجودة في مصر؟',
        titleEn: 'Why NIT Is the Best Value Choice in Egypt?',
        content: 'نحن لا نقدم أرخص سعر في السوق — نقدم أفضل قيمة: تطبيقات حية، فريق متخصص، وعقود شفافة.',
        contentEn: 'We don\'t offer the cheapest price in the market — we offer the best value: live apps, specialized team, and transparent contracts.',
        list: [
          { title: 'سعر واضح شامل بدون مفاجآت', titleEn: 'Clear All-inclusive Price, No Surprises', content: 'عرضنا يشمل iOS + Android + لوحة تحكم + بوابة دفع + استضافة السنة الأولى — كل شيء في رقم واحد شفاف.', contentEn: 'Our quote includes iOS + Android + admin panel + payment gateway + first-year hosting — everything in one transparent number.' },
          { title: 'مشاريع حية يمكنك تجربتها الآن', titleEn: 'Live Projects You Can Try Right Now', content: 'قبل أن تتعاقد، حمّل تطبيقاتنا من المتاجر وجرّبها بنفسك. لدينا تطبيقات يستخدمها آلاف العملاء يوميًا.', contentEn: 'Before signing, download our apps from the stores and try them yourself. We have apps used by thousands of customers daily.' },
          { title: 'عقد صيانة سنوي بسعر ثابت', titleEn: 'Annual Maintenance Contract at Fixed Price', content: 'نقدم عقد صيانة سنوي يشمل تحديثات المتجرين، إصلاح الأخطاء، وإضافة ميزة صغيرة كل ربع سنة — بدون مفاجآت.', contentEn: 'We offer an annual maintenance contract covering store updates, bug fixes, and one small feature addition per quarter — no surprises.' },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // eCOMMERCE 3 — Payment Gateways Egypt
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'أفضل بوابات الدفع الإلكتروني في مصر للمتاجر الإلكترونية 2025',
    titleEn: 'Best Payment Gateways in Egypt for eCommerce Stores 2025',
    content: 'اختيار بوابة الدفع المناسبة لمتجرك الإلكتروني في مصر قد يكون الفرق بين نجاح المتجر وفشله. في هذا المقال، نقارن بين أبرز بوابات الدفع المتاحة في السوق المصري لعام 2025 ونساعدك على اختيار الأنسب لعملك.',
    contentEn: 'Choosing the right payment gateway for your eCommerce store in Egypt can be the difference between the store\'s success and failure. In this article, we compare the most prominent payment gateways available in the Egyptian market for 2025 and help you choose the most suitable for your business.',
    metaDesc: 'مقارنة شاملة لأفضل بوابات الدفع الإلكتروني في مصر 2025 — Fawry وPaymob وKashier وStripe — الرسوم والمميزات والتكامل.',
    metaDescEn: 'Comprehensive comparison of the best payment gateways in Egypt 2025 — Fawry, Paymob, Kashier and Stripe — fees, features and integration.',
    img: PLACEHOLDER,
    sections: [
      {
        title: 'لماذا اختيار بوابة الدفع الصحيحة حاسم لنجاح متجرك؟',
        titleEn: 'Why Choosing the Right Payment Gateway Is Critical for Your Store\'s Success?',
        content: '70% من عمليات الشراء تُلغى عند الدفع بسبب واجهة معقدة أو بوابة غير موثوقة. بوابة الدفع هي القلب النابض لأي متجر إلكتروني.',
        contentEn: '70% of purchases are abandoned at checkout due to a complex interface or unreliable gateway. The payment gateway is the beating heart of any eCommerce store.',
        list: [
          { title: 'الثقة = الإتمام', titleEn: 'Trust = Completion', content: 'العميل المصري يفضل البوابات التي يعرفها مثل Fawry. عرض شعار بوابة موثوقة يرفع معدل إتمام الشراء 25%.', contentEn: 'Egyptian customers prefer gateways they know like Fawry. Displaying a trusted gateway logo increases checkout completion by 25%.' },
          { title: 'تنوع طرق الدفع = مبيعات أكثر', titleEn: 'Multiple Payment Methods = More Sales', content: 'بعض العملاء لا يملكون بطاقات بنكية. Fawry يتيح الدفع نقدًا من أي محل — وصوله يعني وصولك لشريحة أوسع.', contentEn: 'Some customers don\'t have bank cards. Fawry allows cash payment from any outlet — its reach means reaching a wider audience.' },
          { title: 'سرعة التحويل = سيولة أفضل', titleEn: 'Transfer Speed = Better Cash Flow', content: 'بعض البوابات تحجز الأموال أسبوعًا أو أكثر. اختر بوابة تحوّل أرباحك في 24-48 ساعة للحفاظ على سيولة عملك.', contentEn: 'Some gateways hold funds for a week or more. Choose a gateway that transfers your earnings in 24-48 hours to maintain business liquidity.' },
        ],
      },
      {
        title: 'Fawry — الأوسع انتشارًا في مصر',
        titleEn: 'Fawry — The Most Widely Used in Egypt',
        content: 'فوري هو الأكثر استخدامًا في مصر بفضل شبكة تزيد عن 300,000 نقطة دفع وتغطية تصل إلى 97% من الأسر المصرية.',
        contentEn: 'Fawry is the most used in Egypt thanks to a network of over 300,000 payment points and coverage reaching 97% of Egyptian households.',
        list: [
          { title: 'مميزاته', titleEn: 'Advantages', content: 'دفع نقدي من أي محل، بطاقات بنكية، محفظة إلكترونية. معروف لدى جميع شرائح العملاء المصريين.', contentEn: 'Cash payment from any outlet, bank cards, e-wallet. Known to all segments of Egyptian customers.' },
          { title: 'عيوبه', titleEn: 'Disadvantages', content: 'لا يدعم المدفوعات الدولية. رسوم المعاملات أعلى قليلًا من المنافسين. واجهة الـ API تحتاج خبرة تقنية للتكامل.', contentEn: 'Doesn\'t support international payments. Transaction fees are slightly higher than competitors. API integration requires technical expertise.' },
          { title: 'الأنسب له', titleEn: 'Best For', content: 'المتاجر التي تستهدف السوق المصري بالكامل وتريد وصولًا أقصى — خاصة شرائح عملاء من خارج المدن الكبرى.', contentEn: 'Stores targeting the full Egyptian market wanting maximum reach — especially customer segments outside major cities.' },
        ],
      },
      {
        title: 'Paymob — المفضّل للشركات التقنية',
        titleEn: 'Paymob — Preferred by Tech Companies',
        content: 'Paymob هو الأكثر شيوعًا بين شركات التجارة الإلكترونية الناشئة في مصر نظرًا لسهولة تكاملها وخصائصها التقنية المتقدمة.',
        contentEn: 'Paymob is the most popular among Egypt\'s emerging eCommerce companies due to its easy integration and advanced technical features.',
        list: [
          { title: 'مميزاته', titleEn: 'Advantages', content: 'API مرنة وتوثيق ممتاز، يدعم Apple Pay وGoogle Pay، لوحة تحكم احترافية للتقارير والمبيعات.', contentEn: 'Flexible API with excellent documentation, supports Apple Pay and Google Pay, professional dashboard for reports and sales.' },
          { title: 'رسوم المعاملات', titleEn: 'Transaction Fees', content: 'رسوم تنافسية تبدأ من 2.75% للبطاقات. لا رسوم شهرية ثابتة للشركات الصغيرة — تدفع فقط على كل معاملة.', contentEn: 'Competitive fees starting from 2.75% for cards. No fixed monthly fees for small businesses — you only pay per transaction.' },
          { title: 'الأنسب له', titleEn: 'Best For', content: 'الشركات الناشئة والمتاجر المتوسطة التي تحتاج تكاملًا سريعًا وأدوات تحليل احترافية.', contentEn: 'Startups and mid-size stores needing fast integration and professional analytics tools.' },
        ],
      },
      {
        title: 'Kashier و Stripe — للتوسع الدولي',
        titleEn: 'Kashier and Stripe — For International Expansion',
        content: 'إذا كان عملاؤك خارج مصر أو في الخليج، تحتاج بوابة تقبل البطاقات الدولية ولا تقيدك جغرافيًا.',
        contentEn: 'If your customers are outside Egypt or in the Gulf, you need a gateway that accepts international cards without geographic restrictions.',
        list: [
          { title: 'Kashier — للسوق المصري والخليجي', titleEn: 'Kashier — For Egypt and Gulf Markets', content: 'يدعم الجنيه المصري والريال السعودي والدرهم الإماراتي. مثالي للمتاجر التي تعمل في أكثر من سوق عربي.', contentEn: 'Supports Egyptian Pound, Saudi Riyal and UAE Dirham. Ideal for stores operating in more than one Arab market.' },
          { title: 'Stripe — للتوسع العالمي', titleEn: 'Stripe — For Global Expansion', content: 'يقبل 135+ عملة ومتاح في 46 دولة. مثالي إذا كنت تبيع لعملاء أوروبيين أو أمريكيين أيضًا.', contentEn: 'Accepts 135+ currencies and available in 46 countries. Ideal if you also sell to European or American customers.' },
          { title: 'الجمع بين بوابتين', titleEn: 'Combining Two Gateways', content: 'الحل الأمثل: Fawry أو Paymob للسوق المحلي + Stripe أو Kashier للعملاء الدوليين. نطوّر هذا التكامل في متجرك بسهولة.', contentEn: 'The ideal solution: Fawry or Paymob for local market + Stripe or Kashier for international customers. We develop this integration in your store easily.' },
        ],
      },
      {
        title: 'كيف تدمج بوابة الدفع بشكل صحيح في تطبيقك؟',
        titleEn: 'How to Correctly Integrate a Payment Gateway in Your App?',
        content: 'التكامل الخاطئ يسبب فشل المدفوعات وخسارة العملاء. إليك المعايير التقنية التي نلتزم بها في كل مشروع.',
        contentEn: 'Incorrect integration causes payment failures and customer loss. Here are the technical standards we follow in every project.',
        list: [
          { title: 'اختبار شامل قبل الإطلاق', titleEn: 'Comprehensive Testing Before Launch', content: 'نجري مئات من المعاملات التجريبية قبل الإطلاق لضمان عمل البوابة في كل الحالات — الدفع الناجح، الفاشل، والمُعلَّق.', contentEn: 'We run hundreds of test transactions before launch to ensure the gateway works in all scenarios — successful, failed, and pending payments.' },
          { title: 'تشفير SSL وPCI DSS', titleEn: 'SSL Encryption and PCI DSS Compliance', content: 'كل بيانات الدفع تمر عبر تشفير SSL. نلتزم بمعايير PCI DSS لحماية بيانات بطاقات عملائك.', contentEn: 'All payment data passes through SSL encryption. We comply with PCI DSS standards to protect your customers\' card data.' },
          { title: 'استرداد تلقائي للمدفوعات الفاشلة', titleEn: 'Automatic Recovery for Failed Payments', content: 'نبني نظام إعادة محاولة ذكي: إذا فشلت المعاملة، يُعيد التطبيق المحاولة تلقائيًا بطريقة مختلفة قبل إخبار العميل بالفشل.', contentEn: 'We build a smart retry system: if a transaction fails, the app automatically retries with a different method before informing the customer of failure.' },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // eCOMMERCE 4 — Shopify vs Custom App
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'Shopify أم تطبيق مخصص؟ أيهما الأنسب لمتجرك في مصر 2025',
    titleEn: 'Shopify vs Custom App: Which Is Better for Your Store in Egypt 2025?',
    content: 'السؤال الأكثر تكرارًا من أصحاب المتاجر في مصر: هل أبدأ بـ Shopify أم أبني تطبيقًا مخصصًا من البداية؟ الإجابة تعتمد على مرحلة عملك وأهدافك — وفي هذا المقال نساعدك على اتخاذ القرار الصحيح.',
    contentEn: 'The most repeated question from store owners in Egypt: should I start with Shopify or build a custom app from the start? The answer depends on your business stage and goals — and in this article we help you make the right decision.',
    metaDesc: 'مقارنة Shopify مقابل تطبيق تجارة إلكترونية مخصص في مصر — التكلفة والتحكم والمرونة وأيهما يناسب حجم عملك.',
    metaDescEn: 'Shopify vs custom eCommerce app in Egypt — cost, control, flexibility and which suits your business size.',
    img: PLACEHOLDER,
    sections: [
      {
        title: 'ما الفرق الجوهري بين Shopify والتطبيق المخصص؟',
        titleEn: 'What Is the Fundamental Difference Between Shopify and a Custom App?',
        content: 'Shopify حل جاهز تستأجره شهريًا. التطبيق المخصص حل تمتلكه بالكامل. كلاهما له مكانه الصحيح — المهم أن تختار المناسب لمرحلة عملك.',
        contentEn: 'Shopify is a ready solution you rent monthly. A custom app is a solution you own entirely. Both have their place — what matters is choosing the right one for your business stage.',
        list: [
          { title: 'Shopify: ابدأ سريعًا', titleEn: 'Shopify: Start Fast', content: 'يمكنك إطلاق متجر على Shopify في 48 ساعة. مناسب جدًا لاختبار فكرتك في السوق قبل الاستثمار الكبير.', contentEn: 'You can launch a Shopify store in 48 hours. Very suitable for testing your idea in the market before major investment.' },
          { title: 'التطبيق المخصص: امتلك الكل', titleEn: 'Custom App: Own Everything', content: 'أنت تملك الكود، البيانات، والتصميم. لا قيود على المميزات ولا رسوم شهرية متزايدة مع نمو المبيعات.', contentEn: 'You own the code, data, and design. No feature restrictions and no increasing monthly fees as sales grow.' },
          { title: 'الهجين: ابدأ بـ Shopify وانتقل لاحقًا', titleEn: 'Hybrid: Start with Shopify, Migrate Later', content: 'استراتيجية ذكية: أطلق على Shopify، ثم حين يصل مبيعاتك 500,000 جنيه شهريًا، انتقل لتطبيق مخصص يوفر عليك رسوم Shopify.', contentEn: 'Smart strategy: launch on Shopify, then when sales reach EGP 500,000/month, migrate to a custom app that saves you Shopify fees.' },
        ],
      },
      {
        title: 'متى يكون Shopify هو الاختيار الصحيح؟',
        titleEn: 'When Is Shopify the Right Choice?',
        content: 'Shopify ليس للجميع، لكنه مثالي في حالات معينة جدًا. إليك متى يكون الاختيار الأمثل.',
        contentEn: 'Shopify isn\'t for everyone, but it\'s ideal in very specific cases. Here\'s when it\'s the best choice.',
        list: [
          { title: 'المشاريع في مرحلة الاختبار', titleEn: 'Projects in Testing Phase', content: 'إذا لم تتحقق من الطلب على منتجك بعد، Shopify يتيح لك الاختبار بتكلفة منخفضة قبل الالتزام بتطوير مخصص.', contentEn: 'If you haven\'t validated your product demand yet, Shopify lets you test at low cost before committing to custom development.' },
          { title: 'الميزانية المحدودة في البداية', titleEn: 'Limited Budget at Start', content: 'رسوم Shopify الشهرية أقل بكثير من تكلفة التطوير المخصص. إذا كانت ميزانيتك محدودة، ابدأ بـ Shopify واستثمر الفرق في التسويق.', contentEn: 'Monthly Shopify fees are much less than custom development costs. If your budget is tight, start with Shopify and invest the difference in marketing.' },
          { title: 'المنتجات البسيطة والكتالوجات الصغيرة', titleEn: 'Simple Products and Small Catalogs', content: 'إذا كان متجرك يبيع أقل من 200 منتج بدون تعقيدات خاصة، Shopify كافٍ تمامًا ولا داعي لتطوير مخصص.', contentEn: 'If your store sells fewer than 200 products without special complexities, Shopify is perfectly sufficient and custom development is unnecessary.' },
        ],
      },
      {
        title: 'متى تحتاج تطبيقًا مخصصًا بالتأكيد؟',
        titleEn: 'When Do You Definitely Need a Custom App?',
        content: 'هناك سيناريوهات لا يستطيع فيها Shopify تلبية احتياجاتك — وهنا يصبح التطوير المخصص ضرورة لا رفاهية.',
        contentEn: 'There are scenarios where Shopify simply can\'t meet your needs — here custom development becomes a necessity, not a luxury.',
        list: [
          { title: 'متجر متعدد البائعين (Marketplace)', titleEn: 'Multi-vendor Marketplace', content: 'Shopify لا يدعم نموذج الـ marketplace بشكل أصيل. إذا أردت منصة مثل Jumia أو Noon، تحتاج تطويرًا مخصصًا بالكامل.', contentEn: 'Shopify doesn\'t natively support the marketplace model. If you want a platform like Jumia or Noon, you need fully custom development.' },
          { title: 'متطلبات عربية متقدمة', titleEn: 'Advanced Arabic Requirements', content: 'Shopify يدعم العربية لكن بحدود. إذا احتجت RTL كاملًا، فواتير عربية، أو تكاملًا مع ERP محلي — التطوير المخصص أفضل.', contentEn: 'Shopify supports Arabic but with limits. If you need full RTL, Arabic invoices, or integration with a local ERP — custom development is better.' },
          { title: 'حجم مبيعات كبير (رسوم Shopify تتراكم)', titleEn: 'High Sales Volume (Shopify Fees Accumulate)', content: 'Shopify يأخذ نسبة من كل بيعة. عند مبيعات 1 مليون جنيه شهريًا، رسوم Shopify السنوية تكفي لتمويل تطبيق مخصص بالكامل.', contentEn: 'Shopify takes a percentage of every sale. At EGP 1 million monthly sales, annual Shopify fees are enough to fund a fully custom app.' },
        ],
      },
      {
        title: 'جدول المقارنة الكاملة: Shopify مقابل التطبيق المخصص',
        titleEn: 'Full Comparison Table: Shopify vs Custom App',
        content: 'إليك مقارنة موضوعية تساعدك على اتخاذ القرار الصحيح بناءً على وضعك الفعلي.',
        contentEn: 'Here\'s an objective comparison to help you make the right decision based on your actual situation.',
        list: [
          { title: 'التكلفة الأولية', titleEn: 'Initial Cost', content: 'Shopify: منخفضة (اشتراك شهري). التطبيق المخصص: أعلى في البداية لكن لا رسوم متكررة تأكل أرباحك.', contentEn: 'Shopify: Low (monthly subscription). Custom app: Higher upfront but no recurring fees eating your profits.' },
          { title: 'التحكم والمرونة', titleEn: 'Control and Flexibility', content: 'Shopify: محدود بما تسمح به المنصة. التطبيق المخصص: تحكم كامل في كل شيء — التصميم، المنطق، والبيانات.', contentEn: 'Shopify: Limited to what the platform allows. Custom app: Full control over everything — design, logic, and data.' },
          { title: 'الوقت للإطلاق', titleEn: 'Time to Launch', content: 'Shopify: أيام. التطبيق المخصص: 2-4 أشهر حسب التعقيد. لكن التطبيق المخصص ينمو معك بلا قيود.', contentEn: 'Shopify: Days. Custom app: 2-4 months depending on complexity. But the custom app grows with you without limits.' },
        ],
      },
      {
        title: 'NIT تساعدك في كلا المسارين',
        titleEn: 'NIT Helps You in Both Paths',
        content: 'سواء قررت البدء بـ Shopify أو تطوير تطبيق مخصص من البداية، فريقنا يرشدك للقرار الأنسب لمرحلتك الحالية.',
        contentEn: 'Whether you decide to start with Shopify or build a custom app from scratch, our team guides you to the best decision for your current phase.',
        list: [
          { title: 'استشارة مجانية لتحديد المسار', titleEn: 'Free Consultation to Determine the Path', content: 'نحلل مشروعك: الميزانية، حجم المنتجات، السوق المستهدف، والتوقعات — ثم نوصي بالحل الأنسب بصدق وشفافية.', contentEn: 'We analyze your project: budget, product volume, target market, and expectations — then honestly and transparently recommend the best solution.' },
          { title: 'هجرة من Shopify لتطبيق مخصص', titleEn: 'Migration from Shopify to Custom App', content: 'إذا كنت على Shopify وتريد الانتقال، نهاجر منتجاتك وبيانات عملائك وتاريخ الطلبات بالكامل بدون فقدان أي بيانات.', contentEn: 'If you\'re on Shopify and want to migrate, we migrate your products, customer data, and order history completely without losing any data.' },
          { title: 'تطوير على كلا المنصتين', titleEn: 'Development on Both Platforms', content: 'فريقنا يطور Shopify apps ويبني تطبيقات مخصصة من الصفر. خبرة شاملة تضمن لك أفضل نتيجة بأي مسار تختاره.', contentEn: 'Our team develops Shopify apps and builds custom apps from scratch. Comprehensive experience guarantees you the best outcome whichever path you choose.' },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // eCOMMERCE 5 — How to Boost Online Store Sales with Mobile App
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'كيف تزيد مبيعات متجرك الإلكتروني بتطبيق جوال في مصر 2025',
    titleEn: 'How to Boost Your Online Store Sales with a Mobile App in Egypt 2025',
    content: 'المتاجر الإلكترونية التي أضافت تطبيق جوال شهدت في المتوسط نموًا بنسبة 54% في مبيعاتها خلال السنة الأولى. في هذا المقال، نشرح الاستراتيجيات المجربة التي تجعل تطبيقك أداة مبيعات حقيقية لا مجرد امتداد للموقع.',
    contentEn: 'eCommerce stores that added a mobile app saw an average 54% growth in sales during the first year. In this article, we explain the proven strategies that make your app a real sales tool, not just an extension of the website.',
    metaDesc: 'استراتيجيات مجربة لزيادة مبيعات المتجر الإلكتروني في مصر عبر تطبيق جوال — إشعارات، ولاء، وتجربة مستخدم محسّنة.',
    metaDescEn: 'Proven strategies to boost online store sales in Egypt via mobile app — push notifications, loyalty programs, and improved UX.',
    img: PLACEHOLDER,
    sections: [
      {
        title: 'لماذا التطبيق يبيع أكثر من الموقع الإلكتروني؟',
        titleEn: 'Why Does the App Sell More Than the Website?',
        content: 'ليس رأيًا — أرقام: متاجر التجارة الإلكترونية التي أضافت تطبيقًا شهدت نموًا بمتوسط 54% في المبيعات خلال السنة الأولى.',
        contentEn: 'Not an opinion — numbers: eCommerce stores that added an app saw an average 54% growth in sales in the first year.',
        list: [
          { title: 'التطبيق دائمًا على شاشة العميل', titleEn: 'The App Is Always on the Customer\'s Screen', content: 'أيقونة تطبيقك على هاتف العميل تذكيره المستمر بعلامتك التجارية. الموقع يُنسى فور إغلاق المتصفح.', contentEn: 'Your app icon on the customer\'s phone is a constant reminder of your brand. The website is forgotten the moment the browser closes.' },
          { title: 'سرعة التحميل تضاعف معدل التحويل', titleEn: 'Loading Speed Doubles Conversion Rate', content: 'التطبيق يحمّل بيانات المنتجات مسبقًا ويخزنها محليًا. الصفحة تفتح خلال أجزاء من الثانية مقارنة بثوانٍ للموقع.', contentEn: 'The app preloads and stores product data locally. Pages open in fractions of a second compared to seconds for the website.' },
          { title: 'الدفع بضغطة واحدة', titleEn: 'One-tap Payment', content: 'العميل يضغط زر واحد ويُتم الدفع ببيانات محفوظة مسبقًا. هذا وحده يرفع معدل إتمام الطلبات 35-40%.', contentEn: 'The customer presses one button and completes payment with pre-saved data. This alone raises order completion by 35-40%.' },
        ],
      },
      {
        title: 'استراتيجيات الإشعارات الذكية لزيادة المبيعات',
        titleEn: 'Smart Notification Strategies to Increase Sales',
        content: 'الإشعارات الفورية هي أقوى أداة تسويقية في التطبيق — إذا استُخدمت بذكاء. إليك الاستراتيجيات التي تعمل في السوق المصري.',
        contentEn: 'Push notifications are the most powerful marketing tool in the app — when used intelligently. Here are the strategies that work in the Egyptian market.',
        list: [
          { title: 'إشعار السلة المتروكة', titleEn: 'Abandoned Cart Notification', content: 'العميل أضاف منتجًا وغادر؟ أرسل له إشعارًا بعد ساعتين: "منتجك في الانتظار — أكمل طلبك الآن". معدل الاسترداد يصل 15%.', contentEn: 'Customer added a product and left? Send a notification after 2 hours: "Your item is waiting — complete your order now." Recovery rate reaches 15%.' },
          { title: 'إشعارات العروض الشخصية', titleEn: 'Personalized Offer Notifications', content: 'بناءً على تاريخ الشراء، أرسل عروضًا مخصصة: عميل اشترى هاتفًا؟ أرسله عرضًا على الإكسسوارات. الاستهداف الذكي يرفع نسبة الشراء 3 أضعاف.', contentEn: 'Based on purchase history, send personalized offers: customer bought a phone? Send them an accessories offer. Smart targeting triples purchase rates.' },
          { title: 'إشعارات العودة للمستخدمين الخاملين', titleEn: 'Re-engagement Notifications for Dormant Users', content: 'العميل لم يفتح التطبيق 30 يومًا؟ أرسل له: "اشتقنا إليك — خصم 15% على أول طلب جديد". هذه الإشعارات تُعيد 8-12% من المستخدمين الخاملين.', contentEn: 'Customer hasn\'t opened the app in 30 days? Send: "We miss you — 15% off your next order." These re-engage 8-12% of dormant users.' },
        ],
      },
      {
        title: 'برامج الولاء — أقوى أداة للاحتفاظ بالعملاء',
        titleEn: 'Loyalty Programs — The Most Powerful Customer Retention Tool',
        content: 'العميل المحتفظ به أرخص 7 أضعاف من اكتساب عميل جديد. برامج الولاء المدمجة في التطبيق تحوّل المشتري مرة إلى عميل دائم.',
        contentEn: 'A retained customer is 7x cheaper than acquiring a new one. Loyalty programs built into the app turn one-time buyers into permanent customers.',
        list: [
          { title: 'نظام النقاط التراكمية', titleEn: 'Cumulative Points System', content: 'كل شراء يمنح العميل نقاطًا يستبدلها بخصومات أو منتجات مجانية. هذا وحده يرفع تكرار الشراء 40% في المتوسط.', contentEn: 'Every purchase gives the customer points redeemable for discounts or free products. This alone raises repeat purchases by 40% on average.' },
          { title: 'مستويات العضوية (Bronze, Silver, Gold)', titleEn: 'Membership Tiers (Bronze, Silver, Gold)', content: 'العميل يسعى للترقي للمستوى الأعلى للحصول على مزايا حصرية. هذا يخلق دافعًا نفسيًا قويًا للشراء المتكرر.', contentEn: 'The customer strives to upgrade to a higher tier for exclusive benefits. This creates a powerful psychological motivation for repeat purchases.' },
          { title: 'نظام الإحالة (Referral)', titleEn: 'Referral System', content: 'عميلك يجلب لك عميلًا جديدًا مقابل نقاط أو خصم. التسويق بالإحالة أرخص وأفضل تحويلًا من أي إعلان مدفوع.', contentEn: 'Your customer brings you a new customer in exchange for points or a discount. Referral marketing is cheaper and better converting than any paid ad.' },
        ],
      },
      {
        title: 'تحسين تجربة المستخدم لرفع معدل التحويل',
        titleEn: 'Improving User Experience to Increase Conversion Rate',
        content: 'التصميم الجيد ليس رفاهية — هو استثمار مباشر في زيادة المبيعات. إليك المبادئ التي نطبقها في كل تطبيق نبنيه.',
        contentEn: 'Good design is not a luxury — it\'s a direct investment in increasing sales. Here are the principles we apply in every app we build.',
        list: [
          { title: 'البحث الذكي بالعربية', titleEn: 'Smart Search in Arabic', content: 'بحث يفهم الأخطاء الإملائية والمرادفات العربية. العميل يجد ما يريد بسهولة = يشتري بسهولة.', contentEn: 'Search that understands spelling errors and Arabic synonyms. Customer finds what they want easily = buys easily.' },
          { title: 'صور منتجات بزوم عالي الجودة', titleEn: 'High-quality Product Zoom Images', content: 'العميل لا يستطيع لمس المنتج. صور متعددة الزوايا وتكبير عالي الجودة تحل هذه المشكلة وترفع الثقة في الشراء.', contentEn: 'The customer can\'t touch the product. Multi-angle images with high-quality zoom solve this problem and increase purchase confidence.' },
          { title: 'دفع سريع بخطوة واحدة (One-step Checkout)', titleEn: 'Fast One-step Checkout', content: 'كل خطوة إضافية في عملية الدفع تفقدك 10% من العملاء. الدفع بخطوة واحدة هو المعيار الذهبي لرفع معدل الإتمام.', contentEn: 'Every additional checkout step loses you 10% of customers. One-step checkout is the gold standard for raising completion rates.' },
        ],
      },
      {
        title: 'NIT تبني لك تطبيقًا يبيع — لا مجرد تطبيق جميل',
        titleEn: 'NIT Builds You an App That Sells — Not Just a Pretty App',
        content: 'نركز على نتيجة واحدة: رفع مبيعاتك. كل قرار تصميمي وتقني نتخذه مبني على بيانات وتجارب حقيقية من متاجر تعمل الآن.',
        contentEn: 'We focus on one outcome: increasing your sales. Every design and technical decision we make is based on real data and experiences from currently operating stores.',
        list: [
          { title: 'تحليل بيانات ما بعد الإطلاق', titleEn: 'Post-launch Data Analysis', content: 'نتابع معك أداء التطبيق بعد الإطلاق: معدل التحويل، الصفحات التي يغادر منها العملاء، والمنتجات الأكثر مشاهدة.', contentEn: 'We monitor with you the app\'s performance after launch: conversion rate, pages customers leave from, and most-viewed products.' },
          { title: 'تحسينات مستمرة بناءً على البيانات', titleEn: 'Continuous Improvements Based on Data', content: 'التطبيق ليس منتجًا نهائيًا — هو منتج حيّ يتطور. نحلل البيانات ونقترح تحسينات ربع سنوية ترفع مبيعاتك تدريجيًا.', contentEn: 'The app is not a final product — it\'s a living product that evolves. We analyze data and suggest quarterly improvements that gradually increase your sales.' },
          { title: 'ضمان رفع المبيعات خلال 6 أشهر', titleEn: 'Sales Growth Guarantee Within 6 Months', content: 'نلتزم بأن يرى عملاؤنا نموًا ملحوظًا في المبيعات خلال 6 أشهر من إطلاق التطبيق — وإلا نعمل معك مجانًا حتى تتحقق النتيجة.', contentEn: 'We commit that our clients see noticeable sales growth within 6 months of app launch — otherwise we work with you for free until the result is achieved.' },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // eLEARNING 2 — Cost of building an eLearning platform
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'تكلفة إنشاء منصة تعليمية إلكترونية في مصر 2025 | دليل الأسعار الحقيقية',
    titleEn: 'Cost of Building an eLearning Platform in Egypt 2025 | Real Pricing Guide',
    content: 'أحد أكثر الأسئلة التي تردنا: "كم تكلفة إنشاء منصة تعليمية؟" — والإجابة الصادقة: يعتمد. لكن في هذا الدليل نكسر الغموض ونعطيك أرقامًا حقيقية من مشاريع نفذناها في مصر والخليج.',
    contentEn: 'One of the most frequent questions we receive: "How much does an eLearning platform cost?" — the honest answer: it depends. But in this guide we break the ambiguity and give you real numbers from projects we\'ve executed in Egypt and the Gulf.',
    metaDesc: 'دليل شامل لتكلفة إنشاء منصة تعليمية إلكترونية في مصر 2025 — Moodle، منصة مخصصة، الاستضافة، والصيانة.',
    metaDescEn: 'Comprehensive guide to eLearning platform costs in Egypt 2025 — Moodle, custom platform, hosting, and maintenance.',
    img: PLACEHOLDER,
    sections: [
      {
        title: 'لماذا يختلف سعر المنصة التعليمية كثيرًا بين الشركات؟',
        titleEn: 'Why Do eLearning Platform Prices Vary So Much Between Companies?',
        content: '"منصة تعليمية" يمكن أن تعني موقع بسيط بكورس واحد أو منصة معقدة تخدم 50,000 طالب. الفارق في التكلفة ضخم — وهذا طبيعي.',
        contentEn: '"eLearning platform" can mean a simple site with one course or a complex platform serving 50,000 students. The cost difference is huge — and that\'s natural.',
        list: [
          { title: 'حجم قاعدة المستخدمين المستهدفة', titleEn: 'Target User Base Size', content: 'منصة لـ 500 طالب تختلف تمامًا في البنية التقنية عن منصة لـ 50,000 طالب متزامن. الخوادم والتحسينات تختلف جذريًا.', contentEn: 'A platform for 500 students is technically completely different from one for 50,000 concurrent students. Servers and optimizations differ radically.' },
          { title: 'المحتوى التفاعلي وأنواعه', titleEn: 'Interactive Content and Its Types', content: 'منصة فيديو فقط أبسط من منصة تدعم SCORM، H5P، اختبارات تكيفية، وغرف تدريب مباشر (Live Sessions).', contentEn: 'A video-only platform is simpler than one supporting SCORM, H5P, adaptive assessments, and live training rooms.' },
          { title: 'درجة التخصيص المطلوبة', titleEn: 'Required Level of Customization', content: 'Moodle الجاهزة بتخصيص بسيط أرخص بكثير من منصة مبنية من الصفر بنظام نقاط مخصص وشهادات وربط بنظام دفع محلي.', contentEn: 'Standard Moodle with simple customization is much cheaper than a platform built from scratch with a custom points system, certificates, and local payment integration.' },
        ],
      },
      {
        title: 'تكلفة منصة Moodle في مصر — الأرقام الواقعية',
        titleEn: 'Moodle Platform Cost in Egypt — Realistic Numbers',
        content: 'Moodle مفتوحة المصدر مجانًا، لكن التطبيق الاحترافي له تكاليف حقيقية. إليك تفصيلها.',
        contentEn: 'Moodle is free open source, but professional implementation has real costs. Here\'s the breakdown.',
        list: [
          { title: 'Moodle أساسي — للمراكز الصغيرة', titleEn: 'Basic Moodle — For Small Centers', content: 'تثبيت + theme بسيط + إعداد الكورسات والأدوار. مناسب لمركز تدريب صغير أو معلم خاص يريد تقنين تجربته التعليمية.', contentEn: 'Installation + simple theme + course and role setup. Suitable for a small training center or a private tutor wanting to digitize their teaching experience.' },
          { title: 'Moodle متوسط — للمدارس والمعاهد', titleEn: 'Mid-range Moodle — For Schools and Institutes', content: 'كل ما سبق + theme احترافي بهوية المؤسسة + نظام دفع + شهادات + تقارير متقدمة + تدريب الكادر التعليمي.', contentEn: 'Everything above + professional theme with institutional identity + payment system + certificates + advanced reports + staff training.' },
          { title: 'Moodle متقدم — للجامعات والشركات الكبيرة', titleEn: 'Advanced Moodle — For Universities and Large Companies', content: 'بنية خوادم عالية الأداء، تكامل مع SIS أو ERP، plugins مخصصة، بث مباشر، وقدرة تحمّل 10,000+ مستخدم متزامن.', contentEn: 'High-performance server infrastructure, SIS or ERP integration, custom plugins, live streaming, and capacity for 10,000+ concurrent users.' },
        ],
      },
      {
        title: 'التكاليف الجارية — ما تدفعه شهريًا وسنويًا',
        titleEn: 'Running Costs — What You Pay Monthly and Annually',
        content: 'كثير من المؤسسات تفاجأ بالتكاليف المستمرة بعد الإطلاق. هذا تفصيل واضح لما تتوقعه.',
        contentEn: 'Many institutions are surprised by ongoing costs after launch. Here\'s a clear breakdown of what to expect.',
        list: [
          { title: 'استضافة الخادم', titleEn: 'Server Hosting', content: 'منصة صغيرة (حتى 1000 طالب): خادم VPS بسيط. منصة كبيرة (10,000+): خوادم سحابية مع CDN. التكلفة تتدرج مع الحجم.', contentEn: 'Small platform (up to 1,000 students): simple VPS server. Large platform (10,000+): cloud servers with CDN. Cost scales with size.' },
          { title: 'ترخيص SSL والنطاق', titleEn: 'SSL Certificate and Domain', content: 'النطاق .com أو .eg: رسوم سنوية بسيطة. شهادة SSL: مجانية (Let\'s Encrypt) أو مدفوعة للمؤسسات التي تحتاج ضمانًا موسعًا.', contentEn: 'Domain (.com or .eg): small annual fee. SSL certificate: free (Let\'s Encrypt) or paid for institutions needing extended warranty.' },
          { title: 'الصيانة والتحديثات الأمنية', titleEn: 'Maintenance and Security Updates', content: 'Moodle تُصدر تحديثات أمنية دورية. بدون تطبيقها، منصتك عرضة للاختراق. عقد الصيانة السنوي ضروري لأي منصة جادة.', contentEn: 'Moodle releases periodic security updates. Without applying them, your platform is vulnerable to hacking. Annual maintenance contract is essential for any serious platform.' },
        ],
      },
      {
        title: 'كيف تخفّض تكاليف المنصة التعليمية دون التضحية بالجودة؟',
        titleEn: 'How to Reduce eLearning Platform Costs Without Sacrificing Quality?',
        content: 'نصائح عملية من تجربتنا مع عشرات المؤسسات التعليمية في مصر والخليج لتحقيق أفضل قيمة مقابل الميزانية.',
        contentEn: 'Practical tips from our experience with dozens of educational institutions in Egypt and the Gulf to achieve the best value for budget.',
        list: [
          { title: 'ابدأ بـ Moodle لا بمنصة مخصصة', titleEn: 'Start with Moodle, Not a Custom Platform', content: 'Moodle تغطي 90% من احتياجات معظم المؤسسات. ابدأ بها وخصصها تدريجيًا بدلًا من بناء منصة من الصفر.', contentEn: 'Moodle covers 90% of most institutions\' needs. Start with it and customize gradually instead of building a platform from scratch.' },
          { title: 'أطلق بالحد الأدنى من الميزات أولًا', titleEn: 'Launch with Minimum Features First', content: 'لا تطلب كل الميزات في الإصدار الأول. أطلق بالأساسيات، اجمع ملاحظات الطلاب، ثم أضف الميزات التي يحتاجونها فعلًا.', contentEn: 'Don\'t request all features in version one. Launch with basics, collect student feedback, then add the features they actually need.' },
          { title: 'وضّح نطاق المشروع بدقة', titleEn: 'Clearly Define Project Scope', content: 'التغييرات أثناء التطوير هي أكبر سبب لتجاوز الميزانية. وضّح كل متطلب بدقة قبل البدء لتجنب التكاليف الإضافية.', contentEn: 'Changes during development are the biggest cause of budget overruns. Clearly define every requirement before starting to avoid extra costs.' },
        ],
      },
      {
        title: 'NIT — شريكك لإطلاق منصة تعليمية ناجحة بميزانية واضحة',
        titleEn: 'NIT — Your Partner for Launching a Successful eLearning Platform with a Clear Budget',
        content: 'نقدم عروضًا شاملة وشفافة — سعر واضح يشمل كل شيء بدون مفاجآت، مع ضمان جودة المنصة وأدائها.',
        contentEn: 'We offer comprehensive and transparent quotes — a clear price that includes everything without surprises, with a guarantee of platform quality and performance.',
        list: [
          { title: 'عرض سعر مجاني خلال 24 ساعة', titleEn: 'Free Quote Within 24 Hours', content: 'أرسل لنا متطلباتك ونرد عليك بعرض سعر تفصيلي في أقل من يوم عمل، شامل كل التكاليف المتوقعة.', contentEn: 'Send us your requirements and we respond with a detailed price quote in less than one business day, covering all expected costs.' },
          { title: 'ضمان الأداء حتى 10,000 مستخدم متزامن', titleEn: 'Performance Guarantee Up to 10,000 Concurrent Users', content: 'نختبر المنصة بتحميل يحاكي أضعاف الاستخدام المتوقع قبل التسليم لضمان أدائها في الاختبارات والأحداث الكبيرة.', contentEn: 'We test the platform with load simulating double the expected usage before delivery to ensure its performance during exams and major events.' },
          { title: 'تدريب كامل للكادر والإداريين', titleEn: 'Full Training for Staff and Administrators', content: 'لا نسلمك المنصة ونذهب — ندرّب فريقك على إدارة المحتوى، إضافة الطلاب، وإدارة الكورسات حتى يعمل كل شيء بسلاسة.', contentEn: 'We don\'t hand over the platform and leave — we train your team on content management, adding students, and course management until everything runs smoothly.' },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // eLEARNING 3 — Benefits of eLearning for Schools and Universities
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'مميزات التعليم الإلكتروني للمدارس والجامعات والمراكز التدريبية في مصر',
    titleEn: 'Benefits of eLearning for Schools, Universities and Training Centers in Egypt',
    content: 'التعليم الإلكتروني لم يعد خيارًا ثانويًا — أصبح ركيزة أساسية لأي مؤسسة تعليمية تريد البقاء والنمو في مصر. المؤسسات التي تأخرت في التحول الرقمي تخسر طلابًا وإيرادات لصالح المنافسين الأسرع.',
    contentEn: 'eLearning is no longer a secondary option — it has become a core pillar for any educational institution that wants to survive and grow in Egypt. Institutions that delayed digital transformation are losing students and revenue to faster-moving competitors.',
    metaDesc: 'اكتشف مميزات التعليم الإلكتروني للمؤسسات التعليمية في مصر — توفير التكاليف، رفع جودة التعلم، والوصول لآلاف الطلاب.',
    metaDescEn: 'Discover eLearning benefits for educational institutions in Egypt — cost savings, improved learning quality, and reaching thousands of students.',
    img: PLACEHOLDER,
    sections: [
      {
        title: 'التحول الرقمي في التعليم المصري — أرقام تتحدث',
        titleEn: 'Digital Transformation in Egyptian Education — Numbers Speak',
        content: 'بعد عام 2020، تسارع التحول الرقمي في التعليم المصري بشكل لم يسبق له مثيل. المؤسسات التي تأخرت في التحول تعاني الآن من منافسة شرسة.',
        contentEn: 'After 2020, digital transformation in Egyptian education accelerated at an unprecedented pace. Institutions that delayed transformation now face fierce competition.',
        list: [
          { title: '300% نمو في التعليم الإلكتروني في مصر', titleEn: '300% Growth in eLearning in Egypt', content: 'سوق التعليم الإلكتروني في مصر نما بنسبة 300% بين 2020 و2024، ومن المتوقع أن يستمر هذا النمو بمعدل 15% سنويًا حتى 2030.', contentEn: 'Egypt\'s eLearning market grew 300% between 2020 and 2024, expected to continue growing at 15% annually until 2030.' },
          { title: '67% من الطلاب يفضلون التعلم الهجين', titleEn: '67% of Students Prefer Hybrid Learning', content: 'أكثر من ثلثي الطلاب يريدون دمجًا بين الفصل التقليدي والتعلم الرقمي. المؤسسة التي لا تقدم هذا الخيار تخسر طلابها للمنافسين.', contentEn: 'More than two-thirds of students want a blend of traditional classroom and digital learning. Institutions not offering this lose students to competitors.' },
          { title: 'توفير حتى 40% من تكاليف التدريب', titleEn: 'Saving Up to 40% of Training Costs', content: 'الشركات التي حولت تدريبها للرقمي وفّرت في المتوسط 40% من تكاليف التدريب (قاعات، مدربون، سفر، طباعة) مع نتائج أفضل.', contentEn: 'Companies that converted training to digital saved an average of 40% on training costs (halls, trainers, travel, printing) with better outcomes.' },
        ],
      },
      {
        title: 'مميزات التعليم الإلكتروني للمدارس الخاصة',
        titleEn: 'eLearning Benefits for Private Schools',
        content: 'المدارس الخاصة التي أضافت منصة تعليمية إلكترونية شهدت تحسنًا ملحوظًا في تفاعل الطلاب، رضا أولياء الأمور، وتميّزها التنافسي.',
        contentEn: 'Private schools that added an eLearning platform saw notable improvements in student engagement, parent satisfaction, and competitive differentiation.',
        list: [
          { title: 'تواصل أفضل مع أولياء الأمور', titleEn: 'Better Communication with Parents', content: 'ولي الأمر يتابع تقدم ابنه لحظة بلحظة — درجات الاختبارات، الواجبات المسلمة، والحضور — كل هذا في تطبيق واحد.', contentEn: 'Parents follow their child\'s progress in real-time — exam grades, submitted assignments, and attendance — all in one app.' },
          { title: 'محتوى تفاعلي يجذب الطلاب', titleEn: 'Interactive Content That Engages Students', content: 'فيديوهات، ألعاب تعليمية، اختبارات تفاعلية — الطالب يتعلم بطريقة تشبه ترفيهه اليومي مما يرفع الاستيعاب بنسبة كبيرة.', contentEn: 'Videos, educational games, interactive quizzes — the student learns in a way similar to their daily entertainment, significantly increasing comprehension.' },
          { title: 'ميزة تنافسية في جذب الطلاب الجدد', titleEn: 'Competitive Advantage in Attracting New Students', content: 'المدرسة التي تقدم منصة رقمية متطورة تتميز في السوق وتجذب الأسر التي تبحث عن تعليم عصري لأبنائها.', contentEn: 'The school that offers an advanced digital platform stands out in the market and attracts families seeking modern education for their children.' },
        ],
      },
      {
        title: 'مميزات التعليم الإلكتروني للجامعات والمعاهد',
        titleEn: 'eLearning Benefits for Universities and Institutes',
        content: 'الجامعات المصرية التي اعتمدت نظام LMS متكامل شهدت تحسنًا في معدلات النجاح، تقليل الضغط على الكادر التدريسي، وفتح أسواق جديدة.',
        contentEn: 'Egyptian universities that adopted an integrated LMS saw improvements in success rates, reduced pressure on teaching staff, and opened new markets.',
        list: [
          { title: 'فتح باب التعليم عن بُعد', titleEn: 'Opening the Door to Distance Learning', content: 'الجامعة تصل لطلاب في كل محافظات مصر والدول العربية بدون الحاجة لبناء مبانٍ جديدة أو تعيين كادر إضافي.', contentEn: 'The university reaches students in all Egyptian governorates and Arab countries without needing new buildings or additional staff.' },
          { title: 'تقليل الضغط على الكادر التدريسي', titleEn: 'Reducing Pressure on Teaching Staff', content: 'المحاضرات المسجلة يشاهدها الطلاب وقت فراغهم. الدكتور يخصص وقت الفصل للنقاش والتطبيق — وليس الشرح المتكرر.', contentEn: 'Recorded lectures viewed by students in their free time. The professor dedicates class time for discussion and application — not repetitive explanation.' },
          { title: 'تحليلات تعلم متقدمة', titleEn: 'Advanced Learning Analytics', content: 'إدارة الجامعة ترى من بيانات المنصة: الكورسات التي يفشل فيها الطلاب، المحاضرات الأقل مشاهدة، ومعدلات الإتمام — لتحسين المناهج باستمرار.', contentEn: 'University administration sees from platform data: courses students fail in, least-watched lectures, and completion rates — to continuously improve curricula.' },
        ],
      },
      {
        title: 'مميزات التعليم الإلكتروني لمراكز التدريب الشركاتي',
        titleEn: 'eLearning Benefits for Corporate Training Centers',
        content: 'الشركات التي حوّلت تدريبها الداخلي للرقمي تجني مزايا ضخمة في الإنتاجية وتكاليف التطوير البشري.',
        contentEn: 'Companies that converted their internal training to digital reap huge benefits in productivity and human development costs.',
        list: [
          { title: 'تدريب آلاف الموظفين في وقت واحد', titleEn: 'Training Thousands of Employees Simultaneously', content: 'بدلًا من جدولة دورات متعددة لمجموعات صغيرة، تُطلق المحتوى لكل موظفيك في يوم واحد — وكل موظف يتعلم في وقته المناسب.', contentEn: 'Instead of scheduling multiple sessions for small groups, you launch content to all your employees in one day — each employee learns at their own time.' },
          { title: 'تتبع الامتثال والشهادات الإلزامية', titleEn: 'Compliance Tracking and Mandatory Certifications', content: 'الشركات المنظمة تحتاج دليلًا أن موظفيها أكملوا تدريبات معينة. المنصة تولّد تقارير امتثال تلقائية للجهات الرقابية.', contentEn: 'Regulated companies need proof that employees completed certain trainings. The platform automatically generates compliance reports for regulatory bodies.' },
          { title: 'تقليل تكاليف السفر والإقامة للتدريب', titleEn: 'Reducing Travel and Accommodation Costs for Training', content: 'الشركات ذات الفروع المتعددة توفر ميزانيات ضخمة كانت تُصرف على سفر الموظفين للتدريب المركزي بتحويله لمنصة رقمية.', contentEn: 'Companies with multiple branches save huge budgets that were spent on employee travel for centralized training by converting it to a digital platform.' },
        ],
      },
      {
        title: 'كيف تبدأ رحلة التحول الرقمي لمؤسستك التعليمية مع NIT؟',
        titleEn: 'How to Start Your Institution\'s Digital Transformation Journey with NIT?',
        content: 'لا تحتاج أن تغير كل شيء دفعة واحدة. نساعدك على بدء رحلة التحول الرقمي بخطوات مدروسة ونتائج قابلة للقياس.',
        contentEn: 'You don\'t need to change everything at once. We help you start the digital transformation journey with calculated steps and measurable results.',
        list: [
          { title: 'مرحلة الاستكشاف — ورشة عمل مجانية', titleEn: 'Exploration Phase — Free Workshop', content: 'نجتمع مع فريقك لفهم احتياجاتك الخاصة وتحديات مؤسستك، ثم نعرض عليك خارطة طريق واضحة للتحول الرقمي.', contentEn: 'We meet with your team to understand your specific needs and institutional challenges, then present you with a clear digital transformation roadmap.' },
          { title: 'مرحلة التجريب — برنامج Pilot', titleEn: 'Pilot Phase — Pilot Program', content: 'نطلق المنصة على مجموعة صغيرة أولًا (فصل واحد أو قسم واحد) لاختبار الفكرة وجمع ملاحظات حقيقية قبل التوسع.', contentEn: 'We launch the platform to a small group first (one class or department) to test the concept and gather real feedback before scaling.' },
          { title: 'مرحلة التوسع — الإطلاق الكامل', titleEn: 'Scaling Phase — Full Launch', content: 'بعد نجاح الـ Pilot، نوسّع المنصة لكل المؤسسة مع تدريب شامل للكادر وخطة نقل المحتوى الحالي للمنصة الجديدة.', contentEn: 'After the Pilot\'s success, we scale the platform to the entire institution with comprehensive staff training and a plan to migrate existing content to the new platform.' },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // eLEARNING 4 — Transform Traditional Training Center to Online
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'كيف تحوّل مركز تدريب تقليدي إلى منصة تعليمية أونلاين ناجحة في مصر',
    titleEn: 'How to Transform a Traditional Training Center into a Successful Online Platform in Egypt',
    content: 'مراكز التدريب التقليدية في مصر تواجه تحديًا حقيقيًا: المنافسة الرقمية تشتد يومًا بعد يوم. في هذا الدليل، نشرح بالتفصيل كيف تحوّل مركزك التدريبي إلى منصة أونلاين ناجحة تصل لطلاب في كل مكان.',
    contentEn: 'Traditional training centers in Egypt face a real challenge: digital competition intensifies day by day. In this guide, we explain in detail how to transform your training center into a successful online platform that reaches students everywhere.',
    metaDesc: 'دليل عملي لتحويل مركز التدريب التقليدي إلى منصة تعليمية أونلاين في مصر — الخطوات والتكلفة والأخطاء التي يجب تجنبها.',
    metaDescEn: 'Practical guide to transforming a traditional training center into an online platform in Egypt — steps, cost and mistakes to avoid.',
    img: PLACEHOLDER,
    sections: [
      {
        title: 'لماذا التحول الرقمي أصبح ضرورة لا خيارًا لمراكز التدريب؟',
        titleEn: 'Why Has Digital Transformation Become a Necessity, Not a Choice, for Training Centers?',
        content: 'مراكز التدريب التقليدية تواجه تحديًا وجوديًا: المدربون المستقلون ومنصات التعلم العالمية مثل Coursera وUdemy يأخذون عملاءهم. الحل الوحيد هو التحول الرقمي.',
        contentEn: 'Traditional training centers face an existential challenge: independent trainers and global learning platforms like Coursera and Udemy are taking their clients. The only solution is digital transformation.',
        list: [
          { title: 'المنافسة أصبحت عالمية', titleEn: 'Competition Has Become Global', content: 'عميلك المصري يقارن بين دورتك وكورس مسجل على Udemy بسعر أقل. لا يمكنك المنافسة بالطريقة التقليدية وحدها.', contentEn: 'Your Egyptian client compares your course with a recorded Udemy course at a lower price. You can\'t compete with traditional methods alone.' },
          { title: 'التوسع الجغرافي بدون تكاليف', titleEn: 'Geographic Expansion Without Costs', content: 'المنصة الأونلاين تتيح لك خدمة طلاب في الإسكندرية والأقصر والرياض ودبي — من نفس المكتب وبنفس الكادر.', contentEn: 'An online platform allows you to serve students in Alexandria, Luxor, Riyadh, and Dubai — from the same office and with the same staff.' },
          { title: 'الدخل السلبي من المحتوى المسجل', titleEn: 'Passive Income from Recorded Content', content: 'المدرب يسجل الدورة مرة واحدة ويبيعها لآلاف الطلاب — بدون حضور مستمر. هذا يضاعف عائد وقت المدرب.', contentEn: 'The trainer records the course once and sells it to thousands of students — without continuous presence. This multiplies the trainer\'s time ROI.' },
        ],
      },
      {
        title: 'الخطوات العملية لتحويل مركزك التدريبي أونلاين',
        titleEn: 'Practical Steps to Take Your Training Center Online',
        content: 'التحول الرقمي ليس قرارًا لحظيًا — هو مشروع مدروس. إليك الخارطة الكاملة التي نتبعها مع كل مركز نعمل معه.',
        contentEn: 'Digital transformation is not an instant decision — it\'s a planned project. Here\'s the complete roadmap we follow with every center we work with.',
        list: [
          { title: 'الخطوة 1: تدقيق المحتوى الحالي', titleEn: 'Step 1: Audit Current Content', content: 'نحدد معك: ما الدورات التي تستحق التحويل الرقمي أولًا؟ ما المحتوى الجاهز وما الذي يحتاج إعادة إنتاج؟', contentEn: 'We identify with you: which courses deserve digital conversion first? What content is ready and what needs re-production?' },
          { title: 'الخطوة 2: اختيار نموذج العمل الأونلاين', titleEn: 'Step 2: Choose the Online Business Model', content: 'اشتراك شهري؟ دفع لكل دورة؟ مجاني مع دورات مميزة مدفوعة؟ نساعدك على اختيار النموذج الأنسب لجمهورك وأهدافك.', contentEn: 'Monthly subscription? Pay per course? Free with paid premium courses? We help you choose the most suitable model for your audience and goals.' },
          { title: 'الخطوة 3: بناء المنصة والإطلاق', titleEn: 'Step 3: Build the Platform and Launch', content: 'نبني منصتك على Moodle أو تقنية مخصصة، ننقل محتواك الحالي، ونطلق برنامج Pilot لاختبار الفكرة قبل التوسع.', contentEn: 'We build your platform on Moodle or custom technology, migrate your existing content, and launch a Pilot program to test the concept before scaling.' },
        ],
      },
      {
        title: 'أكبر الأخطاء التي تقع فيها مراكز التدريب عند التحول الرقمي',
        titleEn: 'The Biggest Mistakes Training Centers Make During Digital Transformation',
        content: 'تعلمنا من عشرات المشاريع ما الذي يجعل التحول ينجح وما الذي يجعله يفشل. هذه الأخطاء الأكثر تكرارًا.',
        contentEn: 'We\'ve learned from dozens of projects what makes transformation succeed and what makes it fail. These are the most repeated mistakes.',
        list: [
          { title: 'خطأ: نقل المحتوى كما هو بدون تحويل', titleEn: 'Mistake: Transferring Content As-Is Without Conversion', content: 'محاضرة 3 ساعات مسجلة كاملة لا تناسب التعلم الأونلاين. المحتوى الرقمي يحتاج وحدات قصيرة 5-10 دقائق مع تفاعل بين كل وحدة.', contentEn: 'A 3-hour fully recorded lecture doesn\'t suit online learning. Digital content needs short 5-10 minute units with interaction between each unit.' },
          { title: 'خطأ: إطلاق بدون تسويق رقمي', titleEn: 'Mistake: Launching Without Digital Marketing', content: 'المنصة وحدها لا تجذب طلابًا. تحتاج استراتيجية SEO، حضور سوشيال ميديا، وإعلانات مدفوعة لتعريف الجمهور بمنصتك الجديدة.', contentEn: 'The platform alone doesn\'t attract students. You need an SEO strategy, social media presence, and paid ads to introduce your audience to your new platform.' },
          { title: 'خطأ: تجاهل تجربة المستخدم على الجوال', titleEn: 'Mistake: Ignoring Mobile User Experience', content: '70% من طلابك سيدخلون المنصة من هاتفهم. منصة غير محسّنة للجوال تعني فقدان أغلب جمهورك المستهدف.', contentEn: '70% of your students will access the platform from their phone. A non-mobile-optimized platform means losing most of your target audience.' },
        ],
      },
      {
        title: 'كيف تحقق دخلًا من منصتك التعليمية من اليوم الأول؟',
        titleEn: 'How to Generate Revenue from Your Platform from Day One?',
        content: 'المنصة التعليمية يجب أن تكون استثمارًا يعود عليك بعائد واضح. إليك نماذج الدخل التي نراها تنجح في السوق المصري.',
        contentEn: 'The educational platform must be an investment that returns a clear yield. Here are the revenue models we see succeeding in the Egyptian market.',
        list: [
          { title: 'نموذج الاشتراك الشهري / السنوي', titleEn: 'Monthly/Annual Subscription Model', content: 'دخل ثابت يمكن التنبؤ به. الطالب يدفع مبلغًا شهريًا للوصول لكل الدورات. مناسب جدًا للمراكز التي لديها كتالوج كبير من الدورات.', contentEn: 'Predictable fixed income. Student pays a monthly amount for access to all courses. Very suitable for centers with a large course catalog.' },
          { title: 'نموذج الدفع لكل دورة', titleEn: 'Pay-per-course Model', content: 'كل دورة لها سعر مستقل. أفضل للدورات المتخصصة بسعر مرتفع. الطالب يدفع مرة واحدة ويحتفظ بالوصول للأبد.', contentEn: 'Each course has an independent price. Best for specialized high-price courses. Student pays once and retains access forever.' },
          { title: 'نموذج Freemium', titleEn: 'Freemium Model', content: 'محتوى مجاني لجذب الطلاب، ومحتوى متميز مدفوع. الطالب يجرب ويثق، ثم يشتري. نموذج يولّد قاعدة جمهور ضخمة بسرعة.', contentEn: 'Free content to attract students, paid premium content. Student tries and trusts, then buys. A model that generates a large audience base quickly.' },
        ],
      },
      {
        title: 'NIT تحوّل رؤيتك لواقع رقمي ناجح',
        titleEn: 'NIT Transforms Your Vision into a Successful Digital Reality',
        content: 'حوّلنا عشرات مراكز التدريب التقليدية إلى منصات رقمية ناجحة في مصر والسعودية والإمارات. دعنا نضيف مركزك لقائمة نجاحاتنا.',
        contentEn: 'We\'ve transformed dozens of traditional training centers into successful digital platforms in Egypt, Saudi Arabia and UAE. Let us add your center to our success list.',
        list: [
          { title: 'خبرة 12 عامًا في التعليم الرقمي', titleEn: '12 Years of Experience in Digital Education', content: 'منذ 2013 ونحن نبني منصات تعليمية في مصر والخليج. هذه الخبرة تعني أننا نعرف ما ينجح وما يفشل في سوقك تحديدًا.', contentEn: 'Since 2013 we\'ve been building educational platforms in Egypt and the Gulf. This experience means we know what succeeds and what fails in your specific market.' },
          { title: 'فريق متكامل تحت سقف واحد', titleEn: 'Integrated Team Under One Roof', content: 'مطورون، مصممون، خبراء تعليم إلكتروني، ومتخصصو تسويق — كل ما تحتاجه لإطلاق منصة ناجحة في مكان واحد.', contentEn: 'Developers, designers, eLearning experts, and marketing specialists — everything you need to launch a successful platform in one place.' },
          { title: 'نماذج حية يمكنك زيارتها', titleEn: 'Live Examples You Can Visit', content: 'قبل أن تقرر، تفضّل بزيارة المنصات الحية التي بنيناها وتحدث مع أصحابها مباشرة — شفافية كاملة بدون كلام نظري.', contentEn: 'Before deciding, visit the live platforms we\'ve built and speak directly with their owners — complete transparency with no theoretical talk.' },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // eLEARNING 5 — Best Moodle Plugins
  // ══════════════════════════════════════════════════════════════════
  {
    title: 'أفضل إضافات Moodle لتحسين تجربة التعلم الإلكتروني في 2025',
    titleEn: 'Best Moodle Plugins to Improve the eLearning Experience in 2025',
    content: 'Moodle بدون إضافات مثل سيارة بدون ملحقات — تعمل، لكنها لا تصل لإمكاناتها الكاملة. في هذا المقال، نستعرض أفضل إضافات Moodle التي نثبّتها ونوصي بها بناءً على تجربتنا مع عشرات المنصات في مصر والخليج.',
    contentEn: 'Moodle without plugins is like a car without accessories — it works, but it doesn\'t reach its full potential. In this article, we review the best Moodle plugins we install and recommend based on our experience with dozens of platforms in Egypt and the Gulf.',
    metaDesc: 'اكتشف أفضل إضافات Moodle لتحسين تجربة الطلاب والمدربين في 2025 — H5P، BigBlueButton، وإضافات الشهادات والتقارير.',
    metaDescEn: 'Discover the best Moodle plugins to improve student and trainer experience in 2025 — H5P, BigBlueButton, certificates and reporting plugins.',
    img: PLACEHOLDER,
    sections: [
      {
        title: 'لماذا الإضافات هي القوة الحقيقية لـ Moodle؟',
        titleEn: 'Why Are Plugins the Real Power of Moodle?',
        content: 'Moodle الأساسية قوية — لكن الإضافات (Plugins) تحوّلها من منصة تعليمية جيدة إلى منظومة تعليمية استثنائية مصممة لاحتياجاتك بالضبط.',
        contentEn: 'Core Moodle is powerful — but plugins transform it from a good learning platform to an exceptional educational system designed exactly for your needs.',
        list: [
          { title: 'أكثر من 1,800 إضافة مجانية رسمية', titleEn: 'Over 1,800 Free Official Plugins', content: 'مستودع Moodle الرسمي يحتوي آلاف الإضافات المجانية والمدفوعة لأي ميزة تتخيلها — من التلعيب حتى الذكاء الاصطناعي.', contentEn: 'The official Moodle repository contains thousands of free and paid plugins for any feature you can imagine — from gamification to artificial intelligence.' },
          { title: 'تخصيص بدون تعديل الكود الأساسي', titleEn: 'Customization Without Modifying Core Code', content: 'الإضافات تضيف الميزات بدون المساس بكود Moodle الأساسي، مما يضمن سهولة التحديث والأمان على المدى البعيد.', contentEn: 'Plugins add features without touching Moodle\'s core code, ensuring easy updates and security in the long term.' },
          { title: 'تطوير إضافات مخصصة لاحتياجاتك', titleEn: 'Developing Custom Plugins for Your Needs', content: 'إذا لم تجد الإضافة التي تحتاجها جاهزة، نطورها لك كاملًا — ربط بنظام دفع محلي، نظام نقاط مخصص، أو تكامل مع ERP.', contentEn: 'If you can\'t find the plugin you need ready-made, we develop it for you completely — local payment integration, custom points system, or ERP integration.' },
        ],
      },
      {
        title: 'إضافات المحتوى التفاعلي — H5P وما بعده',
        titleEn: 'Interactive Content Plugins — H5P and Beyond',
        content: 'المحتوى التفاعلي هو الفرق بين طالب يشاهد فيديو وينسى وطالب يتفاعل ويتعلم فعلًا. هذه أفضل الإضافات لتحقيق ذلك.',
        contentEn: 'Interactive content is the difference between a student who watches a video and forgets, and one who engages and actually learns. These are the best plugins to achieve that.',
        list: [
          { title: 'H5P — ملك المحتوى التفاعلي', titleEn: 'H5P — King of Interactive Content', content: 'يتيح إنشاء أكثر من 50 نوعًا من المحتوى التفاعلي: فيديو بأسئلة مدمجة، بطاقات تعليمية، سيناريوهات تفريعية، ومحاكاة.', contentEn: 'Enables creating over 50 types of interactive content: video with embedded questions, flashcards, branching scenarios, and simulations.' },
          { title: 'Lesson Activity — مسارات تعليمية تكيفية', titleEn: 'Lesson Activity — Adaptive Learning Paths', content: 'يصمم مسارات تعليمية تتكيف مع إجابات الطالب: إذا أجاب خطأ، يعود لمحتوى تمهيدي. إذا أجاب صح، يتقدم لمستوى أعلى.', contentEn: 'Designs learning paths that adapt to student answers: if answered wrong, returns to foundational content. If correct, advances to a higher level.' },
          { title: 'Questionnaire — استطلاعات وتقييمات متقدمة', titleEn: 'Questionnaire — Advanced Surveys and Assessments', content: 'استطلاعات رضا المتعلمين، تقييمات 360 درجة، واستبيانات لقياس أثر التدريب — كلها من داخل Moodle بدون أدوات خارجية.', contentEn: 'Learner satisfaction surveys, 360-degree assessments, and questionnaires to measure training impact — all from within Moodle without external tools.' },
        ],
      },
      {
        title: 'إضافات التعلم المباشر والتواصل',
        titleEn: 'Live Learning and Communication Plugins',
        content: 'التعلم الأونلاين لا يعني التعلم المنعزل. هذه الإضافات تضيف عنصر التفاعل البشري المباشر للمنصة.',
        contentEn: 'Online learning doesn\'t mean isolated learning. These plugins add the element of direct human interaction to the platform.',
        list: [
          { title: 'BigBlueButton — غرف تعليم مباشر مدمجة', titleEn: 'BigBlueButton — Integrated Live Classroom Rooms', content: 'مؤتمرات فيديو مدمجة في Moodle بدون مغادرة المنصة. يدعم السبورة التفاعلية، تقسيم المجموعات، وتسجيل الجلسات.', contentEn: 'Video conferences integrated in Moodle without leaving the platform. Supports interactive whiteboard, group breakouts, and session recording.' },
          { title: 'Zoom Integration — للمؤسسات التي تستخدم Zoom', titleEn: 'Zoom Integration — For Institutions Already Using Zoom', content: 'إذا كانت مؤسستك تستخدم Zoom بالفعل، هذه الإضافة تربطه بـ Moodle تلقائيًا — الجلسات تُسجَّل وتُحفَظ مع المساق مباشرة.', contentEn: 'If your institution already uses Zoom, this plugin links it to Moodle automatically — sessions are recorded and saved with the course directly.' },
          { title: 'Forum Advanced — نقاشات أكاديمية منظمة', titleEn: 'Forum Advanced — Organized Academic Discussions', content: 'منتديات نقاش منظمة مع تقييم مساهمات الطلاب، اشتراك بالإشعارات، وبحث متقدم في المناقشات السابقة.', contentEn: 'Organized discussion forums with student contribution rating, notification subscriptions, and advanced search in previous discussions.' },
        ],
      },
      {
        title: 'إضافات الشهادات والإنجازات والتلعيب',
        titleEn: 'Certificate, Achievement, and Gamification Plugins',
        content: 'الشهادات والإنجازات ترفع دافعية الطلاب للإتمام وتمنحهم قيمة حقيقية مقابل تعلمهم. هذه أفضل الإضافات لهذا الغرض.',
        contentEn: 'Certificates and achievements increase student motivation to complete courses and give them real value for their learning. These are the best plugins for this purpose.',
        list: [
          { title: 'Custom Certificate — شهادات PDF احترافية', titleEn: 'Custom Certificate — Professional PDF Certificates', content: 'تصميم شهادات بهوية مؤسستك البصرية تُصدَر تلقائيًا عند إتمام الطالب للمساق. مع كود QR للتحقق من الأصالة.', contentEn: 'Design certificates with your institution\'s visual identity, automatically issued when the student completes the course. With QR code for authenticity verification.' },
          { title: 'Level Up! — نظام مستويات وشارات', titleEn: 'Level Up! — Levels and Badge System', content: 'الطالب يكسب نقاطًا مع كل نشاط ويرتقي لمستويات أعلى. الشارات والإنجازات تخلق منافسة ودية ترفع معدلات الإتمام بنسبة 30%.', contentEn: 'Students earn points with each activity and advance to higher levels. Badges and achievements create friendly competition that raises completion rates by 30%.' },
          { title: 'Completion Progress — شريط تقدم مرئي', titleEn: 'Completion Progress — Visual Progress Bar', content: 'شريط مرئي يُظهر للطالب كم اكتمل من المساق ومتبقي. هذا التحفيز البصري البسيط يرفع معدل الإتمام بشكل ملحوظ.', contentEn: 'A visual bar showing the student how much of the course is completed and remaining. This simple visual motivation noticeably raises completion rates.' },
        ],
      },
      {
        title: 'كيف تختار الإضافات المناسبة لمنصتك؟',
        titleEn: 'How to Choose the Right Plugins for Your Platform?',
        content: 'ليس كل إضافة تناسب كل منصة. الاختيار الخاطئ يُثقل المنصة ويُبطئها. إليك معايير الاختيار الصحيح.',
        contentEn: 'Not every plugin suits every platform. The wrong choice burdens the platform and slows it down. Here are the correct selection criteria.',
        list: [
          { title: 'ابدأ باحتياجك الفعلي لا بالإضافات الشعبية', titleEn: 'Start with Your Actual Need, Not Popular Plugins', content: 'اسأل: ما المشكلة التي أحلها؟ ثم ابحث عن الإضافة. لا تضف إضافات "تبدو مثيرة" دون أن تحتاجها فعلًا.', contentEn: 'Ask: what problem am I solving? Then search for the plugin. Don\'t add plugins that "look exciting" without actually needing them.' },
          { title: 'تأكد من التوافق مع إصدار Moodle', titleEn: 'Ensure Compatibility with Your Moodle Version', content: 'كل إضافة لها حد أدنى وأقصى من إصدارات Moodle المدعومة. تثبيت إضافة غير متوافقة قد يعطّل منصتك بالكامل.', contentEn: 'Each plugin has a minimum and maximum supported Moodle version. Installing an incompatible plugin may crash your entire platform.' },
          { title: 'NIT تختار وتثبت وتخصص الإضافات لك', titleEn: 'NIT Selects, Installs, and Customizes Plugins for You', content: 'من تجربتنا مع عشرات المنصات، نعرف تمامًا أي إضافات تعمل بشكل مثالي مع بعض وأيها تتعارض. نوفر عليك وقت التجربة والخطأ.', contentEn: 'From our experience with dozens of platforms, we know exactly which plugins work perfectly together and which conflict. We save you the time of trial and error.' },
        ],
      },
    ],
  },

];

// ──────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 Seeding ${articles.length} articles...\n`);

  for (const art of articles) {
    const { sections, ...articleData } = art;

    const existing = await prisma.article.findFirst({ where: { title: articleData.title } });
    if (existing) {
      console.log(`  ⏭  Already exists: "${articleData.title.slice(0, 60)}"`);
      continue;
    }

    const article = await prisma.article.create({ data: articleData });
    console.log(`\n✅ Created: "${article.title.slice(0, 70)}"`);
    console.log(`   AR: /ar/blog/${article.id}`);
    console.log(`   EN: /en/blog/${article.id}`);

    for (const sec of sections) {
      const { list, ...secData } = sec;
      await prisma.section.create({
        data: { ...secData, list, articleId: article.id }
      });
      console.log(`   + ${sec.title.slice(0, 50)}`);
    }
  }

  console.log('\n✅ All done! Upload hero images for each article from the dashboard.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
