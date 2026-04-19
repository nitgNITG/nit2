import React from 'react'
import OurProjectsHeader from './components/OurProjectsHeader'
import Learingprojects from './components/Learingprojects'
import CommerceProjects from './components/CommerceProjects'
import Footer from '../components/Footer'

const page = () => {
    return (
        <div>
            <OurProjectsHeader />
            <Learingprojects />
            <CommerceProjects />
            <Footer />
        </div>
    )
}

export default page