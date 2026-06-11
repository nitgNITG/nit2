import { NextResponse } from 'next/server'
import prisma from '@/prisma/client'

export async function GET() {
    const results: any = {
        timestamp: new Date().toISOString(),
        env: {},
        database: {},
        counts: {},
        adminUser: {},
    }

    // 1. Check env vars
    results.env = {
        DATABASE_URL: process.env.DATABASE_URL
            ? `✅ Set (${process.env.DATABASE_URL.split('@')[1]?.split('/')[0] ?? 'connected'})`
            : '❌ MISSING',
        SECRET_JWT: process.env.SECRET_JWT
            ? `✅ Set (${process.env.SECRET_JWT.length} chars)`
            : '❌ MISSING',
        BASE_URL: process.env.BASE_URL ?? '⚠️ Not set (optional)',
    }

    // 2. Test DB connection + counts
    try {
        const [users, projects, apps, articles, contacts, sponsers] = await prisma.$transaction([
            prisma.user.count(),
            prisma.project.count({ where: { types: { has: 'lms' } } }),
            prisma.project.count({ where: { types: { has: 'ecommerce' } } }),
            prisma.article.count(),
            prisma.contact.count(),
            prisma.sponser.count(),
        ])
        results.database.status = '✅ Connected'
        results.counts = { users, projects, apps, articles, contacts, sponsers }
        results.adminUser = users > 0
            ? `✅ ${users} admin user(s) exist — you can log in`
            : '❌ No admin user found — use /api/setup to create one'
    } catch (error: any) {
        results.database.status = '❌ Connection failed'
        results.database.error = error.message
        results.counts = 'Cannot fetch — DB not connected'
        results.adminUser = 'Cannot check — DB not connected'
    }

    const allGood = results.database.status?.startsWith('✅') &&
        results.env.DATABASE_URL?.startsWith('✅') &&
        results.env.SECRET_JWT?.startsWith('✅')

    return NextResponse.json({
        ok: allGood,
        summary: allGood ? '✅ Everything looks good!' : '❌ Issues found — check details below',
        ...results
    }, { status: 200 })
}
