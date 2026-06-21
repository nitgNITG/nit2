import { getLocale } from 'next-intl/server'
import LocaleLink from './LocaleLink'

// ── Government project data ───────────────────────────────────────────────
const PROJECTS = [
    {
        icon: '🤖',
        ministry: { ar: 'وزارة الاتصالات — مركز AIC', en: 'Ministry of Communications — AIC' },
        title: { ar: 'تعليم الإنجليزية بالذكاء الاصطناعي', en: 'AI-Powered English Learning App' },
        desc: {
            ar: 'تطبيق Step English يُعلّم النطق، القواعد، والمحادثة بالذكاء الاصطناعي — مسارات متدرجة من المبتدئ إلى المتقدم',
            en: 'Step English app teaches pronunciation, grammar & conversation via AI — structured paths from beginner to advanced',
        },
        tags: ['AI', 'Flutter', 'iOS & Android'],
        color: '#1E7D67',
    },
    {
        icon: '📚',
        ministry: { ar: 'وزارة التربية والتعليم', en: 'Ministry of Education' },
        title: { ar: 'منصة التعليم التفاعلي K-4 إلى K-6', en: 'Interactive Learning Platform K-4 to K-6' },
        desc: {
            ar: 'محتوى رقمي تفاعلي لمناهج وزارة التربية — تعلم ذاتي وتفاعل فوري بين الطالب والمحتوى الدراسي',
            en: 'Interactive digital curriculum content for the Ministry of Education — self-paced learning with real-time student engagement',
        },
        tags: ['E-Learning', 'Arabic RTL', 'LMS'],
        color: '#1a6e8a',
    },
    {
        icon: '🎮',
        ministry: { ar: 'وزارة القوى العاملة', en: 'Ministry of Labour' },
        title: { ar: 'أكاديمية التدريب المهني — محاكاة ثلاثية الأبعاد', en: 'Vocational Training Academy — 3D Simulation' },
        desc: {
            ar: 'تحويل مناهج التدريب إلى محاكاة 3D تفاعلية — كهرباء، صيانة، حرف مهنية — تدريب آمن بدون مخاطر حقيقية',
            en: 'Converting training content into interactive 3D simulations — electricity, maintenance, technical crafts — safe training without real hazards',
        },
        tags: ['3D Simulation', 'Moodle LMS', 'VR-Ready'],
        color: '#7c4dbd',
    },
    {
        icon: '🕌',
        ministry: { ar: 'دار الإفتاء المصرية', en: 'Dar Al-Ifta Egypt' },
        title: { ar: 'البوابة الرقمية لإعداد المفتين عن بعد', en: 'Digital Portal for Remote Mufti Preparation' },
        desc: {
            ar: 'منصة المحتوى الديني ونظام الفتاوى الرقمي — تأهيل المفتين عن بعد بمحتوى علمي متخصص ومنهجي',
            en: 'Religious content platform and digital fatwa system — remote preparation of muftis with structured scholarly content',
        },
        tags: ['Custom LMS', 'Arabic', 'Remote Learning'],
        color: '#b5860d',
    },
]

// ── Differentiators vs generic competitors ────────────────────────────────
const DIFFS = {
    ar: [
        { icon: '🏛️', text: 'موثوق من وزارات حكومية مصرية رسمية' },
        { icon: '🤖', text: 'تطبيقات ذكاء اصطناعي — مش مجرد Moodle' },
        { icon: '🎮', text: 'محاكاة 3D تفاعلية لتدريبات عالية المخاطر' },
        { icon: '🌍', text: 'تطبيقات حية في السوق السعودي على المتاجر الرسمية' },
    ],
    en: [
        { icon: '🏛️', text: 'Trusted by official Egyptian government ministries' },
        { icon: '🤖', text: 'AI-powered apps — not just standard Moodle' },
        { icon: '🎮', text: 'Interactive 3D simulations for high-risk training' },
        { icon: '🌍', text: 'Live apps in the Saudi market on official app stores' },
    ],
}

