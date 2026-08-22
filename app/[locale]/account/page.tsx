import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/auth'
// Academies AND users now live in the same MySQL control-plane DB.
import prismaMysql from '@/lib/prismaMysql'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import AuthScreen from './AuthScreen'
import Dashboard from './Dashboard'
import AdminConsole from './AdminConsole'

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
    } else if (user.role === 'admin') {
        // Admin view: every academy + every client. Both live in MySQL now; we still
        // join them in memory by ownerId (ownerId is a plain string, not a relation).
        const academyRows = await prismaMysql.academy.findMany({ orderBy: { createdAt: 'desc' } })
        let clientRows: { id: string; name: string | null; email: string; role: string | null }[] = []
        try {
            clientRows = await prismaMysql.user.findMany({
                orderBy: { createdAt: 'desc' },
                select: { id: true, name: true, email: true, role: true },
            })
        } catch (e) {
            console.error('[account] client list unavailable', e)
        }
        const ownerById = new Map(clientRows.map((u) => [u.id, u]))
        const countByOwner = new Map<string, number>()
        for (const a of academyRows) {
            if (a.ownerId) countByOwner.set(a.ownerId, (countByOwner.get(a.ownerId) ?? 0) + 1)
        }
        const academies = academyRows.map((a) => {
            const owner = a.ownerId ? ownerById.get(a.ownerId) : undefined
            return {
                id: a.id, name: a.name, slug: a.slug, status: a.status,
                ownerId: a.ownerId ?? null,
                owner: owner?.name || owner?.email || null,
            }
        })
        const clients = clientRows.map((u) => ({
            id: u.id, name: u.name, email: u.email, role: (u.role ?? 'admin'), academies: countByOwner.get(u.id) ?? 0,
        }))
        content = (
            <AdminConsole
                academies={academies}
                clients={clients}
                domain={DOMAIN}
                adminName={user.name || user.email}
            />
        )
    } else {
        // Clients get their own academies.
        const rows = await prismaMysql.academy.findMany({
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
