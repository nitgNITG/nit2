import React from 'react'
import FAQSchema from '../components/FAQSchema'
import EcommerceHeader from './components/EcommerceHeader'
import EcommerceFeatures from './components/EcommerceFeatures'
import EcommerceApps from './components/EcommerceApps'
import EcommerceMarkets from './components/EcommerceMarkets'
import EcommercePricing from './components/EcommercePricing'
import Contact from '../components/Contact'
import Footer from '../components/Footer'
import SocialMedia from '../components/SocialMedia'
import DownSide from '../components/DownSide'

export default function EcommercePage() {
    return (
        <div className='overflow-y-hidden'>
            <FAQSchema page="ecommerce" />
            <EcommerceHeader />
            <EcommerceFeatures />
            <EcommerceMarkets />
            <EcommerceApps />
            <EcommercePricing />
            <Contact key='ecommerce-contact' />
            <Footer />
            <SocialMedia />
            <DownSide />
        </div>
    )
}
