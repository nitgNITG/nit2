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
const COUNTRY_LABEL: Record<string, string> = {
    sa: '🇸🇦 السعودية', ae: '🇦🇪 الإمارات', qa: '🇶🇦 قطر',
    kw: '🇰🇼 الكويت', bh: '🇧🇭 البحرين', om: '🇴🇲 عُمان',
    jo: '🇯🇴 الأردن', eg: '🇪🇬 مصر', other: '🌍 أخرى',
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

// ── Contact Detail Modal ─────────────────────────────────────────────────────

function ContactModal({ contact: c, onClose, onStatusChange, onNotesChange }: {
    contact: any;
    onClose: () => void;
    onStatusChange: (id: string, status: string) => void;
    onNotesChange: (id: string, notes: string) => void;
}) {
    const [notes, setNotes] = useState(c.notes ?? '');
    const [savingNotes, setSavingNotes] = useState(false);

    // Close on Escape key
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    // Prevent body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const saveNotes = async () => {
        setSavingNotes(true);
        try {
            await axios.patch('/api/contact', { id: c.id, notes });
            onNotesChange(c.id, notes);
        } catch { /* ignore */ }
        finally { setSavingNotes(false); }
    };

    const Row = ({ label, value }: { label: string; value?: string | null }) =>
        value ? (
            <div className='flex gap-3'>
                <span className='text-xs font-semibold text-gray-400 w-24 shrink-0 pt-0.5'>{label}</span>
                <span className='text-sm text-gray-800 flex-1'>{value}</span>
            </div>
        ) : null;

    return (
        <div
            className='fixed inset-0 z-50 flex items-center justify-center p-4'
            style={{ background: 'rgba(0,0,0,0.55)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className='bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto'>

                {/* Header */}
                <div className='flex items-start justify-between p-6 border-b sticky top-0 bg-white z-10'>
                    <div className='flex items-center gap-3'>
                        <div className='w-10 h-10 rounded-full bg-gradient-to-br from-[#268F79] to-[#0B2923] flex items-center justify-center text-white font-bold text-lg'>
                            {c.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                            <h2 className='font-bold text-lg text-gray-900'>{c.name}</h2>
                            <div className='flex items-center gap-2 mt-0.5'>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STAGE_STYLE[c.stage] ?? 'bg-gray-100'}`}>
                                    {STAGE_LABEL[c.stage] ?? c.stage}
                                </span>
                                <span className='text-xs text-gray-400'>Score: <b>{c.score}</b></span>
                                <span className='text-xs text-gray-400'>
                                    {new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className='text-gray-400 hover:text-gray-700 text-xl leading-none p-1'>✕</button>
                </div>

                <div className='p-6 space-y-6'>

                    {/* Contact info */}
                    <div className='bg-gray-50 rounded-xl p-4 space-y-2'>
                        <p className='text-xs font-bold uppercase text-gray-400 mb-3 tracking-wider'>Contact Info</p>
                        <Row label='Email' value={c.email} />
                        <Row label='Phone' value={c.phone} />
                        <Row label='Country' value={COUNTRY_LABEL[c.country] ?? c.country} />
                        <Row label='Role' value={ROLE_LABEL[c.role] ?? c.role} />
                    </div>

                    {/* Project info */}
                    <div className='bg-gray-50 rounded-xl p-4 space-y-2'>
                        <p className='text-xs font-bold uppercase text-gray-400 mb-3 tracking-wider'>Project Info</p>
                        <Row label='Service' value={SERVICE_LABEL[c.service] ?? c.service} />
                        <Row label='Budget' value={BUDGET_LABEL[c.budget] ?? c.budget} />
                        <Row label='Timeline' value={TIMELINE_LABEL[c.timeline] ?? c.timeline} />
                        <Row label='Subject' value={c.subject} />
                    </div>

                    {/* Pain / Challenge */}
                    {c.pain && (
                        <div className='bg-amber-50 border border-amber-100 rounded-xl p-4'>
                            <p className='text-xs font-bold uppercase text-amber-500 mb-2 tracking-wider'>Challenge / Pain</p>
                            <p className='text-sm text-gray-800 leading-relaxed'>{c.pain}</p>
                        </div>
                    )}

                    {/* Full message */}
                    <div className='bg-blue-50 border border-blue-100 rounded-xl p-4'>
                        <p className='text-xs font-bold uppercase text-blue-400 mb-2 tracking-wider'>Message</p>
                        <p className='text-sm text-gray-800 leading-relaxed whitespace-pre-wrap'>{c.message}</p>
                    </div>

                    {/* Status + Actions */}
                    <div className='flex flex-wrap items-center gap-3'>
                        <span className='text-xs font-semibold text-gray-500'>Status:</span>
                        {STATUS_OPTIONS.map(s => (
                            <button
                                key={s}
                                onClick={() => onStatusChange(c.id, s)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                    c.status === s
                                        ? STATUS_STYLE[s] + ' border-current ring-2 ring-offset-1 ring-current/30'
                                        : 'border-gray-200 text-gray-500 hover:border-gray-400'
                                }`}
                            >
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Quick actions */}
                    <div className='flex flex-wrap gap-2'>
                        {c.phone && (
                            <a
                                href={`https://wa.me/${c.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`مرحباً ${c.name}، شكراً على تواصلك مع شركة N.I.T`)}`}
                                target='_blank' rel='noreferrer'
                                className='flex items-center gap-1.5 bg-green-500 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-green-600 transition-colors'
                            >
                                💬 WhatsApp
                            </a>
                        )}
                        <a
                            href={`mailto:${c.email}?subject=Re: ${c.subject}`}
                            className='flex items-center gap-1.5 bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors'
                        >
                            ✉️ Reply Email
                        </a>
                    </div>

                    {/* Notes */}
                    <div>
                        <p className='text-xs font-bold uppercase text-gray-400 mb-2 tracking-wider'>Internal Notes</p>
                        <textarea
                            className='w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#268F79]/30'
                            rows={3}
                            placeholder='Add internal notes here…'
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                        <button
                            onClick={saveNotes}
                            disabled={savingNotes}
                            className='mt-2 bg-gradient-to-r from-[#268F79] to-[#0B2923] text-[#00FFB2] text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50'
                        >
                            {savingNotes ? 'Saving…' : 'Save Notes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── main component ────────────────────────────────────────────────────────────

interface Props { stageFilter?: string }

const ContactRows = ({ stageFilter = '' }: Props) => {
    const { contacts, setContacts, setContact, setUnReadContact, unReadContact }: any = useStore();
    const [skip, setSkip] = useState(0);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [localContacts, setLocalContacts] = useState<any[]>([]);
    const [selectedContact, setSelectedContact] = useState<any>(null);

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

    useEffect(() => {
        if (unReadContact) {
            axios.put('/api/contact').then(() => setUnReadContact(0));
        }
    }, [setUnReadContact, unReadContact]);

    const updateStatus = async (id: string, status: string) => {
        setLocalContacts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
        if (selectedContact?.id === id) setSelectedContact((p: any) => ({ ...p, status }));
        try {
            await axios.patch('/api/contact', { id, status });
        } catch {
            fetchContacts();
        }
    };

    const updateNotes = (id: string, notes: string) => {
        setLocalContacts(prev => prev.map(c => c.id === id ? { ...c, notes } : c));
    };

    const deleteContact = async (id: string) => {
        if (!window.confirm('Delete this lead? This cannot be undone.')) return;
        setLocalContacts(prev => prev.filter(c => c.id !== id));
        setContacts((contacts ?? []).filter((c: any) => c.id !== id));
        if (selectedContact?.id === id) setSelectedContact(null);
        try {
            await axios.delete(`/api/contact?id=${id}`);
        } catch {
            fetchContacts();
        }
    };

    const rows = localContacts;

    if (!rows.length)
        return (
            <tr>
                <td colSpan={16} className="px-6 py-8 text-center text-gray-400">
                    {loading ? 'Loading…' : 'No leads yet'}
                </td>
            </tr>
        );

    return (
        <>
            {/* Detail modal */}
            {selectedContact && (
                <ContactModal
                    contact={selectedContact}
                    onClose={() => setSelectedContact(null)}
                    onStatusChange={updateStatus}
                    onNotesChange={updateNotes}
                />
            )}

            {rows.map((c: any, i: number) => (
                <tr key={c.id} className="border-b hover:bg-gray-50 transition-colors align-top">
                    {/* Sticky view button — always visible without scrolling */}
                    <td className="px-3 py-3 sticky left-0 bg-white hover:bg-gray-50 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.06)]">
                        <button
                            onClick={() => setSelectedContact(c)}
                            className="flex items-center gap-1 bg-[#268F79]/10 hover:bg-[#268F79]/20 text-[#268F79] font-bold text-xs px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                        >
                            👁 View
                        </button>
                    </td>
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

                    {/* Country */}
                    <td className="px-4 py-3 text-xs font-medium">{COUNTRY_LABEL[c.country] ?? (c.country || '—')}</td>

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

                    {/* Message preview — click to open modal */}
                    <td className="px-4 py-3 text-xs max-w-[200px]">
                        <button
                            onClick={() => setSelectedContact(c)}
                            className='text-left w-full hover:text-[#268F79] transition-colors group'
                            title='Click to view full message'
                        >
                            {c.pain && <p className='text-gray-500 mb-1 italic line-clamp-1'>&ldquo;{c.pain}&rdquo;</p>}
                            <p className='text-gray-500 line-clamp-2 group-hover:text-[#268F79]'>{c.message}</p>
                            <span className='text-[10px] text-[#268F79] opacity-0 group-hover:opacity-100 transition-opacity'>👁 view full</span>
                        </button>
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

                    {/* View + Delete */}
                    <td className="px-4 py-3">
                        <div className='flex items-center gap-1'>
                            <button
                                onClick={() => setSelectedContact(c)}
                                className="text-[#268F79] hover:text-[#0B2923] transition-colors text-xs font-semibold px-2 py-1 rounded hover:bg-[#268F79]/10"
                                title="View full message"
                            >
                                👁
                            </button>
                            <button
                                onClick={() => deleteContact(c.id)}
                                className="text-red-400 hover:text-red-600 transition-colors text-xs font-semibold px-2 py-1 rounded hover:bg-red-50"
                                title="Delete lead"
                            >
                                🗑
                            </button>
                        </div>
                    </td>
                </tr>
            ))}
        </>
    );
};

export default ContactRows;
