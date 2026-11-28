import { getLocale } from 'next-intl/server'
import { getShowcaseProjects } from '@/lib/projectShowcase'
import { serviceDef, showcaseState, videoObjectJsonLd, type ShowcaseProject } from '@/lib/promo'
import { promoCopy } from './promoCopy'
import { PromoLightboxProvider } from './PromoLightbox'
import ShowcaseClient from './ShowcaseClient'

/**
 * "Built by N.I.T" — between "What we build" and "Implementation process" on
 * every service page (spec §5). Renders nothing when no project is tagged with
 * this service; the layout follows from which projects have a promo.
 */
export default async function ProjectShowcaseSection({ service }: { service: string }) {
    if (!serviceDef(service)) return null
    const locale = await getLocale()
    return <ShowcaseSectionView service={service} locale={locale} projects={await getShowcaseProjects(service, locale)} />
}

/** The section for a given list of projects (already localised and ordered). */
export function ShowcaseSectionView({ service, locale, projects }: { service: string; locale: string; projects: ShowcaseProject[] }) {
    const def = serviceDef(service)
    const state = showcaseState(projects)
    if (!def) return null
    if (state === 'hidden') return null

    const copy = promoCopy(locale)
    const ar = locale === 'ar'
    const app = def.kind === 'app'
    const withPromo = state !== 'static'
    const jsonLd = projects.map((p) => videoObjectJsonLd(p, locale)).filter(Boolean)

    return (
        <section
            aria-labelledby={`showcase-${service}`}
            className='text-white bg-[#0B2923] bg-[linear-gradient(rgba(0,255,205,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,205,.05)_1px,transparent_1px)] bg-[length:48px_48px] px-4 sm:px-6 py-16 md:pt-[88px] md:pb-24'
        >
            {jsonLd.length > 0 && (
                <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd.length === 1 ? jsonLd[0] : jsonLd) }} />
            )}
            <div className='max-w-[1200px] mx-auto flex flex-col gap-10 md:gap-12'>
                <div className='flex flex-col items-center text-center gap-3.5'>
                    <div className='inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/20 text-[13px] font-bold tracking-[.1em] text-[#00FFCD]'>
                        <span className='size-2 rounded-full bg-[#00FFCD]' />
                        {app ? copy.eyebrowApp : copy.eyebrowWeb}
                    </div>
                    <h2 id={`showcase-${service}`} className='m-0 text-[28px] md:text-[40px] leading-tight font-extrabold'>
                        {withPromo ? copy.seeItRunning : copy.builtBy}{' '}
                        <span className='text-[#00FFCD]'>{ar ? def.accentAr : def.accentEn}</span>
                    </h2>
                    <p className='m-0 max-w-[640px] text-base md:text-[17px] leading-[1.7] text-white/75'>
                        {withPromo ? (app ? copy.subPromoApp : copy.subPromoWeb) : (app ? copy.subStaticApp : copy.subStaticWeb)}
                    </p>
                </div>
                <PromoLightboxProvider locale={locale}>
                    <ShowcaseClient
                        projects={projects}
                        state={state}
                        kind={def.kind}
                        fallbackCategory={ar ? def.labelAr : def.labelEn}
                        locale={locale}
                        page={`service:${service}`}
                    />
                </PromoLightboxProvider>
            </div>
        </section>
    )
}
