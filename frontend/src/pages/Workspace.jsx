import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'
import Preview from '../components/Previews.jsx'

const PLAT_LABEL = { instagram: 'Instagram', linkedin: 'LinkedIn', twitter: 'X / Twitter', facebook: 'Facebook' }
const LIMITS = { twitter: 280, instagram: 2200, linkedin: 3000, facebook: 3000 }

export default function Workspace({ notify, health }) {
  const { id } = useParams()
  const [c, setC] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [tab, setTab] = useState(null)
  const [draft, setDraft] = useState({}) // local, instantly-previewed edits per platform
  const [saving, setSaving] = useState(false)
  const [schedules, setSchedules] = useState([])
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const timers = useRef({})

  const loadSchedules = useCallback(async () => {
    try {
      const sch = await api.getCampaignSchedules(id)
      setSchedules(sch || [])
    } catch {}
  }, [id])

  const load = useCallback(async () => {
    try {
      const data = await api.get(id)
      setC(data)
      setTab((t) => t || data.input.platforms[0])
      loadSchedules()
    } catch (e) { setErr(e.message) }
  }, [id, loadSchedules])

  useEffect(() => { load() }, [load])
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), [])

  async function run(label, fn, okMsg) {
    setBusy(label)
    try {
      const res = await fn()
      if (res && res.id) { setC(res); setDraft({}) }
      if (okMsg) notify(okMsg)
      loadSchedules()
      return res
    } catch (e) { notify(e.message, 'err') } finally { setBusy('') }
  }

  const handleSchedulePost = async (p) => {
    if (!scheduleTime) {
      notify('Select a future date & time first', 'err')
      return
    }
    setScheduling(true)
    try {
      const iso = new Date(scheduleTime).toISOString()
      await api.schedulePost(id, {
        campaign_id: id,
        platform: p,
        scheduled_at: iso,
        content: c.content[p],
      })
      notify(`${PLAT_LABEL[p]} queued for distribution`)
      await loadSchedules()
    } catch (e) {
      notify(e.message, 'err')
    } finally {
      setScheduling(false)
    }
  }

  const handleCancelSchedule = async (sid) => {
    try {
      await api.cancelSchedule(sid)
      notify('Schedule cancelled')
      await loadSchedules()
    } catch (e) {
      notify(e.message, 'err')
    }
  }

  if (err) return <section className="page"><div className="notice err">{err}</div><Link to="/campaigns" className="btn ghost">Back</Link></section>
  if (!c) return <section className="page"><p className="muted">Loading…</p></section>

  const { input, strategy, content } = c
  const platforms = input.platforms
  const hasContent = Object.keys(content).length > 0
  const allPublished = hasContent && Object.values(content).every((x) => x.status === 'published')
  const step = allPublished ? 5 : hasContent ? 3 : strategy ? 2 : 1

  const view = (p) => ({ ...content[p], ...(draft[p] || {}) })

  function onEdit(p, patch) {
    setDraft((d) => ({ ...d, [p]: { ...(d[p] || {}), ...patch } }))
    clearTimeout(timers.current[p])
    setSaving(true)
    timers.current[p] = setTimeout(async () => {
      try {
        const saved = await api.edit(id, p, patch)
        setC((cur) => ({ ...cur, content: { ...cur.content, [p]: saved } }))
        setDraft((d) => { const n = { ...d }; delete n[p]; return n })
      } catch (e) { notify(e.message, 'err') } finally { setSaving(false) }
    }, 600)
  }

  const flush = async (p) => {
    clearTimeout(timers.current[p])
    const pending = draft[p]
    if (pending) {
      const saved = await api.edit(id, p, pending)
      setC((cur) => ({ ...cur, content: { ...cur.content, [p]: saved } }))
      setDraft((d) => { const n = { ...d }; delete n[p]; return n })
    }
  }

  async function approve(p) {
    await run('approve', async () => {
      await flush(p)
      await api.approve(id, p)
      return api.get(id)
    }, `${PLAT_LABEL[p]} approved`)
  }

  const approvedCount = platforms.filter((p) => ['approved', 'published'].includes(content[p]?.status)).length
  const cur = tab && content[tab] ? view(tab) : null
  const locked = cur?.status === 'published'

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Campaign workspace</p>
          <h2>{input.name}</h2>
          <p className="sub tight">{input.product} · for {input.audience} · {input.tone} · goal: {input.objective}</p>
        </div>
        <div className="cta-row nomargin">
          <Link to={`/analytics/${id}`} className="btn small">📈 Analytics &amp; AI Feedback</Link>
          <Link to="/scheduler" className="btn small ghost">📅 All Schedules</Link>
          <Link to="/campaigns" className="btn ghost small">All campaigns</Link>
        </div>
      </div>

      <ol className="stepper">
        {['Brief', 'Strategy', 'Content', 'Review', 'Publish / Schedule'].map((s, i) => (
          <li key={s} className={i + 1 < step ? 'done' : i + 1 === step ? 'now' : ''}><span>{i + 1 < step ? '✓' : i + 1}</span>{s}</li>
        ))}
      </ol>

      {/* Autonomous Intelligence Action Bar */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--paper-2)', padding: '12px 18px', borderRadius: '12px', border: '1px solid var(--line)', marginBottom: '24px' }}>
        <strong style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          ⚡ Autonomous Intelligence:
        </strong>
        <Link to={`/agents/${id}`} className="btn small ghost" style={{ background: '#fff' }}>🧠 Agent Command Center</Link>
        <Link to={`/ab-testing/${id}`} className="btn small ghost" style={{ background: '#fff' }}>🧪 A/B Testing Lab</Link>
        <Link to={`/audience/${id}`} className="btn small ghost" style={{ background: '#fff' }}>👥 Micro-Cohorts</Link>
        <Link to={`/budget/${id}`} className="btn small ghost" style={{ background: '#fff' }}>💰 Dynamic Budget</Link>
        <Link to={`/competitors/${id}`} className="btn small ghost" style={{ background: '#fff' }}>🛡️ Competitor Radar</Link>
      </div>

      {health?.status === 'down' && (
        <div className="notice err">The backend is not reachable. Start it with <code>uvicorn app.main:app --port 8000</code> in the <code>backend</code> folder.</div>
      )}
      {health?.mode === 'no_key' && (
        <div className="notice err">Gemini API key missing. Create <code>backend/.env</code> with <code>GEMINI_API_KEY=your_key</code> and restart the backend. Generation is disabled until then.</div>
      )}

      {/* Strategy Agent */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>1 · Strategy Agent</h3>
            <p>Converts your requirements into a structured marketing plan.</p>
          </div>
          <button className="btn small" disabled={!!busy || health?.mode === 'no_key'} onClick={() => run('strategy', () => api.strategy(id), 'Strategy generated')}>
            {busy === 'strategy' ? 'Gemini is thinking…' : strategy ? 'Regenerate strategy' : 'Generate strategy'}
          </button>
        </div>
        {strategy ? (
          <div className="strategy">
            <span className="src gemini">Gemini</span>
            <dl>
              <div><dt>Campaign goal</dt><dd>{strategy.campaign_goal}</dd></div>
              <div><dt>Core message</dt><dd>{strategy.core_message}</dd></div>
              <div><dt>Content pillars</dt><dd><ul>{strategy.content_pillars.map((p) => <li key={p}>{p}</li>)}</ul></dd></div>
              <div><dt>Messaging approach</dt><dd>{strategy.messaging_approach}</dd></div>
              <div><dt>Call to action</dt><dd>{strategy.call_to_action}</dd></div>
              <div><dt>Direction</dt><dd>{strategy.campaign_direction}</dd></div>
            </dl>
          </div>
        ) : <p className="muted pad">No strategy yet.</p>}
      </div>

      {/* Content Agent */}
      <div className={`panel ${!strategy ? 'off' : ''}`}>
        <div className="panel-head">
          <div>
            <h3>2 · Content Generation Agent</h3>
            <p>Uses the campaign and the strategy to write platform-specific posts.</p>
          </div>
          <button className="btn small" disabled={!strategy || !!busy}
            onClick={() => {
              if (hasContent && !window.confirm('Regenerating replaces all current drafts and edits. Continue?')) return
              run('content', () => api.content(id), 'Content generated')
            }}>
            {busy === 'content' ? 'Gemini is writing…' : hasContent ? 'Regenerate all' : 'Generate content'}
          </button>
        </div>
        {!strategy && <p className="muted pad">Generate the strategy first.</p>}
      </div>

      {/* Review & Publish */}
      {hasContent && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>3 · Review, edit and publish</h3>
              <p>Edit on the left; preview updates instantly. {saving ? 'Saving…' : 'All changes saved.'}</p>
            </div>
            <div className="tabs">
              {platforms.map((p) => (
                <button key={p} className={tab === p ? 'on' : ''} onClick={() => setTab(p)}>
                  {PLAT_LABEL[p]} <i className={`st ${content[p]?.status}`} title={content[p]?.status} />
                </button>
              ))}
            </div>
          </div>

          {cur && (
            <div className="editor">
              <div className="edit-col">
                <div className="meta">
                  <span className={`status-pill ${cur.status}`}>{cur.status}</span>
                  <span className="src gemini">Gemini</span>
                  {cur.edited && <span className="src edited">edited</span>}
                </div>

                <label className="field">
                  <span>Headline</span>
                  <input disabled={locked} value={cur.headline || ''} onChange={(e) => onEdit(tab, { headline: e.target.value })} />
                </label>
                <label className="field">
                  <span>Post copy</span>
                  <textarea rows="8" disabled={locked} value={cur.body} onChange={(e) => onEdit(tab, { body: e.target.value })} />
                  <small className={cur.body.length > LIMITS[tab] ? 'over' : ''}>{cur.body.length}/{LIMITS[tab]} characters</small>
                </label>
                <label className="field">
                  <span>Hashtags <small>(space separated)</small></span>
                  <input disabled={locked} value={(cur.hashtags || []).join(' ')}
                    onChange={(e) => onEdit(tab, { hashtags: e.target.value.split(/\s+/).filter(Boolean) })} />
                </label>
                <label className="field">
                  <span>Call to action</span>
                  <input disabled={locked} value={cur.call_to_action || ''} onChange={(e) => onEdit(tab, { call_to_action: e.target.value })} />
                </label>

                <div className="cta-row">
                  <button className="btn small ghost" disabled={locked || !!busy}
                    onClick={() => run('regen', async () => { await api.regenerate(id, tab); return api.get(id) }, `${PLAT_LABEL[tab]} regenerated`)}>
                    Regenerate this post
                  </button>
                  <button className="btn small" disabled={locked || cur.status === 'approved' || !!busy || cur.body.length > LIMITS[tab]} onClick={() => approve(tab)}>
                    {cur.status === 'approved' ? 'Approved ✓' : locked ? 'Published' : 'Approve'}
                  </button>
                </div>
              </div>

              <div className="prev-col">
                <small className="label">Live preview · {PLAT_LABEL[tab]}</small>
                <Preview platform={tab} content={cur} brand={input.name} />
                {locked && cur.published_at && <p className="muted small-text">Published {new Date(cur.published_at).toLocaleString()} (simulated)</p>}
              </div>
            </div>
          )}

          <div className="publish-bar">
            <div>
              <b>{approvedCount}/{platforms.length}</b> platforms approved
              <small>Publish now or schedule future automatic distribution via the Campaign Scheduler.</small>
            </div>
            <div className="cta-row" style={{ marginTop: 0 }}>
              <button
                className="btn ghost small"
                disabled={approvedCount === 0}
                onClick={() => setShowSchedule(!showSchedule)}
              >
                📅 {showSchedule ? 'Close Schedule' : 'Schedule for Later'}
              </button>
              <button className="btn" disabled={!!busy || allPublished || approvedCount === 0}
                onClick={() => run('publish', () => api.publish(id, platforms.filter((p) => content[p]?.status === 'approved')), 'Approved content published')}>
                {allPublished ? 'All published ✓' : busy === 'publish' ? 'Publishing…' : 'Publish approved now'}
              </button>
            </div>
          </div>

          {/* Phase 2: Scheduling Drawer */}
          {showSchedule && (
            <div style={{ background: 'var(--amber-bg)', padding: '20px 24px', borderTop: '1px solid var(--line)' }}>
              <h4>📅 Schedule Automated Distribution</h4>
              <p className="small-text muted">Pick release date &amp; time. The background scheduler worker will publish automatically.</p>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
                <input
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff' }}
                />
                {platforms.map((p) => (
                  <button
                    key={p}
                    className="btn small"
                    disabled={scheduling || content[p]?.status !== 'approved'}
                    onClick={() => handleSchedulePost(p)}
                  >
                    Queue {PLAT_LABEL[p]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Scheduled queue display */}
          {schedules.length > 0 && (
            <div style={{ padding: '16px 24px', background: 'var(--paper-2)', borderTop: '1px dashed var(--line)' }}>
              <h5 style={{ marginBottom: '8px' }}>⏰ Scheduled Distribution Queue for this Campaign:</h5>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {schedules.map((s) => (
                  <div key={s.id} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '10px', padding: '8px 14px', fontSize: '0.85rem' }}>
                    <strong>{PLAT_LABEL[s.platform.toLowerCase()] || s.platform}</strong> · {new Date(s.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · <span className={`status-pill ${s.status}`}>{s.status}</span>
                    {s.status === 'pending' && (
                      <button
                        onClick={() => handleCancelSchedule(s.id)}
                        style={{ marginLeft: '10px', border: 0, background: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
