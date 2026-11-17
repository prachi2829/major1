import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

const LABEL = { draft: 'Draft', strategy_ready: 'Strategy ready', content_ready: 'Content ready', published: 'Published' }

export default function Dashboard({ notify }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  const load = () => api.list().then(setItems).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  async function remove(id) {
    if (!window.confirm('Delete this campaign?')) return
    try { await api.remove(id); notify('Campaign deleted'); load() } catch (e) { notify(e.message, 'err') }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h2>Your <em>campaigns</em></h2>
        </div>
        <div className="cta-row nomargin">
          <Link to="/agents" className="btn small ghost">⚡ Multi-Agent Hub</Link>
          <Link to="/ab-testing" className="btn small ghost">🧪 A/B Testing</Link>
          <Link to="/audience" className="btn small ghost">👥 Audience</Link>
          <Link to="/budget" className="btn small ghost">💰 Budget</Link>
          <Link to="/scheduler" className="btn small ghost">📅 Scheduler</Link>
          <Link to="/social" className="btn small ghost">🔗 Social</Link>
          <Link to="/analytics" className="btn small ghost">📈 Analytics</Link>
          <Link to="/new" className="btn small">+ New Campaign</Link>
        </div>
      </div>

      {error && <div className="notice err">{error}</div>}
      {!items && !error && <p className="muted">Loading…</p>}
      {items && items.length === 0 && (
        <div className="empty">
          <h3>No campaigns yet</h3>
          <p>Campaigns live in memory in Phase 1, so they reset when the backend restarts.</p>
          <Link to="/new" className="btn">Create the first one</Link>
        </div>
      )}
      {items && items.length > 0 && (
        <div className="cards">
          {items.map((c) => {
            const pubs = Object.values(c.content || {}).filter((x) => x.status === 'published').length
            return (
              <article className="camp" key={c.id}>
                <div className="camp-top">
                  <span className={`status-pill ${c.status}`}>{LABEL[c.status]}</span>
                  <small>{new Date(c.created_at).toLocaleDateString()}</small>
                </div>
                <h3>{c.input.name}</h3>
                <p>{c.input.product} · {c.input.audience}</p>
                <div className="plats">{c.input.platforms.map((p) => <span key={p}>{p}</span>)}</div>
                {pubs > 0 && <small className="muted">{pubs}/{c.input.platforms.length} published</small>}
                <div className="camp-actions">
                  <Link to={`/campaigns/${c.id}`} className="btn small">Open</Link>
                  <button className="btn small ghost" onClick={() => remove(c.id)}>Delete</button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
