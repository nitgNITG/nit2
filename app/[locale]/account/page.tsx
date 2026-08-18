import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/auth'
import prisma from '@/prisma/client'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import AuthScreen from './AuthScreen'
import Dashboard from './Dashboard'

const DOMAIN = process.env.SAAS_CLIENT_DOMAIN ?? 'academy2026.nitg-eg.com'

export const metadata: Metadata = {
    title: { absolute: 'حسابي | N.I.T Academy' },
    robots: { index: false, follow: false },
}

// Uses cookies() → always rendered per-request.
export const dynamic = 'force-dynamic'

export default async function AccountPage() {
    const user = await getCurrentUser()

    let content: React.ReactNode
    if (!user) {
        content = <AuthScreen mode='login' />
    } else {
        const rows = await prisma.academy.findMany({
            where: { ownerId: user.id },
            orderBy: { createdAt: 'desc' },
        })
        const academies = rows.map((a) => ({
            id: a.id, name: a.name, slug: a.slug, status: a.status, createdAt: a.createdAt.toISOString(),
        }))
        content = (
            <Dashboard
                user={{ name: user.name, email: user.email, role: user.role }}
                academies={academies}
                domain={DOMAIN}
            />
        )
    }

    return (
        <div>
            {/* Dark from the very top so the navbar floats over it — no white gap. */}
            <div className='bg-[#0B2923]'>
                <div className='p-container pt-4 relative z-[90]'>
                    <Navbar />
                </div>
                {content}
            </div>
            <Footer />
        </div>
    )
}
