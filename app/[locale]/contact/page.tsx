import React from 'react'
import ContactHeader from './components/ContactHeader'
import Contact from '../components/Contact'
import Location from '../components/Location'
import Footer from '../components/Footer'
import BreadcrumbsJsonLd from '../components/BreadcrumbsJsonLd'
import ScrollReveal from '../components/ScrollReveal'

const page = () => {
    return (
        <div>
            <BreadcrumbsJsonLd items={[{ path: 'contact', ar: 'اتصل بنا', en: 'Contact' }]} />
            <ContactHeader />
            <ScrollReveal><Contact key="contact-page-contact" /></ScrollReveal>
            <ScrollReveal><Location /></ScrollReveal>
            <Footer />
        </div>
    )
}

export default page