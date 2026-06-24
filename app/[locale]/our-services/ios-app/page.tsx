import React from 'react'
import FAQSchema from '../../components/FAQSchema'
import FAQSection from '../../components/FAQSection'
import BreadcrumbsJsonLd from '../../components/BreadcrumbsJsonLd'
import IosHeader from './components/IosHeader'
import IosFeatures from './components/IosFeatures'
import ServiceOfferings from '../../components/ServiceOfferings'
import IosMarkets from './components/IosMarkets'
import IosProcess from './components/IosProcess'
import IosPricing from './components/IosPricing'
import Contact from '../../components/Contact'
import Footer from '../../components/Footer'
import SocialMedia from '../../components/SocialMedia'
import DownSide from '../../components/DownSide'
import ScrollReveal from '../../components/ScrollReveal'

export default function IosPage() {
    return (
        <div className='overflow-y-hidden'>
            <FAQSchema page="ios" />
            <BreadcrumbsJsonLd items={[{ path: 'our-services/ios-app', ar: 'تصميم تطبيقات الآيفون', en: 'iPhone App Development' }]} />
            <IosHeader />
            <ScrollReveal><IosFeatures /></ScrollReveal>
            <ScrollReveal><IosMarkets /></ScrollReveal>
            <ScrollReveal><ServiceOfferings service="ios" /></ScrollReveal>
            <ScrollReveal><IosProcess /></ScrollReveal>
            <ScrollReveal><IosPricing /></ScrollReveal>
            <ScrollReveal><FAQSection page="ios" /></ScrollReveal>
            <ScrollReveal><Contact key='ios-contact' /></ScrollReveal>
            <Footer />
            <SocialMedia />
            <DownSide />
        </div>
    )
}
