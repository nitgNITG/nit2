import React from 'react'
import { getLocale } from 'next-intl/server'
import LocaleLink from './LocaleLink'
import { servicesData, type ServiceKey } from '@/lib/servicesData'

/** Color-highlight `keyword` inside `text` (first match only). */
const highlight = (text: string, keyword?: string) => {
    if (!keyword) return text
    const i = text.indexOf(keyword)
    if (i === -1) return text
    return (
        <>
            {text.slice(0, i)}
            <span className='text-darkAquaMint'>{keyword}</span>
            {text.slice(i + keyword.length)}
        </>
    )
}

/**
 * Bilingual "services we provide" section for each /our-services/<slug> page.
 * Locale-aware: renders only the active language (Arabic on /ar, English on /en)
 * to match the rest of the site and keep each localized page's keyword focus clean.
 * Reframes the previous "Live Apps" sections so they read as SERVICES we offer
 * (not our own products), with optional links to real live projects as proof.
 */
const ServiceOfferings = async ({ service }: { service: ServiceKey }) => {
    const locale = await getLocale()
    const isAr = locale === 'ar'
    const data = servicesData[service]

    const align = isAr ? 'text-right' : 'text-left'
    const dir = isAr ? 'rtl' : 'ltr'

    return (
        <section className='p-container py-10 lg:py-20' dir={dir}>
            {/* Heading */}
            <div className='space-y-5 mb-10'>
                <p className='text-center text-sm text-gray-500'>{isAr ? data.eyebrowAr : data.eyebrowEn}</p>
                <div className='flex -space-x-5 lg:-space-x-8 items-center justify-center'>
                    <div className='size-12 md:size-14 rotate-45 rounded-lg bg-aquaMint border-2 border-black' />
                    <div className='z-10 text-center px-4'>
                        <h2 className='text-2xl md:text-3xl font-bold text-shadow'>
                            {isAr
                                ? highlight(data.headingAr, data.keywordAr)
                                : highlight(data.headingEn, data.keywordEn)}
                        </h2>
                    </div>
                    <div className='size-12 md:size-14 rotate-45 rounded-lg bg-aquaMint border-2 border-black' />
                </div>
                <p className='text-center text-gray-500 text-sm max-w-2xl mx-auto'>
                    {isAr ? data.subtitleAr : data.subtitleEn}
                </p>
            </div>

            {/* Offering cards — services we build */}
            <div className='grid grid-cols-12 gap-6'>
                {data.offerings.map((o, i) => (
                    <div key={i} className='col-span-12 md:col-span-6 lg:col-span-4'>
                        <div className='bg-white border rounded-xl p-6 space-y-3 h-full hover:shadow-lg transition-shadow duration-200'>
                            <span className='inline-block text-xs font-semibold text-[#268F79] bg-[#268F79]/10 px-3 py-1 rounded-full'>
                                {isAr ? o.categoryAr : o.categoryEn}
                            </span>
                            <h3 className={`font-bold text-lg ${align}`}>{isAr ? o.titleAr : o.titleEn}</h3>
                            <p className={`text-sm text-gray-500 ${align}`}>{isAr ? o.descAr : o.descEn}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Live proof — real projects from /our-projects */}
            {data.relatedProjects.length > 0 && (
                <div className='mt-10 bg-[#F2F3FA] border rounded-xl p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between'>
                    <p className={`text-sm font-semibold text-gray-700 text-center ${isAr ? 'sm:text-right' : 'sm:text-left'}`}>
                        {isAr
                            ? 'شاهد أمثلة حية على هذه الخدمة في مشاريعنا'
                            : 'See live examples of this service in our projects'}
                    </p>
                    <div className='flex flex-wrap gap-2 justify-center'>
                        {data.relatedProjects.map((p) => (
                            <LocaleLink
                                key={p.nameEn}
                                href={p.href}
                                className='flex items-center gap-2 bg-white border rounded-full px-4 py-1.5 hover:border-[#268F79] hover:shadow-sm transition'
                            >
                                <span className='size-2 rounded-full bg-green-400' />
                                <span className='text-sm font-semibold text-gray-800'>{isAr ? p.nameAr : p.nameEn}</span>
                            </LocaleLink>
                        ))}
                    </div>
                </div>
            )}

            {/* CTA */}
            <div className='flex justify-center mt-10'>
                <LocaleLink href='/our-projects' className='bg-gradient-to-b from-[#268F79] to-[#0B2923] px-6 py-3 rounded-md'>
                    <span className='text-[#00FFB2] font-bold'>{isAr ? 'شاهد كل المشاريع' : 'View All Projects'}</span>
                </LocaleLink>
            </div>
        </section>
    )
}

export default ServiceOfferings
