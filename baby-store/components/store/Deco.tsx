// رسومات زخرفية خفيفة بهوية المواليد (نجوم، غيوم، قمر، دبدوب)
import type { CSSProperties, SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

export function Star({ size = 18, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path
        d="M12 2.8c.4 0 .7.2.9.6l2.3 4.7 5.1.7c.9.1 1.2 1.2.6 1.8l-3.7 3.6.9 5.1c.2.9-.8 1.5-1.5 1.1L12 18l-4.6 2.4c-.8.4-1.7-.2-1.5-1.1l.9-5.1-3.7-3.6c-.6-.6-.3-1.7.6-1.8l5.1-.7 2.3-4.7c.2-.4.5-.6.9-.6z"
        fill="currentColor"
      />
    </svg>
  )
}

export function Cloud({ size = 80, ...p }: P) {
  return (
    <svg width={size} height={size * 0.55} viewBox="0 0 112 62" aria-hidden="true" {...p}>
      <path d="M20 60Q0 60 0 42Q0 24 20 24Q24 4 46 4Q66 4 72 22Q92 18 98 36Q112 38 112 50Q112 62 98 62Z" fill="currentColor" />
    </svg>
  )
}

export function Moon({ size = 40, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" {...p}>
      <path d="M26 4a17 17 0 1 0 10 27A14 14 0 1 1 26 4z" fill="currentColor" />
    </svg>
  )
}

export function Bear({ size = 48, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" {...p}>
      <circle cx="16" cy="16" r="9" fill="currentColor" />
      <circle cx="48" cy="16" r="9" fill="currentColor" />
      <circle cx="32" cy="34" r="22" fill="currentColor" />
      <ellipse cx="32" cy="41" rx="9" ry="7" fill="#fff" opacity=".85" />
      <circle cx="24" cy="30" r="2.6" fill="#3a2e3f" />
      <circle cx="40" cy="30" r="2.6" fill="#3a2e3f" />
      <ellipse cx="32" cy="38.5" rx="3" ry="2.2" fill="#3a2e3f" />
    </svg>
  )
}

export function Wave({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 1440 36" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 36V18C120 4 240 0 360 8s240 26 360 22 240-24 360-26 240 12 360 18V36Z" fill="currentColor" />
    </svg>
  )
}

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg className="logo__mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="var(--c-soft)" />
      <path d="M12 31q-6 0-6-5.5T12 20q1.5-6.5 8.5-6.5 6 0 8 5.5 6-1.5 8 4 4.5.5 4.5 4.3T36.5 31Z" fill="#fff" stroke="var(--c-primary)" strokeWidth="1.6" />
      <path d="M33 9.5l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2.1 1.1.4-2.3-1.7-1.6 2.3-.3z" fill="var(--c-accent)" />
      <circle cx="19" cy="25" r="1.3" fill="var(--c-text)" />
      <circle cx="27" cy="25" r="1.3" fill="var(--c-text)" />
      <path d="M21.5 27.8q1.5 1.3 3 0" fill="none" stroke="var(--c-text)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

/** دبدوب نائم على القمر — للصفحات الفارغة */
export function EmptyIllustration({ kind = 'bear' }: { kind?: 'bear' | 'cart' | 'heart' | 'search' }) {
  return (
    <svg className="illus" viewBox="0 0 200 160" aria-hidden="true">
      <circle cx="100" cy="86" r="66" fill="var(--c-soft)" />
      <path d="M128 30a40 40 0 1 0 22 66A33 33 0 1 1 128 30z" fill="var(--c-yellow)" />
      <g transform="translate(150 28)" fill="var(--c-accent)"><path d="M6 0l1.8 3.8 4.2.6-3 2.9.7 4.1L6 9.4 2.3 11.4 3 7.3 0 4.4l4.2-.6z" /></g>
      <g transform="translate(36 40)" fill="var(--c-accent)" opacity=".7"><path d="M4 0l1.2 2.5 2.8.4-2 2 .5 2.7L4 6.3 1.5 7.6 2 4.9 0 2.9l2.8-.4z" /></g>
      <path d="M30 128q-14 0-14-12t14-12q3-14 18-14 13 0 17 12 13-3 17 9 10 1 10 9t-10 8Z" fill="#fff" />
      {kind === 'bear' && (
        <g transform="translate(66 62)">
          <circle cx="14" cy="12" r="9" fill="#e8cba8" />
          <circle cx="54" cy="12" r="9" fill="#e8cba8" />
          <ellipse cx="34" cy="32" rx="28" ry="24" fill="#e8cba8" />
          <path d="M22 30q4 3 8 0M38 30q4 3 8 0" stroke="#3a2e3f" strokeWidth="2" fill="none" strokeLinecap="round" />
          <ellipse cx="34" cy="40" rx="8" ry="6" fill="#f5e6d3" />
          <text x="62" y="4" fontSize="12" fill="var(--c-muted)">z</text>
          <text x="70" y="-6" fontSize="9" fill="var(--c-muted)">z</text>
        </g>
      )}
      {kind === 'cart' && (
        <g transform="translate(62 58)" fill="none" stroke="var(--c-primary)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 14h60l-6 36H16z" fill="#fff" />
          <path d="M24 14q0-14 14-14t14 14" />
        </g>
      )}
      {kind === 'heart' && (
        <path transform="translate(70 60)" d="M30 52S0 34 0 15A14 14 0 0 1 30 8a14 14 0 0 1 30 7c0 19-30 37-30 37z" fill="var(--c-pink)" stroke="var(--c-primary)" strokeWidth="3" />
      )}
      {kind === 'search' && (
        <g transform="translate(70 58)" fill="none" stroke="var(--c-primary)" strokeWidth="5" strokeLinecap="round">
          <circle cx="26" cy="26" r="20" fill="#fff" />
          <path d="M41 41l16 16" />
        </g>
      )}
    </svg>
  )
}

export function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.86 9.86 0 0 0 12.04 2zm0 18.15h-.01a8.23 8.23 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 8.24 8.25c0 4.54-3.7 8.23-8.23 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z" />
    </svg>
  )
}

