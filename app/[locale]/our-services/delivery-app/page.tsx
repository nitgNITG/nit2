import React from 'react'
import FAQSchema from '../../components/FAQSchema'
import FAQSection from '../../components/FAQSection'
import BreadcrumbsJsonLd from '../../components/BreadcrumbsJsonLd'
import DeliveryHeader from './components/DeliveryHeader'
import DeliveryFeatures from './components/DeliveryFeatures'
import DeliveryMarkets from './components/DeliveryMarkets'
import ServiceOfferings from '../../components/ServiceOfferings'
import DeliveryProcess from './components/DeliveryProcess'
import DeliveryPricing from './components/DeliveryPricing'
import Contact from '../../components/Contact'
import Footer from '../../components/Footer'
import SocialMedia from '../../components/SocialMedia'
import DownSide from '../../components/DownSide'
import ScrollReveal from '../../components/ScrollReveal'

export default function DeliveryPage() {
    return (
        <div className='overflow-y-hidden'>
            <FAQSchema page="delivery" />
            <BreadcrumbsJsonLd items={[{ path: 'our-services/delivery-app', ar: 'تطوير تطبيقات التوصيل', en: 'Delivery App Development' }]} />
            <DeliveryHeader />
            <ScrollReveal><DeliveryFeatures /></ScrollReveal>
            <ScrollReveal><DeliveryMarkets /></ScrollReveal>
            <ScrollReveal><ServiceOfferings service="delivery" /></ScrollReveal>
            <ScrollReveal><DeliveryProcess /></ScrollReveal>
            <ScrollReveal><DeliveryPricing /></ScrollReveal>
            <ScrollReveal><FAQSection page="delivery" /></ScrollReveal>
            <ScrollReveal><Contact key='delivery-contact' /></ScrollReveal>
            <Footer />
            <SocialMedia />
            <DownSide />
        </div>
    )
}
