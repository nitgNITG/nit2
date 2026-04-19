import React from 'react'
import ContactHeader from './components/ContactHeader'
import Contact from '../components/Contact'
import Location from '../components/Location'
import Footer from '../components/Footer'

const page = () => {
    return (
        <div>
            <ContactHeader />
            <Contact key="contact-page-contact" />
            <Location />
            <Footer />
        </div>
    )
}

export default page