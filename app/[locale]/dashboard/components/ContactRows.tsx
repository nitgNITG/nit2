'use client'
import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { useStore } from '@/lib/zustand'

// ── helpers ─────────────────────────────────────────────────────────────────

const STAGE_STYLE: Record<string, string> = {
    lead:        'bg-gray-100 text-gray-700',
    mql:         'bg-blue-100 text-blue-700',
    sql:         'bg-yellow-100 text-yellow-700',
    opportunity: 'bg-green-100 text-green-700',
};
const STAGE_LABEL: Record<string, string> = {
    lead: 'Lead', mql: 'MQL', sql: 'SQL', opportunity: 'Opportunity 🔥',
};

const STATUS_OPTIONS = ['new', 'contacted', 'won', 'lost'];
const STATUS_STYLE: Record<string, string> = {
    new:       'bg-gray-100 text-gray-600',
    contacted: 'bg-blue-50 text-blue-700',
    won:       'bg-green-100 text-green-700',
    lost:      'bg-red-100 text-red-700',
};

const SERVICE_LABEL: Record<string, string> = {
    moodle: 'Moodle LMS', ecommerce: 'eCommerce', custom: 'Custom', other: 'Other',
};
const BUDGET_LABEL: Record<string, string> = {
    under5k: '<$5K', '5to20k': '$5–20K', '20to50k': '$20–50K', above50k: '>$50K', unknown: '—',
};
const TIMELINE_LABEL: Record<string, string> = {
    immediate: 'Immediate', '1to3months': '1–3 mo', '3to6months': '3–6 mo', exploring: 'Exploring',
};
const ROLE_LABEL: Record<string, string> = {
    owner: 'Owner/CEO', manager: 'Manager', employee: 'Employee', other: 'Other',
};

function ScoreBar({ score }: { score: number }) {
    const color = score >= 76 ? 'bg-green-500' : score >= 51 ? 'bg-yellow-400' : score >= 26 ? 'bg-blue-400' : 'bg-gray-300';
    return (
        <div className='flex items-center gap-1.5'>
            <div className='w-16 h-2 bg-gray-200 rounded-full overflow-hidden'>
                <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
            </div>
            <span className='text-xs font-semibold'>{score}</span>
        </div>
    );
}

// ── component ────────────────────────────────────────────────────────────────

interface Props { stageFilter?: string }

