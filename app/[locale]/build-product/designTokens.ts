// Design-system tokens shared by the build-product form and its live preview.
//
// Two orthogonal axes, exactly as the academy theme (theme_nit) works:
//   • TEMPLATE  → page STRUCTURE (backgrounds, ink, borders, corner radius, and
//                 the light/dark base). Mirrors theme_nit_template_tokens() (the
//                 --t-* custom properties emitted on :root by the theme).
//   • BRAND GROUP → the BRAND colours (primary / accent / …). Mirrors the 17
//                 Brand-Colors groups from theme_nit (gallery "Brand Colors" tab),
//                 seeded from theme_nit_brand_group_defaults().
// Any template can be painted by any brand group — structure and hue are separate.

import type { Palette } from './HomePreview'

export type TemplateStructure = {
    bg: string
    surface: string
    field: string
    ink: string
    muted: string
    border: string
    line: string
    radius: number
    scheme: 'light' | 'dark'
    // Hero treatment, so each template reads as a distinct design in the preview.
    hero: 'flat' | 'gradient' | 'classic' | 'dark' | 'editorial' | 'glass' | 'split' | 'playful' | 'mono' | 'duotone'
}

// t1..t10 structure sets — values mirror theme_nit_template_tokens() (radius in px).
export const TEMPLATE_TOKENS: Record<string, TemplateStructure> = {
    t1:  { bg: '#FFFFFF', surface: '#FAFAF8', field: '#FBFBF9', ink: '#16191D', muted: '#6E7781', border: '#EDEDE9', line: '#F1F1ED', radius: 16, scheme: 'light', hero: 'flat' },
    t2:  { bg: '#FFFFFF', surface: '#F7F5FC', field: '#FBFAFE', ink: '#1B1035', muted: '#5A5170', border: '#EAE6F2', line: '#F1EEF8', radius: 18, scheme: 'light', hero: 'gradient' },
    t3:  { bg: '#FBF9F4', surface: '#FFFFFF', field: '#FFFFFF', ink: '#0B2545', muted: '#33475F', border: '#DED6C6', line: '#ECE6DA', radius: 10, scheme: 'light', hero: 'classic' },
    t4:  { bg: '#07090D', surface: '#12151C', field: '#171B24', ink: '#E8ECF1', muted: '#9AA5B4', border: 'rgba(255,255,255,0.12)', line: 'rgba(255,255,255,0.07)', radius: 16, scheme: 'dark', hero: 'dark' },
    t5:  { bg: '#FAF3E7', surface: '#FFFDF7', field: '#F3E8D5', ink: '#241A12', muted: '#5C4A3C', border: '#D6C6B2', line: '#E7DAC6', radius: 12, scheme: 'light', hero: 'editorial' },
    t6:  { bg: '#FFFFFF', surface: '#F5F7FB', field: '#FAFBFD', ink: '#10243E', muted: '#5C6480', border: '#E6E9F0', line: '#F0F2F7', radius: 20, scheme: 'light', hero: 'glass' },
    t7:  { bg: '#FFFDF7', surface: '#FFFFFF', field: '#F5F9FE', ink: '#2A2140', muted: '#45618A', border: '#DCE5F0', line: '#EAF0F8', radius: 12, scheme: 'light', hero: 'split' },
    t8:  { bg: '#FFFDF7', surface: '#FFFFFF', field: '#FBFAF6', ink: '#2A2140', muted: '#5A4E78', border: '#ECE6F2', line: '#F3EEF8', radius: 22, scheme: 'light', hero: 'playful' },
    t9:  { bg: '#F4F1EA', surface: '#FFFFFF', field: '#FAF8F3', ink: '#14121F', muted: '#5E5B54', border: '#DAD5C7', line: '#E9E4D7', radius: 4,  scheme: 'light', hero: 'mono' },
    t10: { bg: '#F4F1EA', surface: '#FFFFFF', field: '#FAF8F3', ink: '#14121F', muted: '#5C5872', border: '#E2DDD2', line: '#ECE7DC', radius: 14, scheme: 'light', hero: 'duotone' },
}

export function templateStructure(id: string): TemplateStructure {
    return TEMPLATE_TOKENS[id] ?? TEMPLATE_TOKENS.t1
}

// The 17 Brand-Colors groups (theme_nit) → the 6 palette roles the form sets.
// Seeded from theme_nit_brand_group_defaults(); a group is one click, no tuning.
export type BrandGroup = { id: string; en: string; ar: string; scheme: 'light' | 'dark'; p: Palette }

