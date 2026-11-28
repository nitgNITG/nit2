// Minimal, safe formatting for assistant replies: paragraphs, "- " / "• " / "1. "
// lists and **bold**. Builds React elements only — no HTML is ever injected.
import React from 'react'

function inline(text: string, key: string): React.ReactNode[] {
    return text.split(/(\*\*[^*\n]+\*\*)/g).filter(Boolean).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') && part.length > 4
            ? <strong key={`${key}-${i}`} className='font-semibold'>{part.slice(2, -2)}</strong>
            : <React.Fragment key={`${key}-${i}`}>{part}</React.Fragment>,
    )
}

type Block = { kind: 'p' | 'ul' | 'ol'; lines: string[] }

export function toBlocks(text: string): Block[] {
    const blocks: Block[] = []
    for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
        const line = raw.trim()
        const last = blocks[blocks.length - 1]
        if (!line) { blocks.push({ kind: 'p', lines: [] }); continue }
        const ul = line.match(/^[-•*]\s+(.*)$/)
        const ol = line.match(/^\d+[.)]\s+(.*)$/)
        if (ul) { if (last?.kind === 'ul') last.lines.push(ul[1]); else blocks.push({ kind: 'ul', lines: [ul[1]] }); continue }
        if (ol) { if (last?.kind === 'ol') last.lines.push(ol[1]); else blocks.push({ kind: 'ol', lines: [ol[1]] }); continue }
        if (last?.kind === 'p' && last.lines.length) last.lines.push(line)
        else blocks.push({ kind: 'p', lines: [line] })
    }
    return blocks.filter((b) => b.lines.length)
}

export default function RichText({ text }: { text: string }) {
    return (
        <div className='space-y-2'>
            {toBlocks(text).map((b, i) => {
                if (b.kind === 'p') {
                    return <p key={i}>{b.lines.map((l, j) => <React.Fragment key={j}>{j > 0 && <br />}{inline(l, `${i}-${j}`)}</React.Fragment>)}</p>
                }
                const Tag = b.kind === 'ul' ? 'ul' : 'ol'
                return (
                    <Tag key={i} className={`${b.kind === 'ul' ? 'list-disc' : 'list-decimal'} space-y-1 ps-5`}>
                        {b.lines.map((l, j) => <li key={j}>{inline(l, `${i}-${j}`)}</li>)}
                    </Tag>
                )
            })}
        </div>
    )
}
