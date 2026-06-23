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
import AIEduHeader from './components/AIEduHeader'
import AIEduFeatures from './components/AIEduFeatures'
import AIEduMarkets from './components/AIEduMarkets'
import AIEduProcess from './components/AIEduProcess'
import AIEduPricing from './components/AIEduPricing'

export default function AIEducationalPlatformsPage() {
    return (
        <div className='overflow-y-hidden'>
            <FAQSchema page="aiEdu" />
            <BreadcrumbsJsonLd items={[{ path: 'our-services/ai-educational-platforms', ar: 'منصات تعليم بالذكاء الاصطناعي', en: 'AI Educational Platforms' }]} />
            <AIEduHeader />
            <ScrollReveal><AIEduFeatures /></ScrollReveal>
            <ScrollReveal><AIEduMarkets /></ScrollReveal>
            <ScrollReveal><ServiceOfferings service="aiEdu" /></ScrollReveal>
            <ScrollReveal><AIEduProcess /></ScrollReveal>
            <ScrollReveal><AIEduPricing /></ScrollReveal>
            <ScrollReveal><FAQSection page="aiEdu" /></ScrollReveal>
            <ScrollReveal><Contact key='ai-edu-contact' /></ScrollReveal>
            <Footer />
            <SocialMedia />
            <DownSide />
        </div>
    )
}
