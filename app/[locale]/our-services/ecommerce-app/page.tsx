import React from 'react'
import FAQSchema from '../../components/FAQSchema'
import FAQSection from '../../components/FAQSection'
import BreadcrumbsJsonLd from '../../components/BreadcrumbsJsonLd'
import EcommerceHeader from './components/EcommerceHeader'
import EcommerceFeatures from './components/EcommerceFeatures'
import ServiceOfferings from '../../components/ServiceOfferings'
import EcommerceMarkets from './components/EcommerceMarkets'
import EcommerceProcess from './components/EcommerceProcess'
import EcommercePricing from './components/EcommercePricing'
import Contact from '../../components/Contact'
import Footer from '../../components/Footer'
import SocialMedia from '../../components/SocialMedia'
import DownSide from '../../components/DownSide'
import ScrollReveal from '../../components/ScrollReveal'

export default function EcommercePage() {
    return (
        <div className='overflow-y-hidden'>
            <FAQSchema page="ecommerce" />
            <BreadcrumbsJsonLd items={[{ path: 'our-services/ecommerce-app', ar: 'تطوير تطبيقات التجارة الإلكترونية', en: 'eCommerce App Development' }]} />
            <EcommerceHeader />
            <ScrollReveal><EcommerceFeatures /></ScrollReveal>
            <ScrollReveal><EcommerceMarkets /></ScrollReveal>
            <ScrollReveal><ServiceOfferings service="ecommerce" /></ScrollReveal>
            <ScrollReveal><EcommerceProcess /></ScrollReveal>
            <ScrollReveal><EcommercePricing /></ScrollReveal>
            <ScrollReveal><FAQSection page="ecommerce" /></ScrollReveal>
            <ScrollReveal><Contact key='ecommerce-contact' /></ScrollReveal>
            <Footer />
            <SocialMedia />
            <DownSide />
        </div>
    )
}