const ContactRows = ({ stageFilter = '' }: Props) => {
    const { contacts, setContacts, setContact, setUnReadContact, unReadContact }: any = useStore();
    const [skip, setSkip] = useState(0);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [localContacts, setLocalContacts] = useState<any[]>([]);

    // Reset on filter change — pre-seed from global store when switching to "All"
    useEffect(() => {
        setSkip(0);
        setHasMore(true);
        if (!stageFilter && contacts?.length) {
            setLocalContacts(contacts);
        } else {
            setLocalContacts([]);
        }
    }, [stageFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchContacts = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({ skip: String(skip) });
            if (stageFilter) params.set('stage', stageFilter);
            const { data } = await axios.get(`/api/contact?${params}`);

            if (data.contacts.length === 0) {
                setHasMore(false);
            } else {
                setLocalContacts(prev => skip === 0 ? data.contacts : [...prev, ...data.contacts]);
                if (skip === 0) {
                    setContacts(data.contacts);
                } else {
                    data.contacts.forEach((c: any) => setContact(c));
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [skip, stageFilter, setContact, setContacts]);

    useEffect(() => { if (hasMore) fetchContacts(); }, [fetchContacts, hasMore]);

    // Infinite scroll
    useEffect(() => {
        const onScroll = () => {
            const { scrollY, innerHeight } = window;
            const docH = document.documentElement.scrollHeight;
            if (scrollY + innerHeight >= docH - 10 && hasMore && !loading)
                setSkip(p => p + 20);
        };
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, [hasMore, loading]);

    // Mark all read
    useEffect(() => {
        if (unReadContact) {
            axios.put('/api/contact').then(() => setUnReadContact(0));
        }
    }, [setUnReadContact, unReadContact]);

    // Update status optimistically
    const updateStatus = async (id: string, status: string) => {
        setLocalContacts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
        try {
            await axios.patch('/api/contact', { id, status });
        } catch {
            fetchContacts();
        }
    };

    // Delete contact — update both localContacts and global store
    const deleteContact = async (id: string) => {
        if (!window.confirm('Delete this lead? This cannot be undone.')) return;
        setLocalContacts(prev => prev.filter(c => c.id !== id));
        setContacts((contacts ?? []).filter((c: any) => c.id !== id));
        try {
            await axios.delete(`/api/contact?id=${id}`);
        } catch {
            fetchContacts();
        }
    };

    // Always drive display from localContacts; seed it from global store when no filter
    const rows = localContacts;

    if (!rows.length)
        return (
            <tr>
                <td colSpan={14} className="px-6 py-8 text-center text-gray-400">
                    {loading ? 'Loading…' : 'No leads yet'}
                </td>
            </tr>
        );

    return (
        <>
            {rows.map((c: any, i: number) => (
                <tr key={c.id} className="border-b hover:bg-gray-50 transition-colors align-top">
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>

                    {/* Stage badge */}
                    <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STAGE_STYLE[c.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                            {STAGE_LABEL[c.stage] ?? c.stage}
                        </span>
                    </td>

                    {/* Score bar */}
                    <td className="px-4 py-3"><ScoreBar score={c.score ?? 0} /></td>

                    {/* Name */}
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">{c.name}</td>

                    {/* Email + Phone */}
                    <td className="px-4 py-3 text-xs">
                        <div className='text-blue-600'>{c.email}</div>
                        {c.phone && <div className='text-gray-500 mt-0.5'>{c.phone}</div>}
                    </td>

                    {/* Service */}
                    <td className="px-4 py-3 text-xs">{SERVICE_LABEL[c.service] ?? '—'}</td>

                    {/* Budget */}
                    <td className="px-4 py-3 text-xs font-medium">{BUDGET_LABEL[c.budget] ?? '—'}</td>

                    {/* Timeline */}
                    <td className="px-4 py-3 text-xs">{TIMELINE_LABEL[c.timeline] ?? '—'}</td>

                    {/* Role */}
                    <td className="px-4 py-3 text-xs">{ROLE_LABEL[c.role] ?? '—'}</td>

                    {/* Subject */}
                    <td className="px-4 py-3 text-xs max-w-[150px] truncate">{c.subject}</td>

                    {/* Pain + Message */}
                    <td className="px-4 py-3 text-xs max-w-[200px]">
                        {c.pain && <p className='text-gray-700 mb-1 italic'>&ldquo;{c.pain}&rdquo;</p>}
                        <p className='text-gray-500 line-clamp-2'>{c.message}</p>
                    </td>

                    {/* Status dropdown */}
                    <td className="px-4 py-3">
                        <select
                            value={c.status ?? 'new'}
                            onChange={e => updateStatus(c.id, e.target.value)}
                            className={`text-xs px-2 py-1 rounded-lg border-0 font-semibold cursor-pointer ${STATUS_STYLE[c.status] ?? 'bg-gray-100'}`}
                        >
                            {STATUS_OPTIONS.map(s => (
                                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                        </select>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>

                    {/* Delete */}
                    <td className="px-4 py-3">
                        <button
                            onClick={() => deleteContact(c.id)}
                            className="text-red-400 hover:text-red-600 transition-colors text-xs font-semibold px-2 py-1 rounded hover:bg-red-50"
                            title="Delete lead"
                        >
                            🗑
                        </button>
                    </td>
                </tr>
            ))}
        </>
    );
};

export default ContactRows;
