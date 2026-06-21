import React from 'react'
import OurProjectsHeader from './components/OurProjectsHeader'
import Learingprojects from './components/Learingprojects'
import CommerceProjects from './components/CommerceProjects'
import Footer from '../components/Footer'
import BreadcrumbsJsonLd from '../components/BreadcrumbsJsonLd'
import ScrollReveal from '../components/ScrollReveal'

const OurProjectsPage = () => {
    return (
        <main>
            <BreadcrumbsJsonLd items={[{ path: 'our-projects', ar: 'مشاريعنا', en: 'Our Projects' }]} />
            <OurProjectsHeader />

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

            <Footer />
        </main>
    )
}

export default OurProjectsPage