/** زخارف خلفية متناثرة (تُعطّل من إعدادات المظهر) */
export function SkyDecor({ enabled = true }: { enabled?: boolean }) {
  if (!enabled) return null
  return (
    <>
      <Cloud className="deco deco--float" size={110} style={{ top: '12%', insetInlineEnd: '4%', opacity: 0.8, animationDelay: '-2s' }} />
      <Cloud className="deco deco--float" size={70} style={{ bottom: '10%', insetInlineStart: '42%', opacity: 0.6 }} />
      <Star className="deco deco--twinkle" size={16} style={{ top: '18%', insetInlineStart: '46%' }} />
      <Star className="deco deco--twinkle" size={11} style={{ top: '62%', insetInlineEnd: '12%', animationDelay: '-1.5s' }} />
      <Moon className="deco" size={46} style={{ top: '10%', insetInlineEnd: '30%', color: '#fff6d6' }} />
    </>
  )
}

/** أيقونات مبسطة لروابط التواصل الاجتماعي */
export function SocialIcon({ name, size = 18 }: { name: 'instagram' | 'tiktok' | 'snapchat' | 'facebook' | 'x'; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true as const }
  switch (name) {
    case 'instagram':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg {...common} fill="currentColor">
          <path d="M16.5 3c.4 2.2 1.8 3.7 4 3.9v3.1a7.2 7.2 0 0 1-4-1.3v6.4A5.9 5.9 0 1 1 10.6 9v3.2a2.8 2.8 0 1 0 2.8 2.8V3h3.1z" />
        </svg>
      )
    case 'snapchat':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M12 3c3 0 5 2.2 5 5.2v2.3l1.7-.4c.6 0 .8.7.3 1-.7.5-1.6.8-2 1.1.6 1.6 1.8 3 3.3 3.5-.3.7-1.4 1-2.4 1.1l-.4 1.2c-1-.2-2.1-.1-3 .5-.8.5-1.6.9-2.5.9s-1.7-.4-2.5-.9c-.9-.6-2-.7-3-.5l-.4-1.2c-1-.1-2.1-.4-2.4-1.1 1.5-.5 2.7-1.9 3.3-3.5-.4-.3-1.3-.6-2-1.1-.5-.3-.3-1 .3-1l1.7.4V8.2C7 5.2 9 3 12 3z" />
        </svg>
      )
    case 'facebook':
      return (
        <svg {...common} fill="currentColor">
          <path d="M13.5 21v-7.5H16l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8.1v3h2.5V21h2.9z" />
        </svg>
      )
    case 'x':
      return (
        <svg {...common} fill="currentColor">
          <path d="M17.8 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L5.4 21H2.3l7.2-8.2L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.5l11.2 14.5z" />
        </svg>
      )
  }
}
