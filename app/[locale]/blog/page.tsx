import React from 'react'
import BlogHeader from './components/BlogHeader'
import Articles from './components/Articles'
import Footer from '../components/Footer'
import BreadcrumbsJsonLd from '../components/BreadcrumbsJsonLd'

const page = () => {
    return (
        <div>
            <BreadcrumbsJsonLd items={[{ path: 'blog', ar: 'المدونة', en: 'Blog' }]} />
            <BlogHeader />
            <Articles />
            <Footer />
        </div>
    )
}

export default page