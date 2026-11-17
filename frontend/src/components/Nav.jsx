import React from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

export default function Nav({ health }) {
  const { pathname } = useLocation()
  const onHome = pathname === '/'
  const mode = !health ? 'checking' : health.status === 'down' ? 'offline' : health.mode
  const label = { checking: 'Checking…', offline: 'Backend offline', gemini: 'Gemini live', no_key: 'Gemini key missing' }[mode]

  return (
    <header className="nav">
      <Link to="/" className="brand"><span className="dot" />Campaign<em>.AI</em></Link>
      <nav>
        <NavLink to="/campaigns">Campaigns</NavLink>
        <NavLink to="/agents">⚡ Agents</NavLink>
        <NavLink to="/ab-testing">A/B Testing</NavLink>
        <NavLink to="/audience">Audience</NavLink>
        <NavLink to="/budget">Budget</NavLink>
        <NavLink to="/competitors">Competitors</NavLink>
        <NavLink to="/scheduler">Scheduler</NavLink>
        <NavLink to="/social">Social</NavLink>
        <NavLink to="/analytics">Analytics</NavLink>
        {!onHome && <NavLink to="/new">+ New</NavLink>}
      </nav>
      <div className="nav-right">
        <span className={`pill ${mode}`} title={health?.model ? `Model: ${health.model}` : "Backend status"}><i />{label}</span>
        <Link to="/new" className="btn small">Start campaign</Link>
      </div>
    </header>
  )
}
