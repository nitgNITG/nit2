import React from 'react'
import WhoUsHeader from './components/WhoUsHeader'
import WhyUs from './components/WhyUs'
import Footer from '../components/Footer'
import SecuritySection from './components/SecuritySection'
import NotionalCompany from './components/NotionalCompany'
import WhoUsCards from './components/WhoUsCards'
import BreadcrumbsJsonLd from '../components/BreadcrumbsJsonLd'

const page = () => {
    return (
        <div>
            <BreadcrumbsJsonLd items={[{ path: 'who-us', ar: 'من نحن', en: 'About Us' }]} />
            <WhoUsHeader />
            <WhyUs />
            <SecuritySection />
            <NotionalCompany />
            <WhoUsCards />
            <Footer />
        </div>
    )
}

export default page