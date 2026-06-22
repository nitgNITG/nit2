import React from 'react'
import FAQSchema from '../../components/FAQSchema'
import FAQSection from '../../components/FAQSection'
import BreadcrumbsJsonLd from '../../components/BreadcrumbsJsonLd'
import RestaurantHeader from './components/RestaurantHeader'
import RestaurantFeatures from './components/RestaurantFeatures'
import RestaurantMarkets from './components/RestaurantMarkets'
import ServiceOfferings from '../../components/ServiceOfferings'
import RestaurantProcess from './components/RestaurantProcess'
import RestaurantPricing from './components/RestaurantPricing'
import Contact from '../../components/Contact'
import Footer from '../../components/Footer'
import SocialMedia from '../../components/SocialMedia'
import DownSide from '../../components/DownSide'
import ScrollReveal from '../../components/ScrollReveal'

export default function RestaurantPage() {
    return (
        <div className='overflow-y-hidden'>
            <FAQSchema page="restaurant" />
            <BreadcrumbsJsonLd items={[{ path: 'our-services/restaurant-app', ar: 'تطوير تطبيقات المطاعم', en: 'Restaurant App Development' }]} />
            <RestaurantHeader />
            <ScrollReveal><RestaurantFeatures /></ScrollReveal>
            <ScrollReveal><RestaurantMarkets /></ScrollReveal>
            <ScrollReveal><ServiceOfferings service="restaurant" /></ScrollReveal>
            <ScrollReveal><RestaurantProcess /></ScrollReveal>
            <ScrollReveal><RestaurantPricing /></ScrollReveal>
            <ScrollReveal><FAQSection page="restaurant" /></ScrollReveal>
            <ScrollReveal><Contact key='restaurant-contact' /></ScrollReveal>
            <Footer />
            <SocialMedia />
            <DownSide />
        </div>
    )
}
