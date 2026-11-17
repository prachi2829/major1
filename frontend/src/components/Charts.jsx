import React, { useState } from 'react'

export const PLATFORM_COLOR = { instagram: '#d9482b', linkedin: '#1f5fae', twitter: '#16201b', facebook: '#1f6b4f' }
export const PLATFORM_LABEL = { instagram: 'Instagram', linkedin: 'LinkedIn', twitter: 'X / Twitter', facebook: 'Facebook' }

export const fmt = (n) => (n >= 10000 ? (n / 1000).toFixed(1) + 'k' : n.toLocaleString())
export const pct = (x) => (x * 100).toFixed(1) + '%'

const niceMax = (v) => {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const m = v / p
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p
}

/** Daily line chart. series: [{ platform, points: [{day, value}] }] */
export function LineChart({ series, metricLabel }) {
  const [hover, setHover] = useState(null)
  const W = 720, H = 300, L = 56, R = 16, T = 16, B = 34
  const days = [...new Set(series.flatMap((s) => s.points.map((p) => p.day)))].sort()
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.value))))
  const x = (i) => L + (days.length <= 1 ? 0 : (i * (W - L - R)) / (days.length - 1))
  const y = (v) => T + (1 - v / max) * (H - T - B)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const short = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${metricLabel} per day by platform`}
        onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? '' : '3 4'} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" className="ax">{fmt(Math.round(t))}</text>
          </g>
        ))}
        {days.map((d, i) => (i % 3 === 0 || i === days.length - 1) && (
          <text key={d} x={x(i)} y={H - 10} textAnchor={i === days.length - 1 ? 'end' : 'middle'} className="ax">{short(d)}</text>
        ))}
        {series.map((s) => {
          const path = s.points.map((p, i) => `${i ? 'L' : 'M'}${x(days.indexOf(p.day))},${y(p.value)}`).join(' ')
          return <path key={s.platform} d={path} fill="none" stroke={PLATFORM_COLOR[s.platform]} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        })}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--ink)" strokeOpacity=".25" />}
        {hover != null && series.map((s) => {
          const p = s.points.find((q) => q.day === days[hover])
          return p ? <circle key={s.platform} cx={x(hover)} cy={y(p.value)} r="4.5" fill={PLATFORM_COLOR[s.platform]} stroke="#fff" strokeWidth="2" /> : null
        })}
        {days.map((d, i) => (
          <rect key={d} x={x(i) - (W - L - R) / (days.length * 2)} y={T} width={(W - L - R) / days.length} height={H - T - B}
            fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} />
        ))}
      </svg>
      {hover != null && (
        <div className="tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <b>{short(days[hover])}</b>
          {series.map((s) => {
            const p = s.points.find((q) => q.day === days[hover])
            return p && <span key={s.platform}><i style={{ background: PLATFORM_COLOR[s.platform] }} />{PLATFORM_LABEL[s.platform]} {p.value.toLocaleString()}</span>
          })}
        </div>
      )}
      <div className="legend">
        {series.map((s) => <span key={s.platform}><i style={{ background: PLATFORM_COLOR[s.platform] }} />{PLATFORM_LABEL[s.platform]}</span>)}
      </div>
    </div>
  )
}

/** Horizontal bars. rows: [{ platform, value }] */
export function BarList({ rows, format = fmt }) {
  const max = Math.max(1e-9, ...rows.map((r) => r.value))
  return (
    <ul className="bars">
      {rows.map((r) => (
        <li key={r.platform}>
          <span>{PLATFORM_LABEL[r.platform]}</span>
          <div><i style={{ width: `${(r.value / max) * 100}%`, background: PLATFORM_COLOR[r.platform] }} /></div>
          <b>{format(r.value)}</b>
        </li>
      ))}
    </ul>
  )
}