export const BRAND_GROUPS: BrandGroup[] = [
    { id: 'g1', en: 'Slate (Dark)', ar: 'سليت', scheme: 'dark', p: { primary: '#5488c4', accent: '#5488c4', secondary: '#1c2a3a', background: '#0c141f', surface: '#121e2d', text: '#eef3f9' } },
    { id: 'g2', en: 'Teal (Dark)', ar: 'تركوازي', scheme: 'dark', p: { primary: '#2f9e8f', accent: '#2f9e8f', secondary: '#12302e', background: '#0a1a1a', surface: '#102727', text: '#eef5f4' } },
    { id: 'g3', en: 'Violet (Dark)', ar: 'بنفسجي', scheme: 'dark', p: { primary: '#8478cf', accent: '#8478cf', secondary: '#26243d', background: '#11101c', surface: '#1a182d', text: '#efedf7' } },
    { id: 'g4', en: 'Daylight (Light)', ar: 'ضياء', scheme: 'light', p: { primary: '#2368bd', accent: '#2368bd', secondary: '#e6e8eb', background: '#f6f8fb', surface: '#ffffff', text: '#14191f' } },
    { id: 'g5', en: 'Graphite (Dark)', ar: 'جرافيت', scheme: 'dark', p: { primary: '#71a7ef', accent: '#71a7ef', secondary: '#2a2e35', background: '#0d1117', surface: '#1f232a', text: '#f6f8fb' } },
    { id: 'g6', en: 'Emerald (Light)', ar: 'زمرّدي', scheme: 'light', p: { primary: '#347c18', accent: '#347c18', secondary: '#e6e8eb', background: '#f6f8fb', surface: '#ffffff', text: '#14191f' } },
    { id: 'g7', en: 'Emerald (Dark)', ar: 'زمرّدي', scheme: 'dark', p: { primary: '#4ca62a', accent: '#4ca62a', secondary: '#2a2e35', background: '#121212', surface: '#1f232a', text: '#f6f8fb' } },
    { id: 'g8', en: 'Amber (Light)', ar: 'كهرماني', scheme: 'light', p: { primary: '#a34e00', accent: '#a34e00', secondary: '#e6e8eb', background: '#f6f8fb', surface: '#ffffff', text: '#14191f' } },
    { id: 'g9', en: 'Amber (Dark)', ar: 'كهرماني', scheme: 'dark', p: { primary: '#d96a00', accent: '#d96a00', secondary: '#2a2e35', background: '#121212', surface: '#1f232a', text: '#f6f8fb' } },
    { id: 'g10', en: 'Teal (Light)', ar: 'تركوازي', scheme: 'light', p: { primary: '#007785', accent: '#007785', secondary: '#e6e8eb', background: '#f6f8fb', surface: '#ffffff', text: '#14191f' } },
    { id: 'g11', en: 'Teal (Dark)', ar: 'تركوازي', scheme: 'dark', p: { primary: '#01a0b2', accent: '#01a0b2', secondary: '#2a2e35', background: '#121212', surface: '#1f232a', text: '#f6f8fb' } },
    { id: 'g12', en: 'Sapphire (Light)', ar: 'ياقوتي', scheme: 'light', p: { primary: '#1869bc', accent: '#1869bc', secondary: '#e6e8eb', background: '#f6f8fb', surface: '#ffffff', text: '#14191f' } },
    { id: 'g13', en: 'Sapphire (Dark)', ar: 'ياقوتي', scheme: 'dark', p: { primary: '#378fef', accent: '#378fef', secondary: '#2a2e35', background: '#121212', surface: '#1f232a', text: '#f6f8fb' } },
    { id: 'g14', en: 'Rose (Light)', ar: 'وردي', scheme: 'light', p: { primary: '#ac3b5a', accent: '#ac3b5a', secondary: '#e6e8eb', background: '#f6f8fb', surface: '#ffffff', text: '#14191f' } },
    { id: 'g15', en: 'Rose (Dark)', ar: 'وردي', scheme: 'dark', p: { primary: '#f43776', accent: '#f43776', secondary: '#2a2e35', background: '#121212', surface: '#1f232a', text: '#f6f8fb' } },
    { id: 'g16', en: 'Amethyst (Light)', ar: 'أميثيست', scheme: 'light', p: { primary: '#7053b6', accent: '#7053b6', secondary: '#e6e8eb', background: '#f6f8fb', surface: '#ffffff', text: '#14191f' } },
    { id: 'g17', en: 'Amethyst (Dark)', ar: 'أميثيست', scheme: 'dark', p: { primary: '#9575e8', accent: '#9575e8', secondary: '#2a2e35', background: '#121212', surface: '#1f232a', text: '#f6f8fb' } },
]

export function brandGroup(id: string): BrandGroup {
    return BRAND_GROUPS.find((g) => g.id === id) ?? BRAND_GROUPS[0]
}
