import React from 'react'
import EcommerceHeader from './components/EcommerceHeader'
import EcommerceFeatures from './components/EcommerceFeatures'
import EcommerceApps from './components/EcommerceApps'
import Contact from '../components/Contact'
import Footer from '../components/Footer'
import SocialMedia from '../components/SocialMedia'
import DownSide from '../components/DownSide'

export default function EcommercePage() {
    return (
        <div className='overflow-y-hidden'>
            <EcommerceHeader />
            <EcommerceFeatures />
            <EcommerceApps />
            <Contact key='ecommerce-contact' />
            <Footer />
            <SocialMedia />
            <DownSide />
        </div>
    )
}
