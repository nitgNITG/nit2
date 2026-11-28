import { useTranslations, useLocale } from "next-intl";
import Navbar from "../../components/Navbar";
import LocaleLink from "../../components/LocaleLink";

export default function VideosHeader() {
    const t = useTranslations('videos');
    const locale = useLocale();
    const isAr = locale === 'ar';

    const topics = isAr ? [
        'تطبيقات الجوال iOS & Android',
        'منصات Moodle التعليمية',
        'متاجر وتطبيقات التجارة الإلكترونية',
        'أنظمة التوصيل والمطاعم والولاء',
    ] : [
        'iOS & Android Mobile Apps',
        'Moodle LMS Platforms',
        'eCommerce Apps & Stores',
        'Delivery, Restaurant & Loyalty Systems',
    ];

    return (
        <header>
            <div className='relative overflow-hidden min-h-[75svh] lg:min-h-[70svh] flex flex-col bg-[url("/header_img.jpg")] bg-center bg-cover bg-no-repeat p-container'>

                {/* Overlay matching NIT signature brand gradient */}
                <div
                    className='absolute inset-0'
                    style={{
                        background: 'linear-gradient(135deg, rgba(10,21,32,0.60) 0%, rgba(15,31,46,0.50) 50%, rgba(13,40,24,0.55) 100%)'
                    }}
                />

                {/* Subtle diamond geometric accents */}
                <div className='absolute -top-10 -right-10 w-64 h-64 opacity-20 pointer-events-none'>
                    <div className='absolute inset-0 rotate-45 rounded-2xl border-2 border-[#00FFCD]' />
                    <div className='absolute inset-6 rotate-45 rounded-xl border border-[#1E7D67]' />
                </div>
                <div className='absolute bottom-10 left-10 w-44 h-44 opacity-15 pointer-events-none'>
                    <div className='absolute inset-0 rotate-45 rounded-xl border-2 border-[#00FFCD]' />
                </div>

                {/* Top accent glow line */}
                <div
                    className='absolute top-0 left-0 right-0 h-[2px] z-10'
                    style={{ background: 'linear-gradient(90deg, transparent, #1E7D67, #00FFCD, #1E7D67, transparent)' }}
                />

                {/* Navbar */}
                <div className='py-10 relative z-[99]'>
                    <Navbar />
                </div>

                {/* Hero content */}
                <div className='flex-1 flex items-center justify-center relative z-10 pb-16'>
                    <div className='text-center space-y-5 max-w-3xl px-4'>

                        {/* Glowing Pill Badge */}
                        <div className='flex justify-center'>
                            <span className='inline-flex items-center gap-1.5 bg-[#1E7D67]/30 border border-[#00FFCD]/40 text-[#00FFCD] text-xs font-bold px-4 py-1.5 rounded-full tracking-wider uppercase shadow-[0_0_15px_rgba(0,255,205,0.15)]'>
                                <span className='size-1.5 rounded-full bg-[#00FFCD] animate-ping' />
                                {t('badge')}
                            </span>
                        </div>

                        {/* Main H1 Heading */}
                        <h1 className='text-2xl md:text-3xl lg:text-4xl 2xl:text-5xl font-extrabold text-white leading-tight drop-shadow-md'>
                            {t('heading')}
                        </h1>

                        {/* Subtitle */}
                        <p className='text-white/85 text-sm md:text-base lg:text-lg font-medium max-w-2xl mx-auto leading-relaxed drop-shadow'>
                            {t('subheading')}
                        </p>

                        {/* Topics Pill Row */}
                        <div className='flex flex-wrap gap-2 justify-center pt-1'>
                            {topics.map((topic, i) => (
                                <span
                                    key={i}
                                    className='bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/20 text-white/90 text-xs font-medium px-3.5 py-1.5 rounded-full transition-colors'
                                >
                                    {topic}
                                </span>
                            ))}
                        </div>

                        {/* CTA button */}
                        <div className='pt-2'>
                            <LocaleLink
                                href='/contact'
                                className='inline-flex items-center gap-2 bg-gradient-to-b from-[#1E7D67] to-[#0B2923] border border-[#00FFCD]/50 px-6 py-3 rounded-xl shadow-lg hover:shadow-[0_0_20px_rgba(0,255,178,0.3)] hover:scale-[1.02] transition-all'
                            >
                                <span className='text-[#00FFB2] font-bold text-sm'>
                                    {isAr ? 'ابدأ مشروعك معنا الآن' : 'Start Your Project With Us'}
                                </span>
                            </LocaleLink>
                        </div>

                    </div>
                </div>
            </div>
        </header>
    );
}
