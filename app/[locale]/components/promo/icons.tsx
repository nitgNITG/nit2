// Small inline icons for the promo UI. The play triangle is never mirrored in RTL (spec §8).
type P = { className?: string }

export const PlayIcon = ({ className }: P) => (
    <svg className={className} viewBox='0 0 24 24' aria-hidden='true'>
        <path d='M8 5v14l11-7z' fill='#0B2923' />
    </svg>
)

export const PlayCircleIcon = ({ className }: P) => (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
        <circle cx='12' cy='12' r='10' />
        <path d='M10 8l6 4-6 4z' />
    </svg>
)

export const ArrowOutIcon = ({ className }: P) => (
    <svg className={`${className ?? ''} rtl:-scale-x-100`} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
        <path d='M7 17L17 7' />
        <path d='M8 7h9v9' />
    </svg>
)

export const CloseXIcon = ({ className }: P) => (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' aria-hidden='true'>
        <path d='M18 6L6 18M6 6l12 12' />
    </svg>
)

/** Points "back" in the reading direction (left in LTR, right in RTL). */
export const ChevronBackIcon = ({ className }: P) => (
    <svg className={`${className ?? ''} rtl:-scale-x-100`} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
        <path d='M15 18l-6-6 6-6' />
    </svg>
)

export const ChevronForwardIcon = ({ className }: P) => (
    <svg className={`${className ?? ''} rtl:-scale-x-100`} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
        <path d='M9 18l6-6-6-6' />
    </svg>
)
