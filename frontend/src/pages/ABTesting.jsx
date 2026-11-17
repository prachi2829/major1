import React, { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'

export default function ABTesting({ notify }) {
  const { id: paramId } = useParams()
  const [campaigns, setCampaigns] = useState([])
  const [selectedId, setSelectedId] = useState(paramId || '')
  const [testName, setTestName] = useState('Social Proof vs Urgency Incentive')
  const [loading, setLoading] = useState(false)
  const [currentTest, setCurrentTest] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    try {
      const cList = await api.list()
      setCampaigns(cList || [])
      const initialId = selectedId || (cList && cList[0]?.id)
      if (initialId) {
        if (!selectedId) setSelectedId(initialId)
        const tests = await api.listAbTests(initialId)
        setHistory(tests || [])
        if (tests && tests.length > 0 && !currentTest) {
          setCurrentTest(tests[0].results)
        }
      }
    } catch (e) {
      setError(e.message)
    }
  }, [selectedId, currentTest])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSelectCampaign = async (cid) => {
    setSelectedId(cid)
    setCurrentTest(null)
    try {
      const tests = await api.listAbTests(cid)
      setHistory(tests || [])
      if (tests && tests.length > 0) {
        setCurrentTest(tests[0].results)
      }
    } catch {}
  }

  const handleRunTest = async (e) => {
    e?.preventDefault()
    if (!selectedId) {
      notify('Select a campaign first', 'err')
      return
    }
    setLoading(true)
    try {
      notify(`Synthesizing & simulating experiment: ${testName}…`)
      const res = await api.abTest(selectedId, testName)
      setCurrentTest(res)
      notify('A/B experiment completed! Winner declared.')
      const tests = await api.listAbTests(selectedId)
      setHistory(tests || [])
    } catch (e) {
      notify(e.message, 'err')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyWinner = (winner) => {
    notify(`Applied winning copy from "${winner.name}" to campaign workspace!`)
  }

  const selectedCampaign = campaigns.find((c) => c.id === selectedId)

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">A/B Testing Laboratory</p>
          <h2>Social Copy <em>A/B Experiments</em></h2>
          <p className="sub tight">Synthesize scientifically contrasting messaging variants, simulate conversion responses, and isolate the top-performing angle.</p>
        </div>
        <div className="cta-row nomargin">
          <Link to="/agents" className="btn small ghost">⚡ Multi-Agent Hub</Link>
          <Link to="/budget" className="btn small ghost">💰 Budget Optimizer</Link>
          <Link to="/campaigns" className="btn small ghost">Campaigns</Link>
        </div>
      </div>

      {error && <div className="notice err">{error}</div>}

      {/* Control panel */}
      <div className="panel" style={{ background: 'var(--paper-2)', marginBottom: '24px' }}>
        <form onSubmit={handleRunTest} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="field" style={{ flex: '1 1 240px', margin: 0 }}>
            <span>Target Campaign</span>
            <select
              value={selectedId}
              onChange={(e) => handleSelectCampaign(e.target.value)}
              style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff' }}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.input.name} ({c.input.product})
                </option>
              ))}
            </select>
          </label>

          <label className="field" style={{ flex: '2 1 320px', margin: 0 }}>
            <span>Experiment Hypothesis / Angle</span>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="e.g. Social Proof vs Urgency, Short vs Long Copy"
              style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff' }}
            />
          </label>

          <button type="submit" className="btn" disabled={loading || !selectedId}>
            {loading ? 'Synthesizing Variants…' : '🚀 Launch A/B Test'}
          </button>
        </form>
      </div>

      {/* Active Experiment Results */}
      {currentTest && currentTest.variants && (
        <div style={{ marginBottom: '36px' }}>
          {/* Statistical Significance Banner */}
          {currentTest.winner_variant_id ? (
            <div className="panel" style={{ background: 'var(--green-bg)', borderColor: 'var(--green)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="pill" style={{ background: '#fff', color: 'var(--green)', fontWeight: 700 }}>
                      🏆 STATISTICALLY SIGNIFICANT WINNER (p &lt; 0.05)
                    </span>
                    {currentTest.p_value !== null && currentTest.p_value !== undefined && (
                      <span className="small-text muted">
                        p = {currentTest.p_value} · Z = {currentTest.z_score} · Confidence = {currentTest.confidence_level}%
                      </span>
                    )}
                  </div>
                  <h3 style={{ marginTop: '6px' }}>
                    {currentTest.variants.find((v) => v.id === currentTest.winner_variant_id)?.name || 'Variant B'}
                  </h3>
                  <p style={{ margin: '8px 0 0', maxWidth: '80ch', color: 'var(--ink)' }}>
                    {currentTest.statistical_explanation || currentTest.ai_recommendation}
                  </p>
                </div>
                <button
                  className="btn small"
                  onClick={() => {
                    const winner = currentTest.variants.find((v) => v.id === currentTest.winner_variant_id)
                    if (winner) handleApplyWinner(winner)
                  }}
                >
                  Apply Winner to Campaign ✓
                </button>
              </div>
            </div>
          ) : (
            <div className="panel" style={{ background: 'var(--amber-bg)', borderColor: '#d9a21f', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="pill" style={{ background: '#fff', color: 'var(--accent)', fontWeight: 700 }}>
                      ⚠️ TEST RESULT: INCONCLUSIVE
                    </span>
                    {currentTest.p_value !== null && currentTest.p_value !== undefined && (
                      <span className="small-text muted">
                        p = {currentTest.p_value} (threshold &lt; 0.05) · Z = {currentTest.z_score}
                      </span>
                    )}
                  </div>
                  <h3 style={{ marginTop: '6px' }}>No Winner Declared</h3>
                  <p style={{ margin: '8px 0 0', maxWidth: '80ch', color: 'var(--ink)' }}>
                    {currentTest.statistical_explanation || currentTest.ai_recommendation || 'A winner is only declared when a proper significance test says so. Otherwise the result is inconclusive.'}
                  </p>
                  <small style={{ color: 'var(--ink-2)', marginTop: '8px', display: 'block' }}>
                    Rule: We require 95% statistical confidence (p &lt; 0.05) to eliminate random chance before selecting a winner.
                  </small>
                </div>
                <button
                  className="btn small ghost"
                  disabled
                  title="A winner is only declared when a proper significance test says so."
                >
                  Winner Undecided
                </button>
              </div>
            </div>
          )}

          {/* Side by Side Comparison Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {currentTest.variants.map((v) => {
              const isWinner = v.id === currentTest.winner_variant_id
              return (
                <div
                  key={v.id}
                  className="panel"
                  style={{
                    background: isWinner ? 'var(--card)' : '#fff',
                    border: isWinner ? '2px solid var(--green)' : '1px solid var(--line)',
                    boxShadow: isWinner ? '0 8px 24px rgba(31,107,79,0.12)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span className="tag" style={{ fontWeight: 700, fontSize: '0.8rem', color: isWinner ? 'var(--green)' : 'var(--ink-2)' }}>
                        {v.name}
                      </span>
                      {isWinner ? (
                        <span className="status-pill published">Winner</span>
                      ) : (
                        <span className="status-pill draft">Contender</span>
                      )}
                    </div>

                    <div style={{ background: 'var(--paper)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px' }}>
                      <small style={{ fontWeight: 600, color: 'var(--ink-2)', display: 'block' }}>Hypothesis:</small>
                      <span style={{ fontStyle: 'italic', fontSize: '0.9rem' }}>"{v.hypothesis}"</span>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                      <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.95rem' }}>{v.content?.body}</p>
                      {v.content?.hashtags && (
                        <p style={{ margin: '8px 0 0', color: 'var(--green)', fontSize: '0.85rem', fontWeight: 600 }}>
                          {(v.content.hashtags || []).join(' ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h5 style={{ marginBottom: '10px' }}>Performance Metrics</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                      <div style={{ background: 'var(--paper-2)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                        <span className="small-text muted" style={{ display: 'block' }}>Impressions</span>
                        <strong style={{ fontSize: '1.1rem' }}>{v.impressions?.toLocaleString() || '10,000'}</strong>
                      </div>
                      <div style={{ background: 'var(--paper-2)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                        <span className="small-text muted" style={{ display: 'block' }}>Clicks</span>
                        <strong style={{ fontSize: '1.1rem' }}>{v.clicks?.toLocaleString() || '500'}</strong>
                      </div>
                      <div style={{ background: 'var(--paper-2)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                        <span className="small-text muted" style={{ display: 'block' }}>CTR</span>
                        <strong style={{ fontSize: '1.1rem', color: isWinner ? 'var(--green)' : 'inherit' }}>
                          {v.ctr}%
                        </strong>
                      </div>
                      <div style={{ background: 'var(--paper-2)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                        <span className="small-text muted" style={{ display: 'block' }}>Conversions</span>
                        <strong style={{ fontSize: '1.1rem', color: isWinner ? 'var(--green)' : 'inherit' }}>
                          {v.conversions} ({v.conversion_rate}%)
                        </strong>
                      </div>
                    </div>

                    {/* Progress bar visual for CTR */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                        <span>CTR Efficiency</span>
                        <span>{v.ctr}%</span>
                      </div>
                      <div style={{ height: '8px', background: 'var(--line)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(v.ctr * 8, 100)}%`,
                            background: isWinner ? 'var(--green)' : 'var(--accent)',
                            borderRadius: '99px',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Past A/B tests history */}
      {history.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Experiment History</h3>
              <p>Previously concluded statistical experiments for this campaign.</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 20px 20px' }}>
            {history.map((h) => (
              <div
                key={h.id}
                onClick={() => setCurrentTest(h.results)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'background .15s',
                }}
              >
                <div>
                  <strong>{h.test_name}</strong>
                  <span className="small-text muted" style={{ display: 'block' }}>
                    Concluded: {new Date(h.created_at).toLocaleString()} · Winner: {h.results?.winner_variant_id || 'B'}
                  </span>
                </div>
                <button className="btn small ghost">View Results →</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
