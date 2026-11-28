'use client'
import LocaleLink from '../../components/LocaleLink'

/** Page numbers to show: first, last, and the current page with one neighbour each side. */
export function pageWindow(page: number, pages: number): (number | 'gap')[] {
    const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages))
    const out: (number | 'gap')[] = []
    Array.from(keep).sort((a, b) => a - b).forEach((n, i, all) => {
        if (i > 0 && n - all[i - 1] > 1) out.push('gap')
        out.push(n)
    })
    return out
}

const base = 'min-w-9 h-9 px-3 inline-flex items-center justify-center rounded-md border text-sm'

const Pagination = ({ page, pages, hrefFor, label = 'Pagination' }: {
    page: number; pages: number; hrefFor: (n: number) => string; label?: string
}) => {
    if (pages <= 1) return null
    const edge = (n: number, text: string, disabled: boolean) => disabled
        ? <span aria-disabled='true' className={`${base} border-gray-100 text-gray-300`}>{text}</span>
        : <LocaleLink href={hrefFor(n)} className={`${base} border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600`}>{text}</LocaleLink>

    return (
        <nav aria-label={label} className='flex flex-wrap items-center justify-center gap-1.5'>
            {edge(page - 1, 'Previous', page <= 1)}
            {pageWindow(page, pages).map((n, i) => n === 'gap'
                ? <span key={`gap-${i}`} className='px-1 text-gray-400'>…</span>
                : n === page
                    ? <span key={n} aria-current='page' className={`${base} border-blue-600 bg-blue-600 text-white font-semibold`}>{n}</span>
                    : <LocaleLink key={n} href={hrefFor(n)} className={`${base} border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600`}>{n}</LocaleLink>)}
            {edge(page + 1, 'Next', page >= pages)}
        </nav>
    )
}

export default Pagination
