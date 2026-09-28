'use client'

import React from 'react'
import { templateStructure } from './designTokens'

// Mix a hex colour toward white (amt>0) or black (amt<0), 0..1.
export function shade(hex: string, amt: number): string {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim())
    if (!m) return hex
    let [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
    const t = amt < 0 ? 0 : 255
    const p = Math.abs(amt)
    r = Math.round((t - r) * p + r)
    g = Math.round((t - g) * p + g)
    b = Math.round((t - b) * p + b)
    return `#${[r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('')}`
}

// Blend colour a toward b by ratio 0..1 — background-aware (works light + dark).
function mix(a: string, b: string, r: number): string {
    const pa = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((a || '').trim())
    const pb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((b || '').trim())
    if (!pa || !pb) return a
    const ch = (m: RegExpExecArray, i: number) => parseInt(m[i], 16)
    const out = [1, 2, 3].map((i) => Math.round(ch(pa, i) * (1 - r) + ch(pb, i) * r))
    return `#${out.map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('')}`
}

// Pick black or white text for legibility on a given fill.
function onColor(hex: string): string {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim())
    if (!m) return '#ffffff'
    const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)].map((v) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return lum > 0.4 ? '#111111' : '#ffffff'
}

export type Palette = {
    primary: string
    secondary: string
    background: string
    surface: string
    text: string
    accent: string
}

export const DEFAULT_PALETTE: Palette = {
    primary: '#5488c4', secondary: '#1c2a3a', background: '#0c141f',
    surface: '#121e2d', text: '#eef3f9', accent: '#5488c4',
}

export type PreviewProps = {
    name: string
    palette: Palette
    template?: string // homepage template id (t1..t10) → page structure
    logoUrl?: string | null
    heroUrl?: string | null
    aboutUrl?: string | null
    faviconUrl?: string | null
    galleryUrls?: string[]
    aboutBullets?: string[]
    isAr: boolean
}

