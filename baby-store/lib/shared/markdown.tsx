// عارض Markdown مبسط وآمن (بدون HTML خام): عناوين، فقرات، قوائم، اقتباس، عريض، روابط
import type { ReactNode } from 'react'

function safeHref(href: string): string | null {
  const h = href.trim()
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(h) && !/^\/\//.test(h)) return h
  return null
}

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\))/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[2]) out.push(<strong key={`${keyBase}-b${k++}`}>{m[2]}</strong>)
    else if (m[3]) {
      const href = safeHref(m[4])
      out.push(
        href ? (
          <a key={`${keyBase}-a${k++}`} href={href} {...(/^https?:/.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {m[3]}
          </a>
        ) : (
          m[3]
        ),
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ text, className = 'prose' }: { text: string; className?: string }) {
  const lines = (text || '').replace(/\r/g, '').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (h) {
      const level = Math.min(3, h[1].length + 1)
      const content = inline(h[2], `h${key}`)
      blocks.push(level === 2 ? <h2 key={key++}>{content}</h2> : <h3 key={key++}>{content}</h3>)
      i++
      continue
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: ReactNode[] = []
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(<li key={i}>{inline(lines[i].replace(/^\s*[-*•]\s+/, ''), `l${i}`)}</li>)
        i++
      }
      blocks.push(<ul key={key++}>{items}</ul>)
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: ReactNode[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(<li key={i}>{inline(lines[i].replace(/^\s*\d+[.)]\s+/, ''), `o${i}`)}</li>)
        i++
      }
      blocks.push(<ol key={key++}>{items}</ol>)
      continue
    }
    if (/^>\s?/.test(line)) {
      const parts: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        parts.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      blocks.push(<blockquote key={key++}>{inline(parts.join(' '), `q${key}`)}</blockquote>)
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>\s?|\s*[-*•]\s+|\s*\d+[.)]\s+)/.test(lines[i])) {
      para.push(lines[i])
      i++
    }
    blocks.push(
      <p key={key++}>
        {para.map((p, j) => (
          <span key={j}>
            {inline(p, `p${key}-${j}`)}
            {j < para.length - 1 && <br />}
          </span>
        ))}
      </p>,
    )
  }
  return <div className={className}>{blocks}</div>
}

/** نص عادي من Markdown (للوصف المختصر في محركات البحث) */
export function plainText(md: string, max = 160): string {
  return (md || '')
    .replace(/[#>*_`]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}
