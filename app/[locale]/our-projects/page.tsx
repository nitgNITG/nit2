import React from 'react'
import { getLocale } from 'next-intl/server'
import OurProjectsHeader from './components/OurProjectsHeader'
import Learingprojects from './components/Learingprojects'
import CommerceProjects from './components/CommerceProjects'
import FeaturedProjectsBand from './components/FeaturedProjectsBand'
import Footer from '../components/Footer'
import BreadcrumbsJsonLd from '../components/BreadcrumbsJsonLd'
import ScrollReveal from '../components/ScrollReveal'
import { PromoLightboxProvider } from '../components/promo/PromoLightbox'
import { getFeaturedProjects } from '@/lib/projectShowcase'
import { videoObjectJsonLd } from '@/lib/promo'

const OurProjectsPage = async () => {
    const locale = await getLocale()
    // 0 featured promos → no band, and the hero keeps its normal padding (page as before).
    const featured = await getFeaturedProjects(locale)
    const videoLd = featured.map((p) => videoObjectJsonLd(p, locale)).filter(Boolean)

    return (
        <main>
            <BreadcrumbsJsonLd items={[{ path: 'our-projects', ar: 'مشاريعنا', en: 'Our Projects' }]} />
            {videoLd.length > 0 && (
                <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(videoLd.length === 1 ? videoLd[0] : videoLd) }} />
            )}
            <PromoLightboxProvider locale={locale}>
                <OurProjectsHeader withFeatured={featured.length > 0} />
                {featured.length > 0 && <FeaturedProjectsBand projects={featured} locale={locale} />}

                {/* LMS Platforms section */}
                <ScrollReveal>
                    <section aria-label="Educational Platforms - منصات تعليمية">
                        <Learingprojects />
                    </section>
                </ScrollReveal>

                {/* eCommerce Apps section */}
                <ScrollReveal>
                    <section aria-label="eCommerce Applications - تطبيقات التجارة الإلكترونية">
                        <CommerceProjects />
                    </section>
                </ScrollReveal>
            </PromoLightboxProvider>

            <Footer />
        </main>
    )
}

export default OurProjectsPage
