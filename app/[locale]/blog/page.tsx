export const revalidate = 3600; // regenerate every hour

import React from 'react'
import BlogHeader from './components/BlogHeader'
import Articles from './components/Articles'
import Footer from '../components/Footer'
import BreadcrumbsJsonLd from '../components/BreadcrumbsJsonLd'
import ScrollReveal from '../components/ScrollReveal'

const page = () => {
    return (
        <div>
            <BreadcrumbsJsonLd items={[{ path: 'blog', ar: 'المدونة', en: 'Blog' }]} />
            <BlogHeader />
            <ScrollReveal><Articles /></ScrollReveal>
            <Footer />
        </div>
    )
}

export default page