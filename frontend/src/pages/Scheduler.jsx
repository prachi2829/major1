import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

const PLAT_LABEL = { instagram: 'Instagram', linkedin: 'LinkedIn', twitter: 'X / Twitter', facebook: 'Facebook' }

export default function Scheduler({ notify }) {
  const [schedules, setSchedules] = useState([])
  const [campaigns, setCampaigns] = useState({})
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(null)

  const loadData = async () => {
    try {
      const [schList, campList] = await Promise.all([
        api.listAllSchedules(),
        api.list(),
      ])
      setSchedules(schList || [])
      const map = {}
      ;(campList || []).forEach((c) => { map[c.id] = c })
      setCampaigns(map)
    } catch (e) {
      if (notify) notify(e.message, 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const timer = setInterval(loadData, 15000)
    return () => clearInterval(timer)
  }, [])

  const handleCancel = async (sid) => {
    if (!window.confirm('Cancel this scheduled post?')) return
    setCancelling(sid)
    try {
      await api.cancelSchedule(sid)
      if (notify) notify('Scheduled post cancelled')
      await loadData()
    } catch (e) {
      if (notify) notify(e.message, 'err')
    } finally {
      setCancelling(null)
    }
  }

  const filtered = schedules.filter((s) => {
    if (filter === 'all') return true
    return s.status === filter
  })

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Phase 2 · Autonomous Distribution</p>
          <h2>Campaign <em>Scheduler</em></h2>
          <p className="sub tight">
            Automated background publisher runs every 15s. Queue upcoming posts across your connected channels.
          </p>
        </div>
        <div className="cta-row nomargin">
          <Link to="/campaigns" className="btn small ghost">Workspace</Link>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: '20px' }}>
        {['all', 'pending', 'published', 'failed'].map((st) => (
          <button
            key={st}
            className={filter === st ? 'on' : ''}
            onClick={() => setFilter(st)}
            style={{ textTransform: 'capitalize' }}
          >
            {st} ({schedules.filter((s) => st === 'all' || s.status === st).length})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted">Loading scheduled distribution queue…</p>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <h3>No {filter !== 'all' ? filter : ''} scheduled posts found</h3>
          <p className="muted">
            Go to any approved campaign workspace to schedule posts for future automated release.
          </p>
          <Link to="/campaigns" className="btn small" style={{ marginTop: '16px' }}>Go to Campaigns</Link>
        </div>
      ) : (
        <div className="cards">
          {filtered.map((s) => {
            const camp = campaigns[s.campaign_id]
            const plat = s.platform.toLowerCase()
            return (
              <div key={s.id} className="camp">
                <div className="camp-top">
                  <span className="src gemini">{PLAT_LABEL[plat] || s.platform}</span>
                  <span className={`status-pill ${s.status}`}>{s.status}</span>
                </div>
                <h3>{camp?.input?.name || `Campaign #${s.campaign_id}`}</h3>
                <p className="small-text muted">
                  <strong>Scheduled:</strong> {new Date(s.scheduled_at).toLocaleString()}
                </p>
                {s.content?.body && (
                  <p className="small-text" style={{ fontStyle: 'italic', margin: '8px 0', borderLeft: '2px solid var(--line)', paddingLeft: '8px' }}>
                    "{s.content.body.slice(0, 120)}..."
                  </p>
                )}
                {s.error && <p className="small-text" style={{ color: 'var(--accent)' }}>⚠️ {s.error}</p>}
                {s.published_at && (
                  <p className="small-text" style={{ color: 'var(--green)' }}>✓ Published at {new Date(s.published_at).toLocaleTimeString()}</p>
                )}

                <div className="camp-actions" style={{ marginTop: 'auto', paddingTop: '10px' }}>
                  {camp && <Link to={`/campaigns/${s.campaign_id}`} className="btn ghost small">Workspace</Link>}
                  {s.status === 'pending' && (
                    <button
                      className="btn ghost small"
                      style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
                      disabled={cancelling === s.id}
                      onClick={() => handleCancel(s.id)}
                    >
                      {cancelling === s.id ? 'Cancelling…' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
