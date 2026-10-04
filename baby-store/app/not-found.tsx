import Link from 'next/link'

export default function NotFound() {
  return (
    <main style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', padding: '2rem', textAlign: 'center' }}>
      <div>
        <p style={{ fontSize: '3rem', margin: 0 }}>🌙</p>
        <h1 style={{ fontSize: '1.6rem' }}>الصفحة غير موجودة</h1>
        <p style={{ color: '#6b5e6e' }}>ربما نُقلت الصفحة أو لم تعد متاحة.</p>
        <Link href="/" className="btn">
          العودة للرئيسية
        </Link>
      </div>
    </main>
  )
}
