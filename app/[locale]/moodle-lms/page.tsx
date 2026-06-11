import React from 'react'
import MoodleHeader from './components/MoodleHeader'
import MoodleFeatures from './components/MoodleFeatures'
import MoodleProjects from './components/MoodleProjects'
import MoodleMarkets from './components/MoodleMarkets'
import MoodlePricing from './components/MoodlePricing'
import Contact from '../components/Contact'
import Footer from '../components/Footer'
import SocialMedia from '../components/SocialMedia'
import DownSide from '../components/DownSide'

export default function MoodlePage() {
    return (
        <div className='overflow-y-hidden'>
            <MoodleHeader />
            <MoodleFeatures />
            <MoodleMarkets />
            <MoodleProjects />
            <MoodlePricing />
            <Contact key='moodle-contact' />
            <Footer />
            <SocialMedia />
            <DownSide />
        </div>
    )
}
