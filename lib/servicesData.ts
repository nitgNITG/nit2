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
  | "loyalty";

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
};
