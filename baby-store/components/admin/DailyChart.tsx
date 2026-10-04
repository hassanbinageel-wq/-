'use client'

import { useState } from 'react'
import { useAdmin } from './ui'

type Point = { date: string; orders: number; value: number; collected: number }

function niceMax(v: number) {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}

/** أعمدة يومية لقيمة الطلبات (سلسلة واحدة) — الزمن يتجه من اليمين لليسار بما يناسب RTL */
export function DailyChart({ data }: { data: Point[] }) {
  const { money } = useAdmin()
  const [hover, setHover] = useState<number | null>(null)
  const W = 720
  const H = 220
  const padTop = 16
  const padBottom = 28
  const padSide = 8
  const plotH = H - padTop - padBottom
  const max = niceMax(Math.max(...data.map((d) => d.value), 0))
  const slot = (W - padSide * 2) / Math.max(1, data.length)
  const bw = Math.max(2, Math.min(24, slot - 2))
  const x = (i: number) => W - padSide - slot * (i + 1) + (slot - bw) / 2
  const y = (v: number) => padTop + plotH - (v / max) * plotH
  const ticks = [0, max / 2, max]
  const maxIdx = data.reduce((m, d, i) => (d.value > (data[m]?.value ?? -1) ? i : m), 0)
  const h = hover != null ? data[hover] : null
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="قيمة الطلبات اليومية" style={{ display: 'block', overflow: 'visible' }} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padSide} x2={W - padSide} y1={y(t)} y2={y(t)} stroke="#ece8ef" strokeWidth={1} />
            <text x={W - padSide} y={y(t) - 4} textAnchor="end" fontSize="11" fill="#6b6472">
              {money(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const bh = Math.max(d.value > 0 ? 2 : 0, (d.value / max) * plotH)
          const bx = x(i)
          const by = padTop + plotH - bh
          const r = Math.min(4, bh, bw / 2)
          const path = bh > 0 ? `M${bx},${by + bh} L${bx},${by + r} Q${bx},${by} ${bx + r},${by} L${bx + bw - r},${by} Q${bx + bw},${by} ${bx + bw},${by + r} L${bx + bw},${by + bh} Z` : ''
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${d.date}: ${money(d.value)}`}>
              <rect x={W - padSide - slot * (i + 1)} y={padTop} width={slot} height={plotH} fill="transparent" />
              {path && <path d={path} fill="#8a3f5f" opacity={hover == null || hover === i ? 1 : 0.55} />}
              {i === maxIdx && d.value > 0 && hover == null && (
                <text x={bx + bw / 2} y={by - 5} textAnchor="middle" fontSize="11" fill="#2d2733">
                  {money(d.value)}
                </text>
              )}
            </g>
          )
        })}
        <line x1={padSide} x2={W - padSide} y1={padTop + plotH} y2={padTop + plotH} stroke="#d9d3dd" strokeWidth={1} />
        {data.length > 0 && (
          <>
            <text x={W - padSide} y={H - 8} textAnchor="end" fontSize="11" fill="#6b6472">
              {data[0].date}
            </text>
            <text x={padSide} y={H - 8} textAnchor="start" fontSize="11" fill="#6b6472">
              {data[data.length - 1].date}
            </text>
          </>
        )}
      </svg>
      {h && (
        <div className="a-card small" style={{ position: 'absolute', top: 0, insetInlineStart: 0, padding: '0.4rem 0.6rem', pointerEvents: 'none', boxShadow: '0 6px 20px rgb(0 0 0 / 10%)' }}>
          <b>{h.date}</b>
          <div>قيمة الطلبات: {money(h.value)}</div>
          <div>عدد الطلبات: {h.orders}</div>
          <div>المحصل المسجل: {money(h.collected)}</div>
        </div>
      )}
      <details style={{ marginTop: 8 }}>
        <summary className="small" style={{ cursor: 'pointer' }}>
          عرض البيانات كجدول
        </summary>
        <div className="a-table-wrap" style={{ marginTop: 6, maxHeight: 280, overflow: 'auto' }}>
          <table className="a-table">
            <thead>
              <tr>
                <th>اليوم</th>
                <th>الطلبات</th>
                <th>القيمة</th>
                <th>المحصل</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date}>
                  <td>{d.date}</td>
                  <td className="num">{d.orders}</td>
                  <td className="num">{money(d.value)}</td>
                  <td className="num">{money(d.collected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

export function CsvDownload({ rows, name, label }: { rows: (string | number)[][]; name: string; label: string }) {
  return (
    <button
      type="button"
      className="a-btn a-btn--ghost"
      onClick={() => {
        const csv = '﻿' + rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(',')).join('\r\n')
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
        a.download = name
        a.click()
      }}
    >
      {label}
    </button>
  )
}
