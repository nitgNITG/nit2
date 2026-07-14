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
const COUNTRY_PHONE_PREFIX: Record<string, string> = {
    eg: '+20', sa: '+966', ae: '+971', qa: '+974',
    kw: '+965', bh: '+973', om: '+968', jo: '+962',
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

/** Normalise phone: add country-code prefix if missing, remove non-digits after */
function normalizePhone(phone: string | null | undefined, country: string | null | undefined): string {
    if (!phone) return '';
    const trimmed = phone.trim();
    if (trimmed.startsWith('+')) return trimmed; // already has country code
    const digits = trimmed.replace(/\D/g, '');
    const prefix = COUNTRY_PHONE_PREFIX[country ?? ''];
    if (!prefix) return trimmed;
    // strip leading 0 (e.g. 0100… → 100…)
    const cleaned = digits.startsWith('0') ? digits.slice(1) : digits;
    return `${prefix}${cleaned}`;
}

/** Format phone for display (add spaces for readability) */
function displayPhone(normalized: string): string {
    return normalized; // keep as-is; browsers handle tel: links fine
}

/** Build wa.me URL with full formatted message */
function waLink(phone: string, name: string, subject?: string, message?: string): string {
    const digits = phone.replace(/\D/g, '');
    const lines = [
        `مرحباً ${name} 👋`,
        `شكراً على تواصلك مع شركة N.I.T Egypt`,
        `🌐 www.nitg-eg.com`,
        ``,
        subject  ? `📌 *${subject}*` : '',
        message  ? `💬 ${message}`   : '',
    ].filter(l => l !== undefined);
    const text = encodeURIComponent(lines.join('\n'));
    return `https://wa.me/${digits}?text=${text}`;
}

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

/** Format date + time */
function formatDateTime(iso: string | null | undefined): { date: string; time: string } {
    if (!iso) return { date: '—', time: '' };
    const d = new Date(iso);
    return {
        date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }),
        time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    };
}

// ── Sort types ───────────────────────────────────────────────────────────────

type SortField = 'createdAt' | 'score' | 'name' | 'country' | 'service' | 'budget' | 'stage';
type SortDir   = 'asc' | 'desc';

// ── Sortable column header ───────────────────────────────────────────────────

