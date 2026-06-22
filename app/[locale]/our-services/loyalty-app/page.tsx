import React from 'react'
import FAQSchema from '../../components/FAQSchema'
import FAQSection from '../../components/FAQSection'
import BreadcrumbsJsonLd from '../../components/BreadcrumbsJsonLd'
import LoyaltyHeader from './components/LoyaltyHeader'
import LoyaltyFeatures from './components/LoyaltyFeatures'
import LoyaltyMarkets from './components/LoyaltyMarkets'
import ServiceOfferings from '../../components/ServiceOfferings'
import LoyaltyProcess from './components/LoyaltyProcess'
import LoyaltyPricing from './components/LoyaltyPricing'
import Contact from '../../components/Contact'
import Footer from '../../components/Footer'
import SocialMedia from '../../components/SocialMedia'
import DownSide from '../../components/DownSide'
import ScrollReveal from '../../components/ScrollReveal'

export default function LoyaltyPage() {
    return (
        <div className='overflow-y-hidden'>
            <FAQSchema page="loyalty" />
            <BreadcrumbsJsonLd items={[{ path: 'our-services/loyalty-app', ar: 'تطوير أنظمة الولاء', en: 'Loyalty App Development' }]} />
            <LoyaltyHeader />
            <ScrollReveal><LoyaltyFeatures /></ScrollReveal>
            <ScrollReveal><LoyaltyMarkets /></ScrollReveal>
            <ScrollReveal><ServiceOfferings service="loyalty" /></ScrollReveal>
            <ScrollReveal><LoyaltyProcess /></ScrollReveal>
            <ScrollReveal><LoyaltyPricing /></ScrollReveal>
            <ScrollReveal><FAQSection page="loyalty" /></ScrollReveal>
            <ScrollReveal><Contact key='loyalty-contact' /></ScrollReveal>
            <Footer />
            <SocialMedia />
            <DownSide />
        </div>
    )
}
