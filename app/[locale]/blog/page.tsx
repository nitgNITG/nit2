import React from 'react'
import BlogHeader from './components/BlogHeader'
import Articles from './components/Articles'
import Footer from '../components/Footer'

const page = () => {
    return (
        <div>
            <BlogHeader />
            <Articles />
            <Footer />
        </div>
    )
}

export default page