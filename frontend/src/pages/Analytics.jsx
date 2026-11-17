import React, { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { BarList, LineChart, PLATFORM_LABEL, fmt, pct } from '../components/Charts.jsx'

const METRICS = [
  ['impressions', 'Impressions'],
  ['clicks', 'Clicks'],
  ['engagements', 'Engagements'],
  ['conversions', 'Conversions'],
]

function SimBadge() {
  return <span className="sim-badge" title="Real platform analytics need developer accounts and approval">Simulated demo data</span>
}

function Overview() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.overview().then(setItems).catch((e) => setError(e.message)) }, [])

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Phase 2 · Analytics &amp; Intelligence</p>
          <h2>How your campaigns <em>performed</em></h2>
          <p className="sub tight">Campaigns appear here once at least one platform is published.</p>
        </div>
        <SimBadge />
      </div>
      {error && <div className="notice err">{error}</div>}
      {!items && !error && <p className="muted">Loading…</p>}
      {items && items.length === 0 && (
        <div className="empty">
          <h3>Nothing to analyse yet</h3>
          <p>Create a campaign, approve its posts and publish them. Then come back here.</p>
          <Link to="/campaigns" className="btn">Go to campaigns</Link>
        </div>
      )}
      {items && items.length > 0 && (
        <div className="cards">
          {items.map((c) => (
            <article className="camp" key={c.campaign_id}>
              <h3>{c.name || `Campaign #${c.campaign_id}`}</h3>
              {c.published_platforms && (
                <div className="plats">{c.published_platforms.map((p) => <span key={p}>{p}</span>)}</div>
              )}
              {c.has_data && c.totals ? (
                <dl className="mini">
                  <div><dt>Impressions</dt><dd>{fmt(c.totals.impressions)}</dd></div>
                  <div><dt>Clicks</dt><dd>{fmt(c.totals.clicks)}</dd></div>
                  <div><dt>CTR</dt><dd>{pct(c.totals.ctr)}</dd></div>
                </dl>
              ) : <p className="muted small-text">No report generated yet.</p>}
              <div className="camp-actions">
                <Link to={`/analytics/${c.campaign_id}`} className="btn small">{c.has_data ? 'Open report' : 'Generate report'}</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function Detail({ id, notify }) {
  const [camp, setCamp] = useState(null)
  const [rep, setRep] = useState(null)
  const [metric, setMetric] = useState('impressions')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const [c, r, fHistory] = await Promise.all([
        api.get(id),
        api.analytics(id),
        api.getFeedbackHistory(id).catch(() => []),
      ])
      setCamp(c)
      setRep(r)
      if (fHistory && fHistory.length > 0) {
        setFeedback(fHistory[0])
      }
    } catch (e) { setError(e.message) }
  }, [id])

  useEffect(() => { load() }, [load])

  async function generate() {
    setBusy(true)
    try {
      setRep(await api.simulateAnalytics(id))
      notify('Simulated report generated')
    } catch (e) { notify(e.message, 'err') } finally { setBusy(false) }
  }

  async function runAiFeedbackLoop() {
    setFeedbackLoading(true)
    try {
      const res = await api.getFeedback(id)
      setFeedback(res)
      notify('Autonomous AI Optimization analysis complete!')
    } catch (e) {
      notify(e.message, 'err')
    } finally {
      setFeedbackLoading(false)
    }
  }

  if (error) return <section className="page"><div className="notice err">{error}</div><Link to="/analytics" className="btn ghost">Back</Link></section>
  if (!rep || !camp) return <section className="page"><p className="muted">Loading…</p></section>

  const published = Object.values(camp.content).filter((c) => c.status === 'published').length
  const series = rep.platforms.map((p) => ({
    platform: p.platform,
    points: rep.daily.filter((d) => d.platform === p.platform).map((d) => ({ day: d.day, value: d[metric] })),
  }))
  const t = rep.totals

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow"><Link to="/analytics">Analytics</Link> / campaign</p>
          <h2>{camp.input.name}</h2>
          <p className="sub tight">Goal: {camp.input.objective} · audience: {camp.input.audience}</p>
        </div>
        <div className="cta-row nomargin">
          <SimBadge />
          <Link to={`/campaigns/${id}`} className="btn ghost small">Back to workspace</Link>
        </div>
      </div>

      {!rep.has_data ? (
        <div className="empty">
          <h3>No report yet</h3>
          {published === 0
            ? <p>Publish at least one platform first.</p>
            : <p>Generate a 14-day <b>simulated</b> report for the {published} published platform{published > 1 ? 's' : ''}.</p>}
          {published > 0
            ? <button className="btn" disabled={busy} onClick={generate}>{busy ? 'Generating…' : 'Generate simulated report'}</button>
            : <Link to={`/campaigns/${id}`} className="btn">Open workspace</Link>}
        </div>
      ) : (
        <>
          <div className="notice">
            These numbers are <b>simulated</b> for the demo. Real platform adapters collect live impressions, clicks, and conversion rates.
          </div>

          <div className="kpis">
            <div className="kpi"><span>Impressions</span><b>{fmt(t.impressions)}</b></div>
            <div className="kpi"><span>Clicks</span><b>{fmt(t.clicks)}</b><small>CTR {pct(t.ctr)}</small></div>
            <div className="kpi"><span>Engagements</span><b>{fmt(t.engagements)}</b><small>Rate {pct(t.engagement_rate)}</small></div>
            <div className="kpi"><span>Conversions</span><b>{fmt(t.conversions)}</b><small>{pct(t.conversion_rate)} of clicks</small></div>
          </div>

          {/* AI FEEDBACK LOOP (Phase 2 feature) */}
          <div className="panel" style={{ border: '2px solid var(--accent)' }}>
            <div className="panel-head">
              <div>
                <p className="eyebrow" style={{ color: 'var(--accent)' }}>Phase 2 · Continuous Learning Cycle</p>
                <h3>🤖 AI Feedback &amp; Optimization Agent</h3>
                <p>Feeds real campaign metrics back to the Strategy Agent for algorithmic recommendations.</p>
              </div>
              <button
                className="btn small"
                disabled={feedbackLoading}
                onClick={runAiFeedbackLoop}
                style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}
              >
                {feedbackLoading ? 'AI is analyzing…' : feedback ? 'Re-run Optimization Loop' : 'Trigger AI Feedback Loop'}
              </button>
            </div>

            {feedback ? (
              <div style={{ padding: '0 24px 24px' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
                  <div style={{ background: 'var(--paper-2)', padding: '12px 20px', borderRadius: '12px', textAlign: 'center' }}>
                    <small style={{ textTransform: 'uppercase', fontSize: '0.7rem', color: 'var(--ink-2)' }}>Campaign Score</small>
                    <div style={{ font: '600 2rem var(--serif)', color: feedback.score >= 80 ? 'var(--green)' : 'var(--accent)' }}>
                      {feedback.score}<span style={{ fontSize: '1rem' }}>/100</span>
                    </div>
                  </div>
                  <div>
                    <span className="status-pill published" style={{ fontSize: '0.8rem', padding: '4px 12px' }}>
                      Performance: {feedback.overall_rating}
                    </span>
                    <p className="small-text muted" style={{ margin: '6px 0 0' }}>
                      Continuous optimization cycle evaluated 14-day metric distribution.
                    </p>
                  </div>
                </div>

                <div className="two" style={{ marginBottom: '20px' }}>
                  <div style={{ background: 'var(--green-bg)', padding: '16px', borderRadius: '12px' }}>
                    <strong style={{ color: 'var(--green)', display: 'block', marginBottom: '8px' }}>✓ Key Strengths</strong>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.9rem' }}>
                      {(feedback.strengths || []).map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>

                  <div style={{ background: 'var(--amber-bg)', padding: '16px', borderRadius: '12px' }}>
                    <strong style={{ color: '#8a6212', display: 'block', marginBottom: '8px' }}>⚠️ Improvement Areas</strong>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.9rem' }}>
                      {(feedback.weaknesses || []).map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                </div>

                <h4>Recommended Strategic Action Plan</h4>
                <div style={{ display: 'grid', gap: '10px', marginTop: '10px' }}>
                  {(feedback.recommendations || []).map((r, i) => (
                    <div key={i} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '10px', padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <strong>{r.area}</strong>
                        <span className={`status-pill ${r.priority.toLowerCase() === 'high' ? 'published' : 'strategy_ready'}`}>
                          {r.priority} Priority
                        </span>
                      </div>
                      <p className="small-text muted" style={{ margin: 0 }}>{r.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="muted pad">Click "Trigger AI Feedback Loop" above to let the Optimization Agent evaluate your metrics.</p>
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <div><h3>Daily trend</h3><p>Last 14 days, by platform.</p></div>
              <div className="tabs">
                {METRICS.map(([k, l]) => <button key={k} className={metric === k ? 'on' : ''} onClick={() => setMetric(k)}>{l}</button>)}
              </div>
            </div>
            <div className="pad"><LineChart series={series} metricLabel={METRICS.find((m) => m[0] === metric)[1]} /></div>
          </div>

          <div className="two">
            <div className="panel">
              <div className="panel-head"><div><h3>Conversions by platform</h3>{rep.best_platform && <p>Top performer: <b>{PLATFORM_LABEL[rep.best_platform]}</b></p>}</div></div>
              <div className="pad"><BarList rows={rep.platforms.map((p) => ({ platform: p.platform, value: p.conversions }))} /></div>
            </div>
            <div className="panel">
              <div className="panel-head"><div><h3>Click-through rate</h3><p>Clicks divided by impressions.</p></div></div>
              <div className="pad"><BarList rows={rep.platforms.map((p) => ({ platform: p.platform, value: p.ctr }))} format={pct} /></div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><div><h3>Platform breakdown</h3></div>
              <button className="btn small ghost" disabled={busy} onClick={generate}>{busy ? 'Regenerating…' : 'Regenerate simulation'}</button></div>
            <div className="pad"><table className="table">
              <thead><tr><th>Platform</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th>Engagement</th><th>Conversions</th></tr></thead>
              <tbody>{rep.platforms.map((p) => (
                <tr key={p.platform}><td>{PLATFORM_LABEL[p.platform]}</td><td>{p.impressions.toLocaleString()}</td><td>{p.clicks.toLocaleString()}</td>
                  <td>{pct(p.ctr)}</td><td>{pct(p.engagement_rate)}</td><td>{p.conversions.toLocaleString()}</td></tr>
              ))}</tbody>
            </table></div>
          </div>
        </>
      )}
    </section>
  )
}

export default function Analytics({ notify }) {
  const { id } = useParams()
  return id ? <Detail key={id} id={id} notify={notify} /> : <Overview />
}
