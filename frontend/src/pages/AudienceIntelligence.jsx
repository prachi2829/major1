import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'

const PLAT_LABEL = { instagram: 'Instagram', linkedin: 'LinkedIn', twitter: 'X / Twitter', facebook: 'Facebook' }

export default function AudienceIntelligence({ notify }) {
  const { id: paramId } = useParams()
  const [campaigns, setCampaigns] = useState([])
  const [selectedId, setSelectedId] = useState(paramId || '')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cache, setCache] = useState({})

  // 1. Load campaigns list once on mount
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

  // 2. Load audience intelligence whenever selectedId changes
  useEffect(() => {
    if (!selectedId) return

    // If already in local session cache, render immediately
    if (cache[selectedId]) {
      setData(cache[selectedId])
      return
    }

    let isCurrent = true
    setLoading(true)
    setData(null)

    api.audience(selectedId)
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
    notify('Audience Intelligence Agent profiling cohorts…')
    try {
      const res = await api.reprofileAudience(selectedId)
      setData(res)
      setCache((prev) => ({ ...prev, [selectedId]: res }))
      notify('Audience cohorts updated for this campaign!')
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
          <p className="eyebrow">Audience Intelligence Engine</p>
          <h2>Micro-Cohort <em>Segmentation</em></h2>
          <p className="sub tight">Deep demographic &amp; psychographic profiling to tailor creative angles, solve audience friction points, and identify target platforms.</p>
        </div>
        <div className="cta-row nomargin">
          <Link to="/agents" className="btn small ghost">⚡ Multi-Agent Hub</Link>
          <Link to="/budget" className="btn small ghost">💰 Budget Optimizer</Link>
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
            {selectedCampaign && (
              <span className="pill" style={{ background: '#fff' }}>
                Target Market: <strong>{selectedCampaign.input.audience}</strong>
              </span>
            )}
            {data && data.data_source && (
              <span className={`pill ${data.data_source === 'gemini' ? 'gemini' : ''}`} style={{ background: '#fff' }}>
                {data.data_source === 'gemini' ? '🧠 AI-Profiled Cohorts (Gemini)' : '⚙️ Contextual Persona Synthesis'}
              </span>
            )}
          </div>

          <button className="btn small" disabled={loading || !selectedId} onClick={handleRefresh}>
            {loading ? 'Analyzing Segments…' : '↻ Re-Profile Audience'}
          </button>
        </div>
      </div>

      {/* Strategic Summary */}
      {data && data.summary && (
        <div className="panel" style={{ background: 'var(--green-bg)', borderColor: 'var(--green)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>💡</span>
            <h4 style={{ margin: 0, color: 'var(--green)' }}>Strategic Audience Synthesis</h4>
          </div>
          <p style={{ margin: 0, fontSize: '1.05rem', color: 'var(--ink)' }}>{data.summary}</p>
        </div>
      )}

      {loading && !data && (
        <div className="panel" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-2)' }}>
          <p style={{ fontSize: '1.1rem', margin: '0 0 8px' }}>⚡ Profiling custom audience cohorts for <strong>{selectedCampaign?.input.name}</strong>…</p>
          <small className="muted">Evaluating demographics, psychographics, friction points, and conversion triggers.</small>
        </div>
      )}

      {/* Cohorts Grid */}
      {data && data.segments && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '22px' }}>
          {data.segments.map((seg, idx) => (
            <div
              key={idx}
              className="panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: 'var(--card)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '1.22rem', color: 'var(--ink)', margin: 0 }}>{seg.segment_name}</h3>
                  <span className="pill" style={{ background: 'var(--paper-2)', fontWeight: 600 }}>
                    Cohort #{idx + 1}
                  </span>
                </div>

                <div style={{ background: 'var(--paper)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px' }}>
                  <small style={{ fontWeight: 600, color: 'var(--ink-2)', display: 'block' }}>Demographics &amp; Profile:</small>
                  <span style={{ fontSize: '0.9rem' }}>{seg.demographics}</span>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <small style={{ fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: '6px' }}>Core Pain Points:</small>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem' }}>
                    {(seg.pain_points || []).map((pt, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>{pt}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ background: 'var(--amber-bg)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px' }}>
                  <small style={{ fontWeight: 600, color: 'var(--ink-2)', display: 'block' }}>Value Proposition:</small>
                  <p style={{ margin: '4px 0 0', fontStyle: 'italic', fontSize: '0.92rem' }}>"{seg.value_proposition}"</p>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <small style={{ fontWeight: 600, color: 'var(--ink-2)', display: 'block' }}>Recommended Angle:</small>
                  <p style={{ margin: '4px 0 0', fontSize: '0.92rem' }}>{seg.recommended_angle}</p>
                </div>
              </div>

              <div>
                <small style={{ fontWeight: 600, color: 'var(--ink-2)', display: 'block', marginBottom: '6px' }}>Suggested Channels:</small>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(seg.suggested_platforms || []).map((p) => (
                    <span
                      key={p}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '99px',
                        background: 'var(--paper-2)',
                        border: '1px solid var(--line)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                      }}
                    >
                      {PLAT_LABEL[p.toLowerCase()] || p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
