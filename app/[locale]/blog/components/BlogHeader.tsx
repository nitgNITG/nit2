import { useTranslations, useLocale } from "next-intl";
import Navbar from "../../components/Navbar"
import LocaleLink from "../../components/LocaleLink";

const BlogHeader = () => {
    const t = useTranslations('blog');
    const locale = useLocale();
    const isAr = locale === 'ar';

    return (
        <header className='bg-gradient-to-br from-[#0B2923] via-[#0d3329] to-[#1a4f40]'>
            <div className='p-container'>
                <div className='py-10'>
                    <Navbar />
                </div>

                <div className={`pb-16 max-w-3xl ${isAr ? 'text-right mr-auto' : 'text-left ml-0'}`}>
                    {/* Badge */}
                    <span className='inline-block bg-[#268F79]/30 border border-[#268F79] text-[#00FFB2] text-xs font-bold px-4 py-1.5 rounded-full mb-5 tracking-wider uppercase'>
                        {t('badge')}
                    </span>

                    <h1 className='text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-snug mb-4'>
                        {t('heading')}
                    </h1>

                    <p className='text-white/70 text-lg leading-relaxed mb-8'>
                        {t('subheading')}
                    </p>

                    {/* Topics row */}
                    <div className='flex flex-wrap gap-2 mb-8'>
                        {(['topic1', 'topic2', 'topic3', 'topic4'] as const).map((key) => (
                            <span
                                key={key}
                                className='bg-white/10 border border-white/20 text-white/80 text-xs font-semibold px-3 py-1.5 rounded-full'
                            >
                                {t(key)}
                            </span>
                        ))}
                    </div>

                    {/* CTA */}
                    <LocaleLink
                        href='/get-quote'
                        className='inline-block bg-gradient-to-b from-[#268F79] to-[#0B2923] border border-[#268F79] px-6 py-3 rounded-lg'
                    >
                        <span className='text-[#00FFB2] font-bold text-sm'>
                            {isAr ? 'احصل على عرض سعر مجاني' : 'Get a Free Quote'}
                        </span>
                    </LocaleLink>
                </div>
            </div>
        </header>
    )
}

export default BlogHeader
