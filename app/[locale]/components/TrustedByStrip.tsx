/* eslint-disable @next/next/no-img-element */
import { getLocale } from 'next-intl/server'
import prisma from '@/prisma/client'

async function getSponsors() {
    try {
        return await prisma.sponser.findMany()
    } catch {
        return []
    }
}

// Fallback text names if logos not yet uploaded to DB
const FALLBACK = {
    ar: [
        'وزارة الاتصالات',
        'وزارة التربية والتعليم',
        'وزارة القوى العاملة',
        'دار الإفتاء المصرية',
    ],
    en: [
        'Ministry of Communications',
        'Ministry of Education',
        'Ministry of Labour',
        'Dar Al-Ifta Egypt',
    ],
}

export default async function TrustedByStrip() {
    const [sponsors, locale] = await Promise.all([getSponsors(), getLocale()])
    const isAr = locale === 'ar'
    const hasLogos = sponsors.length > 0

    return (
        <div className='bg-white border-b border-gray-100 shadow-sm'>
            <div className='p-container py-4'>
                <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 ${isAr ? 'flex-row-reverse' : ''}`}>

                    {/* Label */}
                    <div className={`flex items-center gap-2 flex-shrink-0 ${isAr ? 'flex-row-reverse' : ''}`}>
                        <span className='inline-block w-2 h-2 rounded-full bg-[#268F79]' />
                        <span className='text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap'>
                            {isAr ? 'موثوق من قِبَل' : 'Trusted by'}
                        </span>
                    </div>

                    {/* Divider */}
                    <div className='hidden sm:block w-px h-8 bg-gray-200 flex-shrink-0' />

                    {/* Logos */}
                    {hasLogos ? (
                        <div className={`flex flex-wrap items-center gap-6 lg:gap-10 ${isAr ? 'flex-row-reverse' : ''}`}>
                            {sponsors.map((s) => (
                                <img
                                    key={s.id}
                                    src={s.img}
                                    alt='Client logo'
                                    className='h-9 w-auto object-contain grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-300'
                                />
                            ))}
                        </div>
                    ) : (
                        /* Text fallback until logos are uploaded */
                        <div className={`flex flex-wrap gap-x-6 gap-y-1 ${isAr ? 'flex-row-reverse' : ''}`}>
                            {FALLBACK[isAr ? 'ar' : 'en'].map((name) => (
                                <span key={name} className='text-sm font-semibold text-gray-400'>
                                    {name}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Gov badge — end of row */}
                    <div className={`${isAr ? 'mr-auto' : 'ml-auto'} flex-shrink-0 hidden md:block`}>
                        <span className='text-xs bg-[#268F79]/10 text-[#268F79] border border-[#268F79]/20 font-semibold px-3 py-1 rounded-full'>
                            {isAr ? '🏛️ شريك حكومي موثوق منذ 2013' : '🏛️ Trusted Government Partner since 2013'}
                        </span>
                    </div>

                </div>
            </div>
        </div>
    )
}