export default function HomePreview({ name, palette, template = 't1', logoUrl, heroUrl, aboutUrl, faviconUrl, galleryUrls = [], aboutBullets = [], isAr }: PreviewProps) {
    const displayName = (name || (isAr ? 'اسم المنصة' : 'Academy Name')).trim()

    // The template drives LAYOUT ONLY (item positions, hero arrangement, corner
    // radius). ALL colours come from the brand group chosen in "ألوان المنصة" —
    // the template never recolours the page. Light/dark follows the palette's own
    // background, not the template.
    const s = templateStructure(template)
    const accent = palette.accent || palette.primary
    const isDark = onColor(palette.background) === '#fff' // dark bg → light text
    const c = {
        bg: palette.background,
        surface: palette.surface,
        field: mix(palette.surface, palette.text, 0.06),
        ink: palette.text,
        muted: mix(palette.text, palette.background, 0.42),
        border: mix(palette.surface, palette.text, 0.14),
        radius: s.radius, // ← the one structural value the template contributes
        primary: palette.primary,
        accent,
        onPrimary: onColor(palette.primary),
        onAccent: onColor(accent),
        // A soft tint of the brand for badges / washes, legible on the brand bg.
        accentSoft: mix(accent, palette.background, isDark ? 0.72 : 0.86),
        success: '#3fa877',
    }
    const t = (ar: string, en: string) => (isAr ? ar : en)
    const dir = isAr ? 'rtl' : 'ltr'

    const card = (i: number) => (
        <div key={i} style={{ flex: '0 0 150px', background: c.surface, border: `1px solid ${c.border}`, borderRadius: c.radius * 0.6, overflow: 'hidden' }}>
            <div style={{ height: 72, background: c.field, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.muted }}>🖼️</div>
            <div style={{ padding: 10 }}>
                <div style={{ height: 8, width: '70%', background: c.muted, opacity: 0.4, borderRadius: 4, marginBottom: 8 }} />
                <div style={{ background: c.primary, color: c.onPrimary, textAlign: 'center', fontSize: 11, fontWeight: 700, padding: '6px 0', borderRadius: Math.min(c.radius * 0.4, 8) }}>{t('ابدأ الآن', 'Start')}</div>
            </div>
        </div>
    )
    const imgBox = (url: string | null | undefined, label: string, h: React.CSSProperties) => (
        <div style={{ ...h, background: url ? `center/cover no-repeat url(${url})` : c.field, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.muted, fontSize: 13 }}>
            {!url && <>🖼️ {label}</>}
        </div>
    )
    const galleryTiles = (galleryUrls.length ? galleryUrls : [null, null, null, null, null, null]).slice(0, 8)

    // ── Per-template hero ────────────────────────────────────────────────────
    // A distinct hero for each template so the preview visibly changes with the
    // pick. A user-uploaded cover always wins; otherwise the styled band shows.
    const heroBg = (): React.CSSProperties => {
        switch (s.hero) {
            case 'gradient': return { background: `linear-gradient(135deg, ${c.primary}, ${c.accent})` }
            case 'duotone': return { background: `linear-gradient(120deg, ${c.primary}, ${mix(c.accent, c.ink, 0.35)})` }
            case 'dark': return { background: `radial-gradient(120% 120% at 70% 0%, ${mix(c.primary, c.bg, 0.72)} 0%, ${c.bg} 60%)` }
            case 'glass': return { background: `linear-gradient(135deg, ${c.accentSoft}, ${c.surface})` }
            case 'editorial': return { background: c.surface }
            case 'classic': return { background: c.surface, borderTop: `3px solid ${c.primary}`, borderBottom: `1px solid ${c.border}` }
            case 'playful': return { background: c.accentSoft }
            case 'mono': return { background: c.surface, borderBottom: `1px solid ${c.ink}` }
            case 'split': return { background: c.surface }
            default: return { background: c.field } // flat
        }
    }
    const onHero = (['gradient', 'duotone'].includes(s.hero)) ? c.onPrimary : c.ink
    const heroRadius = s.hero === 'mono' ? 0 : s.hero === 'playful' ? c.radius : Math.min(c.radius, 12)
    const heroAlign = (['editorial', 'split'].includes(s.hero)) ? 'flex-start' : 'center'

    const styledHero = (
        <div style={{ ...heroBg(), padding: s.hero === 'editorial' ? '30px 20px' : '26px 18px', display: 'flex', flexDirection: 'column', alignItems: heroAlign, justifyContent: 'center', gap: 10, minHeight: 128, textAlign: heroAlign === 'center' ? 'center' : (isAr ? 'right' : 'left'), borderBottom: s.hero === 'classic' || s.hero === 'mono' ? undefined : `1px solid ${c.border}` }}>
            <span style={{ display: 'inline-block', background: (['gradient', 'duotone'].includes(s.hero)) ? 'rgba(255,255,255,0.18)' : c.accentSoft, color: (['gradient', 'duotone'].includes(s.hero)) ? c.onPrimary : c.accent, borderRadius: 50, padding: '4px 12px', fontSize: 11, fontWeight: 700 }}>
                {t('منصة تعليمية', 'Learning platform')}
            </span>
            <div style={{ fontWeight: 900, fontSize: s.hero === 'editorial' ? 26 : 22, color: onHero, lineHeight: 1.2, letterSpacing: s.hero === 'mono' ? 1 : 0 }}>{displayName}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', justifyContent: heroAlign === 'center' ? 'center' : 'flex-start' }}>
                <span style={{ background: c.primary, color: c.onPrimary, padding: '8px 16px', borderRadius: heroRadius, fontSize: 12, fontWeight: 800 }}>{t('ابدأ الآن', 'Get started')}</span>
                <span style={{ background: 'transparent', color: onHero, border: `1px solid ${(['gradient', 'duotone'].includes(s.hero)) ? 'rgba(255,255,255,0.5)' : c.border}`, padding: '8px 16px', borderRadius: heroRadius, fontSize: 12, fontWeight: 700 }}>{t('الكورسات', 'Courses')}</span>
            </div>
        </div>
    )

    return (
        <div style={{ border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden', background: c.bg, height: 480, display: 'flex', flexDirection: 'column' }}>
            {/* mock browser tab bar with favicon + title */}
            <div style={{ background: '#20242b', padding: '7px 12px', display: 'flex', gap: 8, alignItems: 'center', flex: '0 0 auto' }}>
                <span style={{ display: 'flex', gap: 6 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#e0665c' }} />
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#e8c15c' }} />
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.success }} />
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2b3038', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#c4c9d0', maxWidth: 220 }}>
                    {faviconUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={faviconUrl} alt='' style={{ width: 14, height: 14, objectFit: 'contain', borderRadius: 3 }} />
                        : <span style={{ width: 14, height: 14, borderRadius: 3, background: c.primary, display: 'inline-block' }} />}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                </span>
            </div>

            <div dir={dir} style={{ overflowY: 'auto', flex: 1, color: c.ink }}>
                {/* navbar — template surface, brand accent on active (like --t-* navbar) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${c.border}`, background: c.surface }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 15, color: c.ink }}>
                            {logoUrl
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={logoUrl} alt='' style={{ height: 28, width: 'auto', maxWidth: 90, objectFit: 'contain' }} />
                                : <span style={{ width: 30, height: 30, borderRadius: s.hero === 'mono' ? 4 : '50%', background: c.primary, color: c.onPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900 }}>LOGO</span>}
                            <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                        </div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: c.muted, fontSize: 12 }}>
                            {t('العربية', 'English (en)')} <span style={{ fontSize: 9 }}>▾</span>
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 26, height: 26, borderRadius: '50%', border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.muted, fontSize: 13 }}>⚙</span>
                        <span style={{ background: c.primary, color: c.onPrimary, padding: '6px 14px', borderRadius: Math.min(c.radius * 0.4, 8), fontSize: 12, fontWeight: 700 }}>{t('دخول', 'Log in')}</span>
                    </div>
                </div>

                {/* hero — user cover if uploaded, else the template's styled hero */}
                {heroUrl
                    ? imgBox(heroUrl, t('صورة الغلاف', 'Cover image'), { aspectRatio: '16 / 6', borderBottom: `1px solid ${c.border}` })
                    : styledHero}

                {/* about */}
                <div style={{ padding: '22px 16px', display: 'grid', gridTemplateColumns: '1fr 130px', gap: 16, alignItems: 'center' }}>
                    <div>
                        <div style={{ color: c.accent, fontWeight: 800, fontSize: 18 }}>{t('نبذة عن', 'About')}</div>
                        <div style={{ fontWeight: 700, margin: '4px 0 12px', color: c.ink }}>{displayName}</div>
                        {aboutBullets.length ? (
                            aboutBullets.map((b, i) => (
                                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 13, color: c.muted, lineHeight: 1.6 }}>
                                    <span style={{ color: c.accent }}>◆</span><span>{b}</span>
                                </div>
                            ))
                        ) : (
                            [0, 1, 2].map((i) => (
                                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                    <span style={{ color: c.accent }}>◆</span>
                                    <span style={{ height: 8, flex: 1, background: c.muted, opacity: 0.28, borderRadius: 4, marginTop: 4 }} />
                                </div>
                            ))
                        )}
                    </div>
                    {imgBox(aboutUrl, '', { aspectRatio: '4 / 3', width: '100%', borderRadius: c.radius * 0.75, border: `1px solid ${c.border}` })}
                </div>

                {/* courses */}
                <div style={{ padding: '10px 16px 24px' }}>
                    <div style={{ textAlign: 'center', marginBottom: 14 }}>
                        <span style={{ background: c.accentSoft, border: `1px solid ${c.border}`, color: c.accent, borderRadius: 50, padding: '5px 14px', fontSize: 12, fontWeight: 700 }}>{t('الكورسات', 'Courses')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>{[0, 1, 2, 3].map(card)}</div>
                </div>

                {/* gallery */}
                <div style={{ padding: '10px 16px 24px' }}>
                    <div style={{ textAlign: 'center', marginBottom: 14 }}>
                        <span style={{ background: c.accentSoft, border: `1px solid ${c.border}`, color: c.accent, borderRadius: 50, padding: '5px 14px', fontSize: 12, fontWeight: 700 }}>{t('ألبوم الصور', 'Gallery')}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 8 }}>
                        {galleryTiles.map((url, i) => (
                            <div key={i} style={{ aspectRatio: '4/3', borderRadius: Math.min(c.radius * 0.5, 10), border: `1px solid ${c.border}`, background: url ? `center/cover no-repeat url(${url})` : c.field, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.muted, fontSize: 16 }}>
                                {!url && '🖼️'}
                            </div>
                        ))}
                    </div>
                </div>

                {/* contact */}
                <div style={{ background: c.surface, padding: '22px 16px', textAlign: 'center', borderTop: `1px solid ${c.border}` }}>
                    <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 10, color: c.ink }}>{t('انضم إلينا اليوم', 'Join us today')}</div>
                    <span style={{ background: c.primary, color: c.onPrimary, padding: '10px 22px', borderRadius: Math.min(c.radius * 0.4, 8), fontSize: 13, fontWeight: 700 }}>📞 {t('تواصل معنا', 'Contact us')}</span>
                </div>

                {/* footer */}
                <div style={{ background: isDark ? shade(c.bg, 0.04) : c.ink, borderTop: `1px solid ${c.border}`, padding: '16px', textAlign: 'center', color: isDark ? c.muted : mix(c.surface, c.ink, 0.25), fontSize: 12 }}>
                    <div style={{ fontWeight: 800, color: isDark ? c.ink : c.surface, marginBottom: 4 }}>{displayName}</div>
                    © {new Date().getFullYear()} — {t('جميع الحقوق محفوظة', 'All rights reserved')} · N.I.T
                </div>
            </div>
        </div>
    )
}
