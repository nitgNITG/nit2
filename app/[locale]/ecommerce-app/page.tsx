import React from 'react'
import FAQSchema from '../components/FAQSchema'
import FAQSection from '../components/FAQSection'
import BreadcrumbsJsonLd from '../components/BreadcrumbsJsonLd'
import EcommerceHeader from './components/EcommerceHeader'
import EcommerceFeatures from './components/EcommerceFeatures'
import EcommerceApps from './components/EcommerceApps'
import EcommerceMarkets from './components/EcommerceMarkets'
import EcommerceProcess from './components/EcommerceProcess'
import EcommercePricing from './components/EcommercePricing'
import Contact from '../components/Contact'
import Footer from '../components/Footer'
import SocialMedia from '../components/SocialMedia'
import DownSide from '../components/DownSide'

export default function EcommercePage() {
    return (
        <div className='overflow-y-hidden'>
            <FAQSchema page="ecommerce" />
            <BreadcrumbsJsonLd items={[{ path: 'ecommerce-app', ar: 'تطوير تطبيقات التجارة الإلكترونية', en: 'eCommerce App Development' }]} />
            <EcommerceHeader />
            <EcommerceFeatures />
            <EcommerceMarkets />
            <EcommerceApps />
            <EcommerceProcess />
            <EcommercePricing />
            <FAQSection page="ecommerce" />
            <Contact key='ecommerce-contact' />
            <Footer />
            <SocialMedia />
            <DownSide />
        </div>
    )
}
