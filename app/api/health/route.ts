import { NextResponse } from 'next/server'
import prisma from '@/prisma/client'          // Mongo — site content
import prismaMysql from '@/lib/prismaMysql'    // MySQL — users + academies

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
        MYSQL_DATABASE_URL: process.env.MYSQL_DATABASE_URL
            ? `✅ Set (${process.env.MYSQL_DATABASE_URL.split('@')[1]?.split('/')[0] ?? 'connected'})`
            : '❌ MISSING',
        SECRET_JWT: process.env.SECRET_JWT
            ? `✅ Set (${process.env.SECRET_JWT.length} chars)`
            : '❌ MISSING',
        BASE_URL: process.env.BASE_URL ?? '⚠️ Not set (optional)',
    }

    // 2. Users + academies live in MySQL now.
    try {
        const [users, academies] = await prismaMysql.$transaction([
            prismaMysql.user.count(),
            prismaMysql.academy.count(),
        ])
        results.database.mysql = '✅ Connected'
        results.counts.users = users
        results.counts.academies = academies
        results.adminUser = users > 0
            ? `✅ ${users} user(s) exist — you can log in`
            : '❌ No user found — use /api/setup to create the first admin'
    } catch (error: any) {
        results.database.mysql = '❌ Connection failed'
        results.database.mysqlError = error.message
        results.adminUser = 'Cannot check — MySQL not connected'
    }

    // 3. Site content still lives in MongoDB.
    try {
        const [projects, apps, articles, contacts, sponsers] = await prisma.$transaction([
            prisma.project.count({ where: { types: { has: 'lms' } } }),
            prisma.project.count({ where: { types: { has: 'ecommerce' } } }),
            prisma.article.count(),
            prisma.contact.count(),
            prisma.sponser.count(),
        ])
        results.database.mongo = '✅ Connected'
        Object.assign(results.counts, { projects, apps, articles, contacts, sponsers })
    } catch (error: any) {
        results.database.mongo = '❌ Connection failed'
        results.database.mongoError = error.message
    }

    const allGood = results.database.mysql?.startsWith('✅') &&
        results.database.mongo?.startsWith('✅') &&
        results.env.MYSQL_DATABASE_URL?.startsWith('✅') &&
        results.env.SECRET_JWT?.startsWith('✅')

    return NextResponse.json({
        ok: allGood,
        summary: allGood ? '✅ Everything looks good!' : '❌ Issues found — check details below',
        ...results
    }, { status: 200 })
}
