import React from 'react'
import WhoUsHeader from './components/WhoUsHeader'
import WhyUs from './components/WhyUs'
import Footer from '../components/Footer'
import SecuritySection from './components/SecuritySection'
import NotionalCompany from './components/NotionalCompany'
import WhoUsCards from './components/WhoUsCards'

const page = () => {
    return (
        <div>
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