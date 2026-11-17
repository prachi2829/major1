import React, { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'

export default function CompetitorIntelligence({ notify }) {
  const { id: paramId } = useParams()
  const [campaigns, setCampaigns] = useState([])
  const [selectedId, setSelectedId] = useState(paramId || '')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [cache, setCache] = useState({})

  // Load campaigns once on mount
  useEffect(() => {
    let isMounted = true
    api.list()
      .then((cList) => {
        if (!isMounted) return
        setCampaigns(cList || [])
        const initialId = paramId || (cList && cList[0]?.id)
        if (initialId) {
          setSelectedId(initialId)
        }
      })
      .catch((e) => {
        if (isMounted) setError(e.message)
      })
    return () => { isMounted = false }
  }, [paramId])

  // Load competitor intelligence whenever selectedId changes
  useEffect(() => {
    if (!selectedId) return

    if (cache[selectedId]) {
      setData(cache[selectedId])
      return
    }

    let isCurrent = true
    setLoading(true)
    setData(null)

    api.competitors(selectedId)
      .then((res) => {
        if (!isCurrent) return
        setData(res)
        setCache((prev) => ({ ...prev, [selectedId]: res }))
      })
      .catch((e) => {
        if (!isCurrent) return
        notify(e.message, 'err')
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })

    return () => { isCurrent = false }
  }, [selectedId, cache, notify])

  const handleSelectCampaign = (cid) => {
    setSelectedId(cid)
  }

  const handleRefresh = async () => {
    if (!selectedId) return
    setLoading(true)
    notify('Competitor Intelligence Agent scanning market landscape…')
    try {
      const res = await api.competitors(selectedId)
      setData(res)
      setCache((prev) => ({ ...prev, [selectedId]: res }))
      notify('Competitor radar updated!')
    } catch (e) {
      notify(e.message, 'err')
    } finally {
      setLoading(false)
    }
  }

  const selectedCampaign = campaigns.find((c) => c.id === selectedId)

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Competitor Intelligence Radar</p>
          <h2>Market Radar &amp; <em>Counter-Positioning</em></h2>
          <p className="sub tight">Scan competitor positioning, pinpoint institutional vulnerabilities, and deploy high-converting counter-messaging.</p>
        </div>
        <div className="cta-row nomargin">
          <Link to="/agents" className="btn small ghost">⚡ Multi-Agent Hub</Link>
          <Link to="/audience" className="btn small ghost">👥 Audience Intel</Link>
          <Link to="/campaigns" className="btn small ghost">Campaigns</Link>
        </div>
      </div>

      {error && <div className="notice err">{error}</div>}

      {/* Campaign selector bar */}
      <div className="panel" style={{ background: 'var(--paper-2)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>Active Campaign:</span>
            <select
              value={selectedId}
              onChange={(e) => handleSelectCampaign(e.target.value)}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', fontSize: '0.95rem' }}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.input.name} ({c.input.product})
                </option>
              ))}
            </select>
            {data && data.market_position && (
              <span className="pill gemini">Position: {data.market_position}</span>
            )}
          </div>

          <button className="btn small" disabled={loading || !selectedId} onClick={handleRefresh}>
            {loading ? 'Scanning Market…' : '↻ Re-Analyze Competitors'}
          </button>
        </div>
      </div>

      {/* Market Positioning & Strategic Differentiation */}
      {data && (
        <div className="panel" style={{ background: 'var(--amber-bg)', borderColor: '#d9a21f', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span className="pill" style={{ background: '#fff', fontWeight: 600 }}>
                  Strategic Differentiation Playbook
                </span>
                <span className={`pill ${data.data_source === 'live_web_search' ? 'gemini' : ''}`} style={{ background: '#fff' }}>
                  {data.data_source === 'live_web_search' ? '🌐 Live Web Search Results' : '⚠️ Labeled AI Hypotheses'}
                </span>
              </div>
              <h3 style={{ marginTop: '6px' }}>Recommended Market Positioning: <em>{data.market_position}</em></h3>
              <p style={{ margin: '8px 0 0', fontSize: '1.02rem', color: 'var(--ink)' }}>
                {data.recommended_differentiation}
              </p>
              <p className="small-text" style={{ margin: '10px 0 0', color: 'var(--ink-2)', fontStyle: 'italic', borderTop: '1px dashed var(--line)', paddingTop: '8px' }}>
                📌 Transparency Note: {data.disclaimer || "Gemini has no live market data, so it will give clearly labeled 'AI hypotheses' about types of competitors, not named companies."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* White-Space Opportunities */}
      {data && data.white_space_opportunities && (
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ marginBottom: '14px' }}>Untapped Market White-Spaces</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {data.white_space_opportunities.map((opp, idx) => (
              <div
                key={idx}
                className="panel"
                style={{
                  background: 'var(--green-bg)',
                  borderColor: 'var(--green)',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>🚀</span>
                <div>
                  <strong style={{ color: 'var(--green)', display: 'block' }}>Opportunity #{idx + 1}</strong>
                  <span style={{ fontSize: '0.95rem', color: 'var(--ink)' }}>{opp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competitor Counter-Angles */}
      {data && data.competitor_angles && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Competitor Vulnerabilities &amp; Counter-Hooks</h3>
              <p>Direct counter-angles mapped against incumbent players in this niche.</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 20px 20px' }}>
            {data.competitor_angles.map((ang, idx) => (
              <div
                key={idx}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: '12px',
                  padding: '18px 20px',
                  background: 'var(--card)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem' }}>{ang.competitor_type}</h4>
                    {ang.named_competitors && ang.named_competitors.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        {ang.named_competitors.map((comp, ci) => (
                          <span key={ci} style={{ fontSize: '0.78rem', background: 'var(--paper-2)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            🏢 {comp}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="status-pill draft">Competitor Profile</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '12px' }}>
                  <div style={{ background: 'var(--red-bg)', padding: '12px 14px', borderRadius: '8px' }}>
                    <small style={{ fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Their Vulnerability / Blindspot:
                    </small>
                    <p style={{ margin: '4px 0 0', fontSize: '0.92rem' }}>{ang.weakness}</p>
                  </div>

                  <div style={{ background: 'var(--green-bg)', padding: '12px 14px', borderRadius: '8px' }}>
                    <small style={{ fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Our High-Conversion Counter-Hook:
                    </small>
                    <p style={{ margin: '4px 0 0', fontSize: '0.92rem', fontWeight: 600 }}>"{ang.counter_hook}"</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
