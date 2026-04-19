'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'

const Row = ({ label, value }: { label: string; value: string }) => {
    const ok = value?.startsWith('✅')
    const warn = value?.startsWith('⚠️')
    return (
        <div className='flex justify-between items-start gap-4 py-3 border-b border-gray-100 last:border-0'>
            <span className='font-semibold text-gray-600 min-w-[160px]'>{label}</span>
            <span className={`text-right text-sm font-medium ${ok ? 'text-green-600' : warn ? 'text-yellow-600' : 'text-red-500'}`}>
                {value}
            </span>
        </div>
    )
}

export default function SetupPage() {
    const [health, setHealth] = useState<any>(null)
    const [healthLoading, setHealthLoading] = useState(false)

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [setupMsg, setSetupMsg] = useState<any>(null)
    const [setupLoading, setSetupLoading] = useState(false)

    const checkHealth = async () => {
        setHealthLoading(true)
        try {
            const { data } = await axios.get('/api/health')
            setHealth(data)
        } catch (e: any) {
            setHealth({ summary: '❌ Health check failed', error: e.message })
        }
        setHealthLoading(false)
    }

    const createAdmin = async () => {
        if (!email || !password) {
            setSetupMsg({ message: '❌ Please fill in both email and password.' })
            return
        }
        setSetupLoading(true)
        setSetupMsg(null)
        try {
            const { data } = await axios.post('/api/setup', { email, password })
            setSetupMsg(data)
            checkHealth()
        } catch (e: any) {
            setSetupMsg(e?.response?.data || { message: '❌ Request failed' })
        }
        setSetupLoading(false)
    }

    useEffect(() => { checkHealth() }, [])

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-8 max-w-3xl'>
            <div>
                <h1 className='font-bold text-2xl'>System Setup & Diagnostics</h1>
                <p className='text-gray-500 text-sm mt-1'>Use this page to verify your database connection and create your first admin account.</p>
            </div>

            {/* Health Check */}
            <div className='bg-white rounded-xl border shadow-sm overflow-hidden'>
                <div className='flex justify-between items-center px-6 py-4 border-b bg-gray-50'>
                    <h2 className='font-bold text-lg'>Health Check</h2>
                    <button
                        onClick={checkHealth}
                        disabled={healthLoading}
                        className='bg-blue-500 text-white px-4 py-1.5 rounded-md text-sm font-semibold disabled:opacity-50'
                    >
                        {healthLoading ? 'Checking…' : 'Re-check'}
                    </button>
                </div>
                {health ? (
                    <div className='px-6 py-2'>
                        <div className={`text-center py-3 mb-2 rounded-lg font-bold text-lg ${health.summary?.startsWith('✅') ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'}`}>
                            {health.summary}
                        </div>

                        <p className='text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-1'>Environment Variables</p>
                        {health.env && Object.entries(health.env).map(([k, v]: any) => (
                            <Row key={k} label={k} value={v} />
                        ))}

                        <p className='text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-1'>Database Connection</p>
                        <Row label='Status' value={health.database?.status ?? '—'} />
                        {health.database?.error && (
                            <div className='bg-red-50 border border-red-200 rounded-lg p-3 mt-2 text-red-600 text-sm font-mono'>
                                {health.database.error}
                            </div>
                        )}

                        {health.counts && typeof health.counts === 'object' && (
                            <>
                                <p className='text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-1'>Database Records</p>
                                {Object.entries(health.counts).map(([k, v]: any) => (
                                    <Row key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} value={`${v} record${v !== 1 ? 's' : ''}`} />
                                ))}
                            </>
                        )}

                        <p className='text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-1'>Admin User</p>
                        <Row label='Admin Status' value={typeof health.adminUser === 'string' ? health.adminUser : '—'} />
                    </div>
                ) : (
                    <div className='px-6 py-8 text-center text-gray-400'>Checking…</div>
                )}
            </div>

            {/* Create Admin */}
            <div className='bg-white rounded-xl border shadow-sm overflow-hidden'>
                <div className='px-6 py-4 border-b bg-gray-50'>
                    <h2 className='font-bold text-lg'>Create Admin User</h2>
                    <p className='text-sm text-gray-500 mt-0.5'>Only works if no admin exists yet. After creating, go to <strong>/ar/dashboard</strong> to log in.</p>
                </div>
                <div className='px-6 py-5 space-y-4'>
                    <div>
                        <label className='block text-sm font-semibold text-gray-600 mb-1'>Email</label>
                        <input
                            type='email'
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder='admin@nitg-eg.com'
                            className='w-full border-2 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-sm'
                        />
                    </div>
                    <div>
                        <label className='block text-sm font-semibold text-gray-600 mb-1'>Password (min 8 chars)</label>
                        <input
                            type='password'
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder='••••••••••'
                            className='w-full border-2 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-sm'
                        />
                    </div>
                    <button
                        onClick={createAdmin}
                        disabled={setupLoading}
                        className='w-full bg-green-600 text-white py-2.5 rounded-lg font-bold disabled:opacity-50'
                    >
                        {setupLoading ? 'Creating…' : 'Create Admin User'}
                    </button>

                    {setupMsg && (
                        <div className={`rounded-lg p-4 text-sm font-medium ${setupMsg.message?.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                            <p className='font-bold'>{setupMsg.message}</p>
                            {setupMsg.next && <p className='mt-1 text-green-600'>{setupMsg.next}</p>}
                            {setupMsg.error && <p className='mt-1 font-mono text-xs'>{setupMsg.error}</p>}
                            {setupMsg.hint && <p className='mt-1 text-yellow-700'>{setupMsg.hint}</p>}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick links */}
            <div className='bg-white rounded-xl border shadow-sm px-6 py-5'>
                <h2 className='font-bold text-lg mb-4'>Quick Links</h2>
                <div className='grid grid-cols-2 gap-3'>
                    {[
                        { label: '🏠 Homepage (Arabic)', href: '/ar' },
                        { label: '🏠 Homepage (English)', href: '/en' },
                        { label: '📊 Dashboard', href: '/ar/dashboard' },
                        { label: '🩺 Health JSON', href: '/api/health' },
                        { label: '📝 Projects', href: '/ar/dashboard/projects' },
                        { label: '📱 Apps', href: '/ar/dashboard/application' },
                        { label: '📰 Blog', href: '/ar/dashboard/blog' },
                        { label: '📩 Contacts', href: '/ar/dashboard/contacts' },
                    ].map(link => (
                        <a
                            key={link.href}
                            href={link.href}
                            target='_blank'
                            rel='noreferrer'
                            className='block border rounded-lg px-4 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors'
                        >
                            {link.label}
                        </a>
                    ))}
                </div>
            </div>

            <p className='text-xs text-gray-400 text-center'>
                This page is only accessible when logged in to the dashboard.
            </p>
        </div>
    )
}
