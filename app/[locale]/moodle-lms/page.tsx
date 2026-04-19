import React from 'react'
import MoodleHeader from './components/MoodleHeader'
import MoodleFeatures from './components/MoodleFeatures'
import MoodleProjects from './components/MoodleProjects'
import Contact from '../components/Contact'
import Footer from '../components/Footer'
import SocialMedia from '../components/SocialMedia'
import DownSide from '../components/DownSide'

export default function MoodlePage() {
    return (
        <div className='overflow-y-hidden'>
            <MoodleHeader />
            <MoodleFeatures />
            <MoodleProjects />
            <Contact key='moodle-contact' />
            <Footer />
            <SocialMedia />
            <DownSide />
        </div>
    )
}
