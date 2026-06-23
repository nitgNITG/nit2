import React from 'react'
import FAQSchema from '../../components/FAQSchema'
import FAQSection from '../../components/FAQSection'
import BreadcrumbsJsonLd from '../../components/BreadcrumbsJsonLd'
import Contact from '../../components/Contact'
import Footer from '../../components/Footer'
import SocialMedia from '../../components/SocialMedia'
import DownSide from '../../components/DownSide'
import ScrollReveal from '../../components/ScrollReveal'
import ServiceOfferings from '../../components/ServiceOfferings'
import SchoolHeader from './components/SchoolHeader'
import SchoolFeatures from './components/SchoolFeatures'
import SchoolMarkets from './components/SchoolMarkets'
import SchoolProcess from './components/SchoolProcess'
import SchoolPricing from './components/SchoolPricing'

export default function SchoolManagementPage() {
    return (
        <div className='overflow-y-hidden'>
            <FAQSchema page="school" />
            <BreadcrumbsJsonLd items={[{ path: 'our-services/school-management', ar: 'نظام إدارة المدارس', en: 'School Management System' }]} />
            <SchoolHeader />
            <ScrollReveal><SchoolFeatures /></ScrollReveal>
            <ScrollReveal><SchoolMarkets /></ScrollReveal>
            <ScrollReveal><ServiceOfferings service="school" /></ScrollReveal>
            <ScrollReveal><SchoolProcess /></ScrollReveal>
            <ScrollReveal><SchoolPricing /></ScrollReveal>
            <ScrollReveal><FAQSection page="school" /></ScrollReveal>
            <ScrollReveal><Contact key='school-contact' /></ScrollReveal>
            <Footer />
            <SocialMedia />
            <DownSide />
        </div>
    )
}
