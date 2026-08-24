'use client'

import React from 'react'

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

// The 6 colours the client controls; the rest are derived from them.
export type Palette = {
    primary: string
    secondary: string
    background: string
    surface: string
    text: string        // textprimary
    accent: string
}

export const DEFAULT_PALETTE: Palette = {
    primary: '#5488c4', secondary: '#1c2a3a', background: '#0c141f',
    surface: '#121e2d', text: '#eef3f9', accent: '#5488c4',
}

export type PreviewProps = {
    name: string
    palette: Palette
    logoUrl?: string | null
    heroUrl?: string | null
    aboutUrl?: string | null
    isAr: boolean
}

export default function HomePreview({ name, palette, logoUrl, heroUrl, aboutUrl, isAr }: PreviewProps) {
    const displayName = (name || (isAr ? 'اسم المنصة' : 'Academy Name')).trim()
    const c = {
        ...palette,
        accentText: shade(palette.accent, 0.4),
        textSecondary: shade(palette.text, -0.35),
        border: shade(palette.surface, 0.12),
        surfaceVar: shade(palette.surface, 0.08),
        success: '#3fa877',
    }
    const t = (ar: string, en: string) => (isAr ? ar : en)
    const dir = isAr ? 'rtl' : 'ltr'

    const card = (i: number) => (
        <div key={i} style={{ flex: '0 0 150px', background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ height: 72, background: c.surfaceVar, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.textSecondary }}>🖼️</div>
            <div style={{ padding: 10 }}>
                <div style={{ height: 8, width: '70%', background: c.textSecondary, opacity: 0.5, borderRadius: 4, marginBottom: 8 }} />
                <div style={{ background: c.primary, color: c.text, textAlign: 'center', fontSize: 11, fontWeight: 700, padding: '6px 0', borderRadius: 6 }}>{t('ابدأ الآن', 'Start')}</div>
            </div>
        </div>
    )
    const imgBox = (url: string | null | undefined, label: string, h: React.CSSProperties) => (
        <div style={{ ...h, background: url ? `center/cover no-repeat url(${url})` : c.surfaceVar, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.textSecondary, fontSize: 13 }}>
            {!url && <>🖼️ {label}</>}
        </div>
    )

    return (
        <div dir={dir} style={{ border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden', background: c.background, height: 470, display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: shade(c.background, -0.3), padding: '8px 12px', display: 'flex', gap: 6, alignItems: 'center', flex: '0 0 auto' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e0665c' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e8c15c' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.success }} />
            </div>
            <div style={{ overflowY: 'auto', flex: 1, color: c.text }}>
                {/* navbar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${c.border}`, background: c.secondary }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 15 }}>
                        {logoUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={logoUrl} alt='' style={{ height: 26, width: 'auto', maxWidth: 90, objectFit: 'contain' }} />
                            : <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#fff', color: c.background, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900 }}>LOGO</span>}
                        <span style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                    </div>
                    <span style={{ background: c.primary, color: c.text, padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{t('دخول', 'Log in')}</span>
                </div>
                {/* hero */}
                {imgBox(heroUrl, t('صورة الغلاف', 'Cover image'), { aspectRatio: '16 / 6', borderBottom: `1px solid ${c.border}` })}
                {/* about */}
                <div style={{ padding: '22px 16px', display: 'grid', gridTemplateColumns: '1fr 120px', gap: 16, alignItems: 'center' }}>
                    <div>
                        <div style={{ color: c.accentText, fontWeight: 800, fontSize: 18 }}>{t('نبذة عن', 'About')}</div>
                        <div style={{ fontWeight: 700, margin: '4px 0 12px' }}>{displayName}</div>
                        {[0, 1, 2].map((i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                <span style={{ color: c.accent }}>◆</span>
                                <span style={{ height: 8, flex: 1, background: c.textSecondary, opacity: 0.3, borderRadius: 4, marginTop: 4 }} />
                            </div>
                        ))}
                    </div>
                    {imgBox(aboutUrl, '', { height: 120, borderRadius: 12, border: `1px solid ${c.border}` })}
                </div>
                {/* courses */}
                <div style={{ padding: '10px 16px 24px' }}>
                    <div style={{ textAlign: 'center', marginBottom: 14 }}>
                        <span style={{ background: `${c.accentText}22`, border: `1px solid ${c.accentText}55`, color: c.accentText, borderRadius: 50, padding: '5px 14px', fontSize: 12, fontWeight: 700 }}>{t('الكورسات', 'Courses')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>{[0, 1, 2, 3].map(card)}</div>
                </div>
                {/* contact */}
                <div style={{ background: c.surface, padding: '22px 16px', textAlign: 'center', borderTop: `1px solid ${c.border}` }}>
                    <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 10 }}>{t('انضم إلينا اليوم', 'Join us today')}</div>
                    <span style={{ background: c.primary, color: c.text, padding: '10px 22px', borderRadius: 6, fontSize: 13, fontWeight: 700 }}>📞 {t('تواصل معنا', 'Contact us')}</span>
                </div>
            </div>
        </div>
    )
}
