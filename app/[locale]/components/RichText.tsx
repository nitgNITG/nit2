import Link from 'next/link'
import { Fragment } from 'react'
import { parseRichText } from '@/lib/blog'

/** Renders article text with [label](href) links and line breaks; everything else stays plain text. */
const RichText = ({ text }: { text: string | null | undefined }) => (
    <>
        {parseRichText(text).map((t, i) => {
            if (t.type === 'break') return <br key={i} />
            if (t.type === 'text') return <Fragment key={i}>{t.value}</Fragment>
            return t.external
                ? <a key={i} href={t.href} target='_blank' rel='noopener noreferrer' className='text-[#1E7D67] underline underline-offset-2 hover:opacity-80'>{t.label}</a>
                : <Link key={i} href={t.href} className='text-[#1E7D67] underline underline-offset-2 hover:opacity-80'>{t.label}</Link>
        })}
    </>
)

export default RichText
