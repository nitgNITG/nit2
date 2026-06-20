import React from 'react'
import FAQSchema from '../components/FAQSchema'
import FAQSection from '../components/FAQSection'
import BreadcrumbsJsonLd from '../components/BreadcrumbsJsonLd'
import MoodleHeader from './components/MoodleHeader'
import MoodleFeatures from './components/MoodleFeatures'
import MoodleProjects from './components/MoodleProjects'
import MoodleMarkets from './components/MoodleMarkets'
import MoodleProcess from './components/MoodleProcess'
import MoodlePricing from './components/MoodlePricing'
import Contact from '../components/Contact'
import Footer from '../components/Footer'
import SocialMedia from '../components/SocialMedia'
import DownSide from '../components/DownSide'

export default function MoodlePage() {
    return (
        <div className='overflow-y-hidden'>
            <FAQSchema page="moodle" />
            <BreadcrumbsJsonLd items={[{ path: 'moodle-lms', ar: 'تطوير منصات Moodle', en: 'Moodle LMS Development' }]} />
            <MoodleHeader />
            <MoodleFeatures />
            <MoodleMarkets />
            <MoodleProjects />
            <MoodleProcess />
            <MoodlePricing />
            <FAQSection page="moodle" />
            <Contact key='moodle-contact' />
            <Footer />
            <SocialMedia />
            <DownSide />
        </div>
    )
}
