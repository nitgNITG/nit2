import React from 'react'
import FAQSchema from '../../components/FAQSchema'
import FAQSection from '../../components/FAQSection'
import BreadcrumbsJsonLd from '../../components/BreadcrumbsJsonLd'
import WebHeader from './components/WebHeader'
import WebFeatures from './components/WebFeatures'
import ServiceOfferings from '../../components/ServiceOfferings'
import WebMarkets from './components/WebMarkets'
import WebProcess from './components/WebProcess'
import WebPricing from './components/WebPricing'
import Contact from '../../components/Contact'
import Footer from '../../components/Footer'
import SocialMedia from '../../components/SocialMedia'
import DownSide from '../../components/DownSide'
import ScrollReveal from '../../components/ScrollReveal'

export default function WebsiteDesignPage() {
    return (
        <div className='overflow-y-hidden'>
            <FAQSchema page="web" />
            <BreadcrumbsJsonLd items={[{ path: 'our-services/website-design', ar: 'تصميم مواقع الإنترنت', en: 'Website Design & Development' }]} />
            <WebHeader />
            <ScrollReveal><WebFeatures /></ScrollReveal>
            <ScrollReveal><WebMarkets /></ScrollReveal>
            <ScrollReveal><ServiceOfferings service="web" /></ScrollReveal>
            <ScrollReveal><WebProcess /></ScrollReveal>
            <ScrollReveal><WebPricing /></ScrollReveal>
            <ScrollReveal><FAQSection page="web" /></ScrollReveal>
            <ScrollReveal><Contact key='web-contact' /></ScrollReveal>
            <Footer />
            <SocialMedia />
            <DownSide />
        </div>
    )
}