export default async function GovernmentProjects() {
    const locale = await getLocale()
    const isAr = locale === 'ar'

    return (
        <section className='bg-gradient-to-br from-[#071c18] via-[#0B2923] to-[#0d3329] py-16 lg:py-24'>
            <div className='p-container'>

                {/* ── Header ── */}
                <div className={`mb-12 ${isAr ? 'text-right' : 'text-left'}`}>
                    <span className='inline-block bg-[#00FFB2]/10 border border-[#00FFB2]/30 text-[#00FFB2] text-xs font-bold px-4 py-1.5 rounded-full mb-5 tracking-widest uppercase'>
                        {isAr ? 'شراكات حكومية موثقة' : 'Documented Government Partnerships'}
                    </span>
                    <h2 className='text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-snug mb-3'>
                        {isAr
                            ? <>نبني أكثر من Moodle —<br /><span className='text-[#00FFB2]'>ذكاء اصطناعي، محاكاة 3D، وحلول حكومية</span></>
                            : <>We build beyond Moodle —<br /><span className='text-[#00FFB2]'>AI Apps, 3D Simulations & Government Solutions</span></>
                        }
                    </h2>
                    <p className='text-white/60 text-base max-w-2xl'>
                        {isAr
                            ? 'وزارات مصرية رسمية اختارت N.I.T لمشاريعها التقنية الكبرى — ثقة لا تُبنى بالإعلانات بل بالإنجاز'
                            : 'Official Egyptian government ministries chose N.I.T for their major tech projects — trust built through delivery, not advertising'
                        }
                    </p>
                </div>

                {/* ── Project cards ── */}
                <div className='grid grid-cols-1 md:grid-cols-2 gap-5 mb-10'>
                    {PROJECTS.map((p) => {
                        const ministry = isAr ? p.ministry.ar : p.ministry.en
                        const title = isAr ? p.title.ar : p.title.en
                        const desc = isAr ? p.desc.ar : p.desc.en

                        return (
                            <div
                                key={title}
                                className='bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/8 transition-colors group'
                            >
                                <div className={`flex items-start gap-4 ${isAr ? 'flex-row-reverse text-right' : 'text-left'}`}>
                                    {/* Icon */}
                                    <div
                                        className='w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 mt-0.5'
                                        style={{ background: `${p.color}22`, border: `1px solid ${p.color}44` }}
                                    >
                                        {p.icon}
                                    </div>

                                    <div className='flex-1 min-w-0'>
                                        {/* Ministry name */}
                                        <p className='text-xs font-semibold mb-1' style={{ color: p.color }}>
                                            {ministry}
                                        </p>

                                        {/* Project title */}
                                        <h3 className='text-white font-bold text-base leading-snug mb-2'>
                                            {title}
                                        </h3>

                                        {/* Description */}
                                        <p className='text-white/60 text-sm leading-relaxed mb-4'>
                                            {desc}
                                        </p>

                                        {/* Tech tags */}
                                        <div className={`flex flex-wrap gap-2 ${isAr ? 'justify-end' : 'justify-start'}`}>
                                            {p.tags.map((tag) => (
                                                <span
                                                    key={tag}
                                                    className='text-xs px-2.5 py-1 rounded-full font-semibold'
                                                    style={{ background: `${p.color}22`, color: p.color, border: `1px solid ${p.color}44` }}
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* ── Differentiators strip ── */}
                <div className='border border-white/10 rounded-2xl p-6 bg-white/3'>
                    <p className={`text-white/50 text-xs font-semibold uppercase tracking-widest mb-4 ${isAr ? 'text-right' : 'text-left'}`}>
                        {isAr ? 'ما يميزنا عن شركات Moodle الأخرى' : 'What sets us apart from other Moodle companies'}
                    </p>
                    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                        {DIFFS[isAr ? 'ar' : 'en'].map((d) => (
                            <div key={d.text} className={`flex items-center gap-3 ${isAr ? 'flex-row-reverse text-right' : 'text-left'}`}>
                                <span className='text-xl flex-shrink-0'>{d.icon}</span>
                                <span className='text-white/80 text-sm font-medium leading-snug'>{d.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── CTA ── */}
                <div className={`mt-8 flex flex-wrap gap-3 ${isAr ? 'justify-end' : 'justify-start'}`}>
                    <LocaleLink
                        href='/get-quote'
                        className='inline-block bg-[#00FFB2] text-[#0B2923] font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity text-sm'
                    >
                        {isAr ? 'احصل على عرض سعر — خلال 24 ساعة' : 'Get a Quote — within 24 Hours'}
                    </LocaleLink>
                    <a
                        href='https://wa.me/201091568240'
                        target='_blank' rel='noreferrer'
                        className='inline-block border-2 border-green-400/50 text-green-400 font-bold px-6 py-3 rounded-lg hover:bg-green-400/10 transition-colors text-sm'
                    >
                        💬 {isAr ? 'استشارة مجانية على واتساب' : 'Free WhatsApp Consultation'}
                    </a>
                </div>

            </div>
        </section>
    )
}
