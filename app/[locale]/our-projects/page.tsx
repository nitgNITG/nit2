import React from 'react'
import OurProjectsHeader from './components/OurProjectsHeader'
import Learingprojects from './components/Learingprojects'
import CommerceProjects from './components/CommerceProjects'
import Footer from '../components/Footer'

const OurProjectsPage = () => {
    return (
        <main>
            <OurProjectsHeader />

            {/* LMS Platforms section */}
            <section aria-label="Educational Platforms - منصات تعليمية">
                <Learingprojects />
            </section>

            {/* eCommerce Apps section */}
            <section aria-label="eCommerce Applications - تطبيقات التجارة الإلكترونية">
                <CommerceProjects />
            </section>

            <Footer />
        </main>
    )
}

export default OurProjectsPage
