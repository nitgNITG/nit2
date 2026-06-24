// ─────────────────────────────────────────────────────────────────────────────
// Service offerings shown on each /our-services/<slug> page.
//
// These describe the *services we provide* (the kinds of solutions we build),
// NOT our own live products. Where a real, live project from /our-projects is a
// good proof point for a service, it's listed under `relatedProjects`.
//
// Content here is intentionally plain data so it can be edited later (e.g. after
// the Ahrefs keyword report) without touching any component code.
// ─────────────────────────────────────────────────────────────────────────────

export type ServiceKey =
  | "moodle"
  | "ecommerce"
  | "delivery"
  | "restaurant"
  | "loyalty"
  | "edu"
  | "aiEdu"
  | "school"
  | "android"
  | "ios"
  | "web";

/** A single service offering card — a type of solution we build. */
export type ServiceOffering = {
  titleEn: string;
  titleAr: string;
  /** Short tag, e.g. the segment/audience this offering targets. */
  categoryEn: string;
  categoryAr: string;
  descEn: string;
  descAr: string;
};

/** A real, live project that proves a service — links into /our-projects. */
export type RelatedProject = {
  nameEn: string;
  nameAr: string;
  /** Internal path (used with LocaleLink). */
  href: string;
};

export type ServiceData = {
  /** Small eyebrow label above the heading. */
  eyebrowEn: string;
  eyebrowAr: string;
  headingEn: string;
  headingAr: string;
  /** Optional word inside the heading to color-highlight (matched per language). */
  keywordEn?: string;
  keywordAr?: string;
  subtitleEn: string;
  subtitleAr: string;
  offerings: ServiceOffering[];
  relatedProjects: RelatedProject[];
};

export const servicesData: Record<ServiceKey, ServiceData> = {
  // ── Moodle LMS ──────────────────────────────────────────────────────────
  moodle: {
    eyebrowEn: "What We Build",
    eyebrowAr: "خدماتنا التعليمية",
    headingEn: "Our Moodle LMS Services",
    headingAr: "خدمات تطوير منصات Moodle",
    keywordEn: "Moodle",
    keywordAr: "Moodle",
    subtitleEn:
      "We design and build complete e-learning platforms tailored to your institution.",
    subtitleAr:
      "إنشاء منصة تعليمية احترافية — نصمم ونطوّر منصات تعليمية متكاملة مخصصة حسب احتياج جامعتك أو مدرستك أو شركتك.",
    offerings: [
      {
        titleEn: "Higher-Education Platforms",
        titleAr: "منصات التعليم الجامعي",
        categoryEn: "Universities & Institutes",
        categoryAr: "جامعات ومعاهد",
        descEn:
          "Moodle platforms for thousands of students with a custom theme, Arabic RTL support and a branded mobile app.",
        descAr:
          "منصات Moodle لآلاف الطلاب مع ثيم مخصص ودعم عربي كامل (RTL) وتطبيق جوال باسم المؤسسة.",
      },
      {
        titleEn: "Corporate Training LMS",
        titleAr: "منصات التدريب المؤسسي",
        categoryEn: "Enterprise Training",
        categoryAr: "تدريب الشركات",
        descEn:
          "Internal training systems with SCORM courses, completion tracking, assessments and e-certificates.",
        descAr:
          "أنظمة تدريب داخلية مع دورات SCORM وتتبع الإنجاز والاختبارات والشهادات الإلكترونية.",
      },
      {
        titleEn: "K-12 School Platforms",
        titleAr: "منصات المدارس",
        categoryEn: "School Systems",
        categoryAr: "أنظمة مدرسية",
        descEn:
          "Moodle-based school platforms with a parent portal, grading system and live & recorded video lessons.",
        descAr:
          "منصات مدرسية على Moodle مع بوابة لأولياء الأمور ونظام درجات ودروس فيديو مباشرة ومسجلة.",
      },
    ],
    relatedProjects: [
      {
        nameEn: "Step2English",
        nameAr: "ستيب تو إنجليش",
        href: "/our-projects",
      },
      { nameEn: "3alemny", nameAr: "علمني", href: "/our-projects" },
    ],
  },

  // ── eCommerce ───────────────────────────────────────────────────────────
  ecommerce: {
    eyebrowEn: "What We Build",
    eyebrowAr: "خدمات التجارة الإلكترونية",
    headingEn: "Our eCommerce Development Services",
    headingAr: "خدمات تطوير متاجر وتطبيقات التجارة الإلكترونية",
    keywordEn: "eCommerce",
    keywordAr: "التجارة الإلكترونية",
    subtitleEn:
      "We build online stores and shopping apps with Gulf & Egyptian payment and shipping integrations.",
    subtitleAr:
      "شركة تصميم متجر إلكتروني احترافي وتطبيقات تسوق متعددة البائعين، مع تكامل بوابات الدفع وشركات الشحن في مصر والخليج.",
    offerings: [
      {
        titleEn: "Multi-Vendor Marketplaces",
        titleAr: "أسواق متعددة البائعين",
        categoryEn: "Multivendor Marketplace",
        categoryAr: "سوق متعدد البائعين",
        descEn:
          "Full marketplace platforms with seller dashboards, real-time inventory and Fawry & PayMob integration.",
        descAr:
          "منصات أسواق متكاملة مع لوحات تحكم للبائعين ومخزون لحظي وتكامل مع فوري وباي موب.",
      },
      {
        titleEn: "Single-Store Retail Apps",
        titleAr: "تطبيقات المتاجر الفردية",
        categoryEn: "Single-Store Retail",
        categoryAr: "متجر فردي",
        descEn:
          "Fast, lightweight shopping apps with product catalog, cart, checkout and full order tracking.",
        descAr:
          "تطبيقات تسوق سريعة وخفيفة مع كتالوج منتجات وسلة وإتمام شراء وتتبع كامل للطلبات.",
      },
      {
        titleEn: "POS-Integrated Omnichannel",
        titleAr: "تكامل نقاط البيع متعدد القنوات",
        categoryEn: "POS Integration",
        categoryAr: "تكامل نقاط البيع",
        descEn:
          "Unified systems connecting physical stores with the online platform for real-time stock and sales sync.",
        descAr:
          "أنظمة موحّدة تربط المتاجر الفعلية بالمنصة الإلكترونية لمزامنة المخزون والمبيعات لحظياً.",
      },
    ],
    relatedProjects: [
      { nameEn: "Tawreedat Go", nameAr: "توريدات جو", href: "/our-projects" },
      { nameEn: "Buzz", nameAr: "باز", href: "/our-projects" },
    ],
  },

  // ── Delivery ────────────────────────────────────────────────────────────
  delivery: {
    eyebrowEn: "What We Build",
    eyebrowAr: "خدمات تطبيقات التوصيل",
    headingEn: "Our Delivery App Services",
    headingAr: "خدمات تطوير تطبيقات التوصيل",
    keywordEn: "Delivery",
    keywordAr: "التوصيل",
    subtitleEn:
      "We build on-demand delivery platforms with customer, driver and merchant apps and live tracking.",
    subtitleAr:
      "نطوّر تطبيقات التوصيل عند الطلب مثل مرسول وهنقرستيشن واوبر — توصيل طلبات وركاب بتطبيقات للعميل والسائق والتاجر مع تتبع مباشر.",
    offerings: [
      {
        titleEn: "Multi-Service Delivery Platforms",
        titleAr: "منصات توصيل متعددة الخدمات",
        categoryEn: "Multi-Service Delivery",
        categoryAr: "توصيل متعدد الخدمات",
        descEn:
          "Order anything from nearby stores and restaurants, with multiple payment methods and live order tracking.",
        descAr:
          "طلب كل ما تحتاجه من المتاجر والمطاعم القريبة، مع عدة طرق للدفع وتتبع مباشر للطلبات.",
      },
      {
        titleEn: "Food Delivery Apps",
        titleAr: "تطبيقات توصيل الطعام",
        categoryEn: "Food Delivery",
        categoryAr: "توصيل طعام",
        descEn:
          "Smart food-delivery apps for ordering meals from restaurants and cafés with secure payments.",
        descAr:
          "تطبيقات ذكية لتوصيل الطعام لطلب الوجبات من المطاعم والكافيهات مع وسائل دفع آمنة.",
      },
      {
        titleEn: "Customer & Driver Apps",
        titleAr: "تطبيقات العميل والسائق",
        categoryEn: "Live GPS Tracking",
        categoryAr: "تتبع مباشر بالخريطة",
        descEn:
          "Paired customer and driver apps with live GPS tracking, route optimization and dispatch management.",
        descAr:
          "تطبيقات متكاملة للعميل والسائق مع تتبع مباشر بالخريطة وتحسين المسارات وإدارة التوزيع.",
      },
    ],
    relatedProjects: [
      { nameEn: "Tawreedat Go", nameAr: "توريدات جو", href: "/our-projects" },
      { nameEn: "Buzz", nameAr: "باز", href: "/our-projects" },
    ],
  },

  // ── Restaurant ──────────────────────────────────────────────────────────
  restaurant: {
    eyebrowEn: "What We Build",
    eyebrowAr: "خدمات تطبيقات المطاعم",
    headingEn: "Our Restaurant App Services",
    headingAr: "خدمات تطوير تطبيقات المطاعم",
    keywordEn: "Restaurant",
    keywordAr: "المطاعم",
    subtitleEn:
      "We build branded ordering & delivery apps with digital menus, POS and multi-branch management.",
    subtitleAr:
      "تصميم و برمجة تطبيق مطعم — تطبيقات طلب ودليفري باسم مطعمك مع قائمة رقمية ونقاط بيع وإدارة فروع.",
    offerings: [
      {
        titleEn: "Branded Ordering Apps",
        titleAr: "تطبيقات طلب باسم مطعمك",
        categoryEn: "Restaurant Ordering",
        categoryAr: "طلب مطاعم",
        descEn:
          "Customer ordering & delivery apps under your own brand with a digital menu and secure payments.",
        descAr:
          "تطبيقات طلب ودليفري للعملاء باسم علامتك التجارية مع قائمة رقمية ووسائل دفع آمنة.",
      },
      {
        titleEn: "Food & Grocery Ordering",
        titleAr: "طلب الأطعمة والمنتجات",
        categoryEn: "Food & Grocery",
        categoryAr: "مطاعم وسوبر ماركت",
        descEn:
          "Food & products ordering apps with a complete order, payment and delivery system.",
        descAr: "تطبيقات طلب أطعمة ومنتجات مع نظام طلب ودفع وتوصيل متكامل.",
      },
      {
        titleEn: "Multi-Branch & POS Management",
        titleAr: "إدارة الفروع ونقاط البيع",
        categoryEn: "POS & Branches",
        categoryAr: "نقاط بيع وفروع",
        descEn:
          "Back-office systems to manage menus, branches, orders and POS from a single dashboard.",
        descAr:
          "أنظمة إدارية لإدارة القوائم والفروع والطلبات ونقاط البيع من لوحة تحكم واحدة.",
      },
    ],
    relatedProjects: [{ nameEn: "Buzz", nameAr: "باز", href: "/our-projects" }],
  },

  // ── Loyalty ─────────────────────────────────────────────────────────────
  loyalty: {
    eyebrowEn: "What We Build",
    eyebrowAr: "خدمات أنظمة الولاء",
    headingEn: "Our Loyalty & Rewards Services",
    headingAr: "خدمات تطوير أنظمة الولاء والنقاط",
    keywordEn: "Loyalty",
    keywordAr: "الولاء",
    subtitleEn:
      "We build customer loyalty systems with points, coupons, digital cards and a CRM analytics dashboard.",
    subtitleAr:
      "نبني نظام ولاء العملاء وأنظمة النقاط والمكافآت — بالكوبونات والبطاقات الرقمية ولوحة تحليلات CRM لمصر والخليج.",
    offerings: [
      {
        titleEn: "Points & Rewards Programs",
        titleAr: "برامج النقاط والمكافآت",
        categoryEn: "Community Points Loyalty",
        categoryAr: "ولاء بالنقاط",
        descEn:
          "Community points & rewards programs that drive customer engagement and repeat visits.",
        descAr:
          "برامج ولاء بالنقاط والمكافآت تحفّز العملاء على التفاعل والعودة المتكررة.",
      },
      {
        titleEn: "Digital Cards & Coupons",
        titleAr: "البطاقات الرقمية والكوبونات",
        categoryEn: "Digital Loyalty Cards",
        categoryAr: "بطاقات ولاء رقمية",
        descEn:
          "Digital loyalty cards, coupons and offer journeys merchants can design themselves.",
        descAr:
          "بطاقات ولاء رقمية وكوبونات ومسارات عروض يستطيع التاجر تصميمها بنفسه.",
      },
      {
        titleEn: "CRM Analytics Dashboard",
        titleAr: "لوحة تحليلات CRM",
        categoryEn: "CRM & Analytics",
        categoryAr: "تحليلات وإدارة عملاء",
        descEn:
          "A merchant dashboard with customer insights, redemption analytics and campaign management.",
        descAr:
          "لوحة تحكم للتاجر مع رؤى عن العملاء وتحليلات الاستبدال وإدارة الحملات.",
      },
    ],
    relatedProjects: [
      { nameEn: "PayPoints", nameAr: "بايبوينس", href: "/our-projects" },
    ],
  },

  // ── Educational Platforms ───────────────────────────────────────────────
  edu: {
    eyebrowEn: "What We Build",
    eyebrowAr: "خدماتنا التعليمية",
    headingEn: "Our Educational Platform Services",
    headingAr: "خدمات تطوير المنصات التعليمية",
    keywordEn: "Educational",
    keywordAr: "التعليمية",
    subtitleEn:
      "We design and build custom e-learning platforms with live classes, e-assessments and mobile apps.",
    subtitleAr:
      "نصمم ونطوّر منصات تعليمية إلكترونية مخصصة مع فصول مباشرة واختبارات إلكترونية وتطبيقات جوال للجامعات والمدارس والشركات.",
    offerings: [
      {
        titleEn: "Custom LMS Platforms",
        titleAr: "منصات إدارة تعلم مخصصة",
        categoryEn: "Universities & Schools",
        categoryAr: "جامعات ومدارس",
        descEn:
          "Tailor-made learning platforms with course management, student enrollment, grading and progress tracking.",
        descAr:
          "منصات تعلم مصممة خصيصاً مع إدارة المقررات وتسجيل الطلاب والدرجات وتتبع التقدم.",
      },
      {
        titleEn: "Live Classes & Video Lessons",
        titleAr: "فصول مباشرة ودروس فيديو",
        categoryEn: "Virtual Classrooms",
        categoryAr: "فصول افتراضية",
        descEn:
          "Integrated live classes with Zoom & Teams, recorded lessons and interactive whiteboards.",
        descAr:
          "فصول مباشرة متكاملة مع Zoom وTeams ودروس مسجلة وسبورات تفاعلية.",
      },
      {
        titleEn: "Mobile Learning Apps",
        titleAr: "تطبيقات تعلم عبر الجوال",
        categoryEn: "iOS & Android",
        categoryAr: "iOS و Android",
        descEn:
          "Native student apps to access courses, assignments, exams and notifications on the go.",
        descAr:
          "تطبيقات طلاب أصلية للوصول للمقررات والواجبات والاختبارات والإشعارات أثناء التنقل.",
      },
    ],
    relatedProjects: [
      { nameEn: "Step2English", nameAr: "ستيب تو إنجليش", href: "/our-projects" },
      { nameEn: "3alemny", nameAr: "علمني", href: "/our-projects" },
    ],
  },

  // ── AI Educational Platforms ────────────────────────────────────────────
  aiEdu: {
    eyebrowEn: "What We Build",
    eyebrowAr: "خدماتنا التعليمية بالذكاء الاصطناعي",
    headingEn: "Our AI Educational Platform Services",
    headingAr: "خدمات منصات التعليم بالذكاء الاصطناعي",
    keywordEn: "AI",
    keywordAr: "الذكاء الاصطناعي",
    subtitleEn:
      "We build AI-powered learning platforms with adaptive paths, virtual tutors and predictive analytics.",
    subtitleAr:
      "نبني منصات تعليمية مدعومة بالذكاء الاصطناعي مع مسارات تعلم تكيفية ومساعدين افتراضيين وتحليلات تنبؤية.",
    offerings: [
      {
        titleEn: "Adaptive Learning Paths",
        titleAr: "مسارات تعلم تكيفية",
        categoryEn: "Personalized Learning",
        categoryAr: "تعلم مخصص",
        descEn:
          "AI algorithms that adapt the curriculum and content to each student's pace, level and learning gaps.",
        descAr:
          "خوارزميات ذكاء اصطناعي تكيّف المنهج والمحتوى حسب سرعة ومستوى وفجوات تعلم كل طالب.",
      },
      {
        titleEn: "AI Tutors & Chatbots",
        titleAr: "مساعدين ومدرّسين بالذكاء الاصطناعي",
        categoryEn: "24/7 Virtual Assistants",
        categoryAr: "مساعدين على مدار الساعة",
        descEn:
          "Smart chatbots and virtual tutors that answer student questions and provide guidance any time.",
        descAr:
          "روبوتات محادثة ومدرّسون افتراضيون أذكياء يجيبون على أسئلة الطلاب ويقدمون الدعم في أي وقت.",
      },
      {
        titleEn: "Predictive Analytics & Auto-Grading",
        titleAr: "تحليلات تنبؤية وتصحيح آلي",
        categoryEn: "Smart Insights",
        categoryAr: "رؤى ذكية",
        descEn:
          "Machine-learning models that flag at-risk students early and AI grading that saves educators time.",
        descAr:
          "نماذج تعلم آلي ترصد الطلاب المتعثرين مبكراً وتصحيح آلي بالذكاء الاصطناعي يوفّر وقت المعلمين.",
      },
    ],
    relatedProjects: [
      { nameEn: "Step2English", nameAr: "ستيب تو إنجليش", href: "/our-projects" },
      { nameEn: "3alemny", nameAr: "علمني", href: "/our-projects" },
    ],
  },

  // ── School Management System ────────────────────────────────────────────
  school: {
    eyebrowEn: "What We Build",
    eyebrowAr: "خدماتنا التعليمية",
    headingEn: "Our School Management System Services",
    headingAr: "خدمات أنظمة إدارة المدارس",
    keywordEn: "School Management",
    keywordAr: "إدارة المدارس",
    subtitleEn:
      "We build complete school management systems with student records, attendance, grades, fees and a parent & teacher app.",
    subtitleAr:
      "نطوّر أنظمة إدارة مدارس متكاملة مع ملفات الطلاب والحضور والدرجات والرسوم وتطبيق لأولياء الأمور والمعلمين.",
    offerings: [
      {
        titleEn: "Student Information System",
        titleAr: "نظام معلومات الطلاب",
        categoryEn: "Admissions & Records",
        categoryAr: "القبول وملفات الطلاب",
        descEn:
          "Centralized student profiles, admissions, enrollment, classes and sections managed from one dashboard.",
        descAr:
          "ملفات طلاب مركزية مع القبول والتسجيل وإدارة الفصول والشُعب من لوحة تحكم واحدة.",
      },
      {
        titleEn: "Fees & Finance Management",
        titleAr: "إدارة الرسوم والحسابات",
        categoryEn: "Fees & Online Payments",
        categoryAr: "الرسوم والدفع الإلكتروني",
        descEn:
          "Fee plans, installments, invoices and online payment with Egyptian & Gulf gateways like Fawry and Mada.",
        descAr:
          "خطط رسوم وأقساط وفواتير ودفع إلكتروني عبر بوابات مصر والخليج مثل فوري ومدى.",
      },
      {
        titleEn: "Parent & Teacher App",
        titleAr: "تطبيق أولياء الأمور والمعلمين",
        categoryEn: "Mobile App",
        categoryAr: "تطبيق جوال",
        descEn:
          "iOS & Android apps with grades, attendance, fees, announcements and direct parent–teacher messaging.",
        descAr:
          "تطبيقات iOS وAndroid للدرجات والحضور والرسوم والإعلانات والتواصل المباشر بين المعلم وولي الأمر.",
      },
    ],
    relatedProjects: [
      { nameEn: "Step2English", nameAr: "ستيب تو إنجليش", href: "/our-projects" },
      { nameEn: "3alemny", nameAr: "علمني", href: "/our-projects" },
    ],
  },

  // ── Android App Development ──────────────────────────────────────────────
  android: {
    eyebrowEn: "What We Build",
    eyebrowAr: "خدمات تطبيقات الأندرويد",
    headingEn: "Our Android App Development Services",
    headingAr: "خدمات تطوير تطبيقات الأندرويد",
    keywordEn: "Android",
    keywordAr: "الأندرويد",
    subtitleEn:
      "We develop Android apps with Flutter, published on Google Play, with a polished Material Design UI and high performance.",
    subtitleAr:
      "نطوّر ونبرمج تطبيقات أندرويد احترافية بـ Flutter، منشورة على Google Play بواجهات Material Design وأداء عالٍ يناسب كل أجهزة الأندرويد.",
    offerings: [
      {
        titleEn: "Android Apps with Flutter",
        titleAr: "تطبيقات أندرويد بـ Flutter",
        categoryEn: "Built with Flutter",
        categoryAr: "تطوير بـ Flutter",
        descEn:
          "High-performance apps built with Flutter from a single codebase, optimized for phones and tablets.",
        descAr:
          "تطبيقات عالية الأداء مبنية بـ Flutter بكود واحد، محسّنة للهواتف والأجهزة اللوحية.",
      },
      {
        titleEn: "Google Play Publishing",
        titleAr: "النشر على Google Play",
        categoryEn: "Store Launch",
        categoryAr: "الإطلاق على المتجر",
        descEn:
          "We handle the full Google Play publishing process, store listing optimization and updates.",
        descAr:
          "نتولّى عملية النشر الكاملة على Google Play وتحسين صفحة المتجر والتحديثات.",
      },
      {
        titleEn: "Material Design UI/UX",
        titleAr: "تصميم واجهات Material",
        categoryEn: "Modern Interfaces",
        categoryAr: "واجهات عصرية",
        descEn:
          "Clean, modern interfaces following Google's Material Design guidelines with full Arabic RTL support.",
        descAr:
          "واجهات نظيفة وعصرية تتبع معايير Material Design من Google مع دعم عربي كامل (RTL).",
      },
    ],
    relatedProjects: [
      { nameEn: "Buzz", nameAr: "باز", href: "/our-projects" },
      { nameEn: "Tawreedat Go", nameAr: "توريدات جو", href: "/our-projects" },
    ],
  },

  // ── iPhone (iOS) App Development ─────────────────────────────────────────
  ios: {
    eyebrowEn: "What We Build",
    eyebrowAr: "خدمات تطبيقات الآيفون",
    headingEn: "Our iPhone App Development Services",
    headingAr: "خدمات تطوير تطبيقات الآيفون",
    keywordEn: "iPhone",
    keywordAr: "الآيفون",
    subtitleEn:
      "We develop iOS apps with Flutter, published on the App Store, following Apple's Human Interface Guidelines.",
    subtitleAr:
      "نطوّر ونبرمج تطبيقات آيفون بـ Flutter، منشورة على App Store وفق معايير Apple وتجربة استخدام راقية.",
    offerings: [
      {
        titleEn: "iOS Apps with Flutter",
        titleAr: "تطبيقات آيفون بـ Flutter",
        categoryEn: "Built with Flutter",
        categoryAr: "تطوير بـ Flutter",
        descEn:
          "Smooth, fast iOS apps built with Flutter for iPhone and iPad from a single codebase.",
        descAr:
          "تطبيقات آيفون سريعة وسلسة مبنية بـ Flutter للآيفون والآيباد بكود واحد.",
      },
      {
        titleEn: "App Store Publishing",
        titleAr: "النشر على App Store",
        categoryEn: "Store Launch",
        categoryAr: "الإطلاق على المتجر",
        descEn:
          "We manage the full App Store submission, review and publishing process on your behalf.",
        descAr:
          "ندير عملية رفع التطبيق ومراجعته ونشره على App Store بالكامل نيابة عنك.",
      },
      {
        titleEn: "Premium UI & Apple Ecosystem",
        titleAr: "واجهات راقية وتكامل أبل",
        categoryEn: "HIG & Integrations",
        categoryAr: "تصميم وتكامل",
        descEn:
          "Elegant interfaces following Apple's HIG, with Apple Pay, push notifications and ecosystem integrations.",
        descAr:
          "واجهات أنيقة وفق معايير Apple، مع Apple Pay والإشعارات والتكامل مع منظومة أبل.",
      },
    ],
    relatedProjects: [
      { nameEn: "Buzz", nameAr: "باز", href: "/our-projects" },
      { nameEn: "PayPoints", nameAr: "بايبوينس", href: "/our-projects" },
    ],
  },

  // ── Website Design & Development ──────────────────────────────────────────
  web: {
    eyebrowEn: "What We Build",
    eyebrowAr: "خدمات تصميم المواقع",
    headingEn: "Our Web Development Services",
    headingAr: "خدمات تطوير مواقع الإنترنت",
    keywordEn: "Web",
    keywordAr: "المواقع",
    subtitleEn:
      "We develop fast, responsive, SEO-friendly websites — corporate sites, landing pages and web apps.",
    subtitleAr:
      "نطوّر ونبرمج مواقع إنترنت سريعة ومتجاوبة وصديقة لمحركات البحث — مواقع شركات وصفحات هبوط وتطبيقات ويب.",
    offerings: [
      {
        titleEn: "Corporate & Business Websites",
        titleAr: "مواقع الشركات والأعمال",
        categoryEn: "Brand Presence",
        categoryAr: "هوية رقمية",
        descEn:
          "Professional company websites that present your brand, services and identity with a modern design.",
        descAr:
          "مواقع شركات احترافية تعرض علامتك التجارية وخدماتك وهويتك بتصميم عصري.",
      },
      {
        titleEn: "Responsive & SEO-Ready",
        titleAr: "متجاوب ومهيأ لمحركات البحث",
        categoryEn: "Mobile-First & SEO",
        categoryAr: "متجاوب و SEO",
        descEn:
          "Fast, mobile-first websites optimized for Google search to bring you real organic traffic.",
        descAr:
          "مواقع سريعة متجاوبة مع كل الشاشات ومحسّنة لمحرك بحث Google لجلب زيارات حقيقية.",
      },
      {
        titleEn: "Custom Web Apps & CMS",
        titleAr: "تطبيقات ويب وأنظمة إدارة",
        categoryEn: "Web Apps & Dashboards",
        categoryAr: "تطبيقات ولوحات تحكم",
        descEn:
          "Custom web applications, dashboards and content management systems you can update yourself.",
        descAr:
          "تطبيقات ويب ولوحات تحكم وأنظمة إدارة محتوى مخصصة يمكنك تحديثها بنفسك.",
      },
    ],
    relatedProjects: [
      { nameEn: "Tawreedat Go", nameAr: "توريدات جو", href: "/our-projects" },
      { nameEn: "Step2English", nameAr: "ستيب تو إنجليش", href: "/our-projects" },
    ],
  },
};
