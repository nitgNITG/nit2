import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/prisma/client'
import bcrypt from 'bcrypt'

// POST /api/setup — creates the first admin user
// Only works if NO users exist yet (safe to leave in production)
export async function POST(req: NextRequest) {
    try {
        // Safety check: refuse if any admin already exists
        const existing = await prisma.user.count()
        if (existing > 0) {
            return NextResponse.json({
                message: '❌ Setup already done — an admin user already exists.',
                hint: 'Go to /ar/dashboard to log in.'
            }, { status: 400 })
        }

        const { email, password } = await req.json()

        if (!email || !password) {
            return NextResponse.json({
                message: '❌ Please provide email and password in the request body.',
                example: { email: 'admin@nitg-eg.com', password: 'YourStrongPassword123' }
            }, { status: 400 })
        }

        if (password.length < 8) {
            return NextResponse.json({
                message: '❌ Password must be at least 8 characters.'
            }, { status: 400 })
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        const user = await prisma.user.create({
            data: { email, password: hashedPassword }
        })

        return NextResponse.json({
            message: '✅ Admin user created successfully!',
            email: user.email,
            next: 'Go to /ar/dashboard and log in with your email and password.'
        }, { status: 201 })

    } catch (error: any) {
        return NextResponse.json({
            message: '❌ Failed to create user',
            error: error.message,
            hint: 'Check that DATABASE_URL is correct in your .env file and run: npx prisma generate'
        }, { status: 500 })
    }
}

// GET /api/setup — shows instructions
export async function GET() {
    return NextResponse.json({
        title: 'N.I.T Setup API',
        steps: [
            '1. Check health: GET /api/health',
            '2. Create admin: POST /api/setup with { "email": "you@example.com", "password": "yourpassword" }',
            '3. Log in at: /ar/dashboard',
        ],
        note: 'This endpoint auto-disables after the first admin is created.'
    })
}
