import React from 'react'
import FAQSchema from '../../components/FAQSchema'
import FAQSection from '../../components/FAQSection'
import BreadcrumbsJsonLd from '../../components/BreadcrumbsJsonLd'
import AndroidHeader from './components/AndroidHeader'
import AndroidFeatures from './components/AndroidFeatures'
import ServiceOfferings from '../../components/ServiceOfferings'
import AndroidMarkets from './components/AndroidMarkets'
import AndroidProcess from './components/AndroidProcess'
import AndroidPricing from './components/AndroidPricing'
import Contact from '../../components/Contact'
import Footer from '../../components/Footer'
import SocialMedia from '../../components/SocialMedia'
import DownSide from '../../components/DownSide'
import ScrollReveal from '../../components/ScrollReveal'

export default function AndroidPage() {
    return (
        <div className='overflow-y-hidden'>
            <FAQSchema page="android" />
            <BreadcrumbsJsonLd items={[{ path: 'our-services/android-app', ar: 'تصميم تطبيقات الأندرويد', en: 'Android App Development' }]} />
            <AndroidHeader />
            <ScrollReveal><AndroidFeatures /></ScrollReveal>
            <ScrollReveal><AndroidMarkets /></ScrollReveal>
            <ScrollReveal><ServiceOfferings service="android" /></ScrollReveal>
            <ScrollReveal><AndroidProcess /></ScrollReveal>
            <ScrollReveal><AndroidPricing /></ScrollReveal>
            <ScrollReveal><FAQSection page="android" /></ScrollReveal>
            <ScrollReveal><Contact key='android-contact' /></ScrollReveal>
            <Footer />
            <SocialMedia />
            <DownSide />
        </div>
    )
}
