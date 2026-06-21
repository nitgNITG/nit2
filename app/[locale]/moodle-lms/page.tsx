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
import ScrollReveal from '../components/ScrollReveal'

export default function MoodlePage() {
    return (
        <div className='overflow-y-hidden'>
            <FAQSchema page="moodle" />
            <BreadcrumbsJsonLd items={[{ path: 'moodle-lms', ar: 'تطوير منصات Moodle', en: 'Moodle LMS Development' }]} />
            <MoodleHeader />
            <ScrollReveal><MoodleFeatures /></ScrollReveal>
            <ScrollReveal><MoodleMarkets /></ScrollReveal>
            <ScrollReveal><MoodleProjects /></ScrollReveal>
            <ScrollReveal><MoodleProcess /></ScrollReveal>
            <ScrollReveal><MoodlePricing /></ScrollReveal>
            <ScrollReveal><FAQSection page="moodle" /></ScrollReveal>
            <ScrollReveal><Contact key='moodle-contact' /></ScrollReveal>
            <Footer />
            <SocialMedia />
            <DownSide />
        </div>
    )
}