function SortTh({
    field, label, current, dir, onSort,
    className = '',
}: {
    field: SortField; label: string;
    current: SortField; dir: SortDir;
    onSort: (f: SortField) => void;
    className?: string;
}) {
    const active = current === field;
    return (
        <th
            className={`px-4 py-3 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100 transition-colors ${className}`}
            onClick={() => onSort(field)}
        >
            <span className='flex items-center gap-1'>
                {label}
                <span className={`text-[10px] ${active ? 'text-[#1E7D67]' : 'text-gray-300'}`}>
                    {active ? (dir === 'desc' ? '▼' : '▲') : '⇅'}
                </span>
            </span>
        </th>
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

    const phone = normalizePhone(c.phone, c.country);
    const { date, time } = formatDateTime(c.createdAt);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

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
                        <div className='w-10 h-10 rounded-full bg-gradient-to-br from-[#1E7D67] to-[#0B2923] flex items-center justify-center text-white font-bold text-lg'>
                            {c.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                            <h2 className='font-bold text-lg text-gray-900'>{c.name}</h2>
                            <div className='flex items-center gap-2 mt-0.5'>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STAGE_STYLE[c.stage] ?? 'bg-gray-100'}`}>
                                    {STAGE_LABEL[c.stage] ?? c.stage}
                                </span>
                                <span className='text-xs text-gray-400'>Score: <b>{c.score}</b></span>
                                <span className='text-xs text-gray-400'>{date} {time}</span>
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
                        {/* Phone with country code + WA button */}
                        {phone && (
                            <div className='flex gap-3'>
                                <span className='text-xs font-semibold text-gray-400 w-24 shrink-0 pt-0.5'>Phone</span>
                                <div className='flex items-center gap-2'>
                                    <a href={`tel:${phone}`} className='text-sm text-gray-800 hover:text-[#1E7D67] transition-colors'>{displayPhone(phone)}</a>
                                    <a
                                        href={waLink(phone, c.name, c.subject, c.message)}
                                        target='_blank' rel='noreferrer'
                                        className='flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors'
                                        title='Open WhatsApp'
                                    >
                                        <svg viewBox='0 0 24 24' className='w-3 h-3 fill-white'><path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z'/></svg>
                                        WA
                                    </a>
                                </div>
                            </div>
                        )}
                        <Row label='Country' value={COUNTRY_LABEL[c.country] ?? c.country} />
                        <Row label='Role' value={ROLE_LABEL[c.role] ?? c.role} />
                    </div>

                    {/* Traffic source */}
                    {(c.sourcePage || c.sourceRef || c.utmSource) && (
                        <div className='bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-2'>
                            <p className='text-xs font-bold uppercase text-purple-400 mb-3 tracking-wider'>Traffic Source</p>
                            <Row label='Page' value={c.sourcePage} />
                            <Row label='Referrer' value={c.sourceRef} />
                            <Row label='UTM Source' value={c.utmSource} />
                            <Row label='UTM Medium' value={c.utmMedium} />
                            <Row label='UTM Campaign' value={c.utmCampaign} />
                        </div>
                    )}

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
                        {phone && (
                            <a
                                href={waLink(phone, c.name, c.subject, c.message)}
                                target='_blank' rel='noreferrer'
                                className='flex items-center gap-1.5 bg-green-500 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-green-600 transition-colors'
                            >
                                <svg viewBox='0 0 24 24' className='w-4 h-4 fill-white'><path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z'/></svg>
                                WhatsApp
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
                            className='w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1E7D67]/30'
                            rows={3}
                            placeholder='Add internal notes here…'
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                        <button
                            onClick={saveNotes}
                            disabled={savingNotes}
                            className='mt-2 bg-gradient-to-r from-[#1E7D67] to-[#0B2923] text-[#00FFB2] text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50'
                        >
                            {savingNotes ? 'Saving…' : 'Save Notes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Mobile Contact Card ───────────────────────────────────────────────────────

function ContactCard({ c, onView, onStatusChange, onDelete }: {
    c: any;
    onView: () => void;
    onStatusChange: (id: string, status: string) => void;
    onDelete: (id: string) => void;
}) {
    const phone = normalizePhone(c.phone, c.country);
    const { date, time } = formatDateTime(c.createdAt);

    return (
        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3'>
            {/* Top row: stage + score + date */}
            <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STAGE_STYLE[c.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STAGE_LABEL[c.stage] ?? c.stage}
                    </span>
                    <ScoreBar score={c.score ?? 0} />
                </div>
                <div className='text-right'>
                    <div className='text-xs text-gray-400'>{date}</div>
                    <div className='text-[10px] text-gray-300'>{time}</div>
                </div>
            </div>

            {/* Name */}
            <div>
                <p className='font-bold text-gray-900'>{c.name}</p>
                <p className='text-xs text-blue-600'>{c.email}</p>
                {phone && (
                    <div className='flex items-center gap-2 mt-0.5'>
                        <a href={`tel:${phone}`} className='text-xs text-gray-500 hover:text-[#1E7D67]'>{displayPhone(phone)}</a>
                        <a
                            href={waLink(phone, c.name, c.subject, c.message)}
                            target='_blank' rel='noreferrer'
                            className='flex items-center gap-0.5 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full'
                        >
                            <svg viewBox='0 0 24 24' className='w-2.5 h-2.5 fill-white'><path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z'/></svg>
                            WA
                        </a>
                    </div>
                )}
            </div>

            {/* Meta chips */}
            <div className='flex flex-wrap gap-1.5'>
                {c.country && (
                    <span className='bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full'>
                        {COUNTRY_LABEL[c.country] ?? c.country}
                    </span>
                )}
                {c.service && (
                    <span className='bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full'>
                        {SERVICE_LABEL[c.service] ?? c.service}
                    </span>
                )}
                {c.budget && c.budget !== 'unknown' && (
                    <span className='bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full'>
                        {BUDGET_LABEL[c.budget] ?? c.budget}
                    </span>
                )}
                {c.sourcePage && (
                    <span className='bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full'>
                        📍 {c.sourcePage}
                    </span>
                )}
            </div>

            {/* Message preview */}
            {c.message && (
                <p className='text-xs text-gray-500 line-clamp-2 italic'>&ldquo;{c.message}&rdquo;</p>
            )}

            {/* Actions */}
            <div className='flex items-center gap-2 pt-1 border-t border-gray-100'>
                <button
                    onClick={onView}
                    className='flex-1 bg-[#1E7D67]/10 hover:bg-[#1E7D67]/20 text-[#1E7D67] font-bold text-xs px-3 py-2 rounded-lg transition-colors'
                >
                    👁 View Details
                </button>
                <select
                    value={c.status ?? 'new'}
                    onChange={e => onStatusChange(c.id, e.target.value)}
                    className={`text-xs px-2 py-2 rounded-lg border-0 font-semibold cursor-pointer ${STATUS_STYLE[c.status] ?? 'bg-gray-100'}`}
                >
                    {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                </select>
                <button
                    onClick={() => onDelete(c.id)}
                    className='text-red-400 hover:text-red-600 text-xs p-2 rounded-lg hover:bg-red-50 transition-colors'
                    title='Delete'
                >
                    🗑
                </button>
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

    // Sort state — default: newest first
    const [sortField, setSortField] = useState<SortField>('createdAt');
    const [sortDir, setSortDir]     = useState<SortDir>('desc');

    const handleSort = (field: SortField) => {
        if (field === sortField) {
            setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
        // Reset pagination so fresh data is fetched with new sort
        setSkip(0);
        setHasMore(true);
        setLocalContacts([]);
    };

    useEffect(() => {
        setSkip(0);
        setHasMore(true);
        if (!stageFilter && contacts?.length && sortField === 'createdAt' && sortDir === 'desc') {
            setLocalContacts(contacts);
        } else {
            setLocalContacts([]);
        }
    }, [stageFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchContacts = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                skip: String(skip),
                orderBy: sortField,
                orderDir: sortDir,
            });
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
    }, [skip, stageFilter, sortField, sortDir, setContact, setContacts]);

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

    const emptyState = (
        <div className='py-10 text-center text-gray-400'>
            {loading ? 'Loading…' : 'No leads yet'}
        </div>
    );

    const sortProps = { current: sortField, dir: sortDir, onSort: handleSort };

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

            {/* ── Mobile card list (< md) ──────────────────────────────────── */}
            <div className='block md:hidden space-y-3'>
                {!rows.length ? emptyState : rows.map((c: any) => (
                    <ContactCard
                        key={c.id}
                        c={c}
                        onView={() => setSelectedContact(c)}
                        onStatusChange={updateStatus}
                        onDelete={deleteContact}
                    />
                ))}
                {loading && (
                    <div className='text-center text-gray-400 text-sm py-4'>Loading more…</div>
                )}
            </div>

            {/* ── Desktop table (≥ md) ─────────────────────────────────────── */}
            <div className='hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto contacts-table-scroll'>
                <table className='text-sm text-left text-gray-600' style={{ minWidth: '1380px', width: '100%' }}>
                    <thead className='text-xs text-gray-700 uppercase bg-gray-50 border-b'>
                        <tr>
                            <th className='px-4 py-3 sticky left-0 bg-gray-50 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.06)]'>View</th>
                            <th className='px-4 py-3 text-gray-400'>#</th>
                            <SortTh field='stage'     label='Stage'    {...sortProps} />
                            <SortTh field='score'     label='Score'    {...sortProps} />
                            <SortTh field='name'      label='Name'     {...sortProps} />
                            <th className='px-4 py-3 whitespace-nowrap'>Phone / WA</th>
                            <th className='px-4 py-3'>Email</th>
                            <SortTh field='country'   label='Country'  {...sortProps} />
                            <SortTh field='service'   label='Service'  {...sortProps} />
                            <SortTh field='budget'    label='Budget'   {...sortProps} />
                            <th className='px-4 py-3'>Timeline</th>
                            <th className='px-4 py-3'>Role</th>
                            <th className='px-4 py-3'>Source</th>
                            <th className='px-4 py-3'>Subject</th>
                            <th className='px-4 py-3'>Pain / Message</th>
                            <th className='px-4 py-3'>Status</th>
                            <SortTh field='createdAt' label='Date ↓'   {...sortProps} />
                            <th className='px-4 py-3'></th>
                        </tr>
                    </thead>
                    <tbody>
                        {!rows.length ? (
                            <tr>
                                <td colSpan={18} className='px-6 py-8 text-center text-gray-400'>
                                    {loading ? 'Loading…' : 'No leads yet'}
                                </td>
                            </tr>
                        ) : rows.map((c: any, i: number) => {
                            const phone = normalizePhone(c.phone, c.country);
                            const { date, time } = formatDateTime(c.createdAt);
                            return (
                                <tr key={c.id} className='border-b hover:bg-gray-50 transition-colors align-top'>
                                    {/* Sticky view button */}
                                    <td className='px-3 py-3 sticky left-0 bg-white hover:bg-gray-50 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.06)]'>
                                        <button
                                            onClick={() => setSelectedContact(c)}
                                            className='flex items-center gap-1 bg-[#1E7D67]/10 hover:bg-[#1E7D67]/20 text-[#1E7D67] font-bold text-xs px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap'
                                        >
                                            👁 View
                                        </button>
                                    </td>
                                    <td className='px-4 py-3 text-gray-400 text-xs'>{i + 1}</td>

                                    {/* Stage badge */}
                                    <td className='px-4 py-3'>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STAGE_STYLE[c.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                                            {STAGE_LABEL[c.stage] ?? c.stage}
                                        </span>
                                    </td>

                                    {/* Score bar */}
                                    <td className='px-4 py-3'><ScoreBar score={c.score ?? 0} /></td>

                                    {/* Name */}
                                    <td className='px-4 py-3 font-semibold whitespace-nowrap'>{c.name}</td>

                                    {/* Phone + WhatsApp — always with country code */}
                                    <td className='px-4 py-3 text-xs whitespace-nowrap'>
                                        {phone ? (
                                            <div className='flex items-center gap-1.5'>
                                                <a
                                                    href={`tel:${phone}`}
                                                    className='text-gray-700 hover:text-[#1E7D67] font-mono transition-colors'
                                                >
                                                    {displayPhone(phone)}
                                                </a>
                                                <a
                                                    href={waLink(phone, c.name, c.subject, c.message)}
                                                    target='_blank' rel='noreferrer'
                                                    title='Open WhatsApp'
                                                    className='flex items-center justify-center w-6 h-6 bg-green-500 hover:bg-green-600 rounded-full transition-colors shrink-0'
                                                >
                                                    <svg viewBox='0 0 24 24' className='w-3.5 h-3.5 fill-white'><path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z'/></svg>
                                                </a>
                                            </div>
                                        ) : <span className='text-gray-300'>—</span>}
                                    </td>

                                    {/* Email */}
                                    <td className='px-4 py-3 text-xs text-blue-600 max-w-[160px] truncate'>{c.email}</td>

                                    {/* Country */}
                                    <td className='px-4 py-3 text-xs font-medium whitespace-nowrap'>{COUNTRY_LABEL[c.country] ?? (c.country || '—')}</td>

                                    {/* Service */}
                                    <td className='px-4 py-3 text-xs whitespace-nowrap'>{SERVICE_LABEL[c.service] ?? '—'}</td>

                                    {/* Budget */}
                                    <td className='px-4 py-3 text-xs font-medium'>{BUDGET_LABEL[c.budget] ?? '—'}</td>

                                    {/* Timeline */}
                                    <td className='px-4 py-3 text-xs whitespace-nowrap'>{TIMELINE_LABEL[c.timeline] ?? '—'}</td>

                                    {/* Role */}
                                    <td className='px-4 py-3 text-xs'>{ROLE_LABEL[c.role] ?? '—'}</td>

                                    {/* Source page */}
                                    <td className='px-4 py-3 text-xs'>
                                        {c.sourcePage ? (
                                            <div>
                                                <div className='font-medium text-purple-700'>{c.sourcePage}</div>
                                                {c.sourceRef && c.sourceRef !== 'direct' && (
                                                    <div className='text-gray-400 truncate max-w-[120px]'>{c.sourceRef}</div>
                                                )}
                                                {c.utmSource && (
                                                    <div className='text-green-600'>utm: {c.utmSource}</div>
                                                )}
                                            </div>
                                        ) : '—'}
                                    </td>

                                    {/* Subject */}
                                    <td className='px-4 py-3 text-xs max-w-[150px] truncate'>{c.subject}</td>

                                    {/* Message preview */}
                                    <td className='px-4 py-3 text-xs max-w-[200px]'>
                                        <button
                                            onClick={() => setSelectedContact(c)}
                                            className='text-left w-full hover:text-[#1E7D67] transition-colors group'
                                            title='Click to view full message'
                                        >
                                            {c.pain && <p className='text-gray-500 mb-1 italic line-clamp-1'>&ldquo;{c.pain}&rdquo;</p>}
                                            <p className='text-gray-500 line-clamp-2 group-hover:text-[#1E7D67]'>{c.message}</p>
                                            <span className='text-[10px] text-[#1E7D67] opacity-0 group-hover:opacity-100 transition-opacity'>👁 view full</span>
                                        </button>
                                    </td>

                                    {/* Status */}
                                    <td className='px-4 py-3'>
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

                                    {/* Date + Time */}
                                    <td className='px-4 py-3 text-xs whitespace-nowrap'>
                                        <div className='text-gray-600 font-medium'>{date}</div>
                                        <div className='text-gray-400 text-[11px]'>{time}</div>
                                    </td>

                                    {/* Delete */}
                                    <td className='px-4 py-3'>
                                        <button
                                            onClick={() => deleteContact(c.id)}
                                            className='text-red-400 hover:text-red-600 transition-colors text-xs font-semibold px-2 py-1 rounded hover:bg-red-50'
                                            title='Delete lead'
                                        >
                                            🗑
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {loading && (
                    <div className='text-center text-gray-400 text-sm py-4 border-t'>Loading more…</div>
                )}
            </div>
        </>
    );
};

export default ContactRows;
