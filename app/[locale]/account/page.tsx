import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/auth'
import prisma from '@/prisma/client'
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

    if (!user) {
        return <AuthScreen mode='login' />
    }

    const rows = await prisma.academy.findMany({
        where: { ownerId: user.id },
        orderBy: { createdAt: 'desc' },
    })
    const academies = rows.map((a) => ({
        id: a.id, name: a.name, slug: a.slug, status: a.status, createdAt: a.createdAt.toISOString(),
    }))

    return (
        <Dashboard
            user={{ name: user.name, email: user.email, role: user.role }}
            academies={academies}
            domain={DOMAIN}
        />
    )
}
