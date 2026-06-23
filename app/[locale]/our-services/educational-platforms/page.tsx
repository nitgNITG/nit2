import React from 'react'
import FAQSchema from '../../components/FAQSchema'
import FAQSection from '../../components/FAQSection'
import BreadcrumbsJsonLd from '../../components/BreadcrumbsJsonLd'
import Contact from '../../components/Contact'
import Footer from '../../components/Footer'
import SocialMedia from '../../components/SocialMedia'
import DownSide from '../../components/DownSide'
import ScrollReveal from '../../components/ScrollReveal'
import ServiceOfferings from '../../components/ServiceOfferings'
import EduHeader from './components/EduHeader'
import EduFeatures from './components/EduFeatures'
import EduMarkets from './components/EduMarkets'
import EduProcess from './components/EduProcess'
import EduPricing from './components/EduPricing'

export default function EducationalPlatformsPage() {
    return (
        <div className='overflow-y-hidden'>
            <FAQSchema page="edu" />
            <BreadcrumbsJsonLd items={[{ path: 'our-services/educational-platforms', ar: 'منصات تعليمية', en: 'Educational Platforms' }]} />
            <EduHeader />
            <ScrollReveal><EduFeatures /></ScrollReveal>
            <ScrollReveal><EduMarkets /></ScrollReveal>
            <ScrollReveal><ServiceOfferings service="edu" /></ScrollReveal>
            <ScrollReveal><EduProcess /></ScrollReveal>
            <ScrollReveal><EduPricing /></ScrollReveal>
            <ScrollReveal><FAQSection page="edu" /></ScrollReveal>
            <ScrollReveal><Contact key='edu-contact' /></ScrollReveal>
            <Footer />
            <SocialMedia />
            <DownSide />
        </div>
    )
}
