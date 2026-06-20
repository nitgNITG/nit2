import React from 'react'
import ContactHeader from './components/ContactHeader'
import Contact from '../components/Contact'
import Location from '../components/Location'
import Footer from '../components/Footer'
import BreadcrumbsJsonLd from '../components/BreadcrumbsJsonLd'

const page = () => {
    return (
        <div>
            <BreadcrumbsJsonLd items={[{ path: 'contact', ar: 'اتصل بنا', en: 'Contact' }]} />
            <ContactHeader />
            <Contact key="contact-page-contact" />
            <Location />
            <Footer />
        </div>
    )
}

export default page