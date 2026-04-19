import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Moodle LMS Development | تطوير منصات Moodle | N.I.T Egypt',
    description: 'Custom Moodle LMS development in Egypt and Gulf countries. E-learning platforms, educational apps, corporate training systems. تطوير منصات التعلم الإلكتروني مودل في مصر والخليج.',
    keywords: 'Moodle LMS, e-learning development Egypt, Moodle customization, educational platform, منصة مودل, تعليم الكتروني, منصة تعليمية',
    openGraph: {
        title: 'Moodle LMS Development | N.I.T Egypt',
        description: 'Expert Moodle LMS development since 2013. Live platforms for universities, schools & enterprises in Egypt and the Gulf.',
        type: 'website',
    },
}

export default function MoodleLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
