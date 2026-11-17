import React, { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'

const PLAT_LABEL = { instagram: 'Instagram', linkedin: 'LinkedIn', twitter: 'X / Twitter', facebook: 'Facebook' }

export default function BudgetOptimizer({ notify }) {
  const { id: paramId } = useParams()
  const [campaigns, setCampaigns] = useState([])
  const [selectedId, setSelectedId] = useState(paramId || '')
  const [totalBudget, setTotalBudget] = useState(100000)
  const [budgetPlan, setBudgetPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [committed, setCommitted] = useState(false)
  const [error, setError] = useState('')

  const loadCampaigns = useCallback(async () => {
    try {
      const cList = await api.list()
      setCampaigns(cList || [])
      const initialId = selectedId || (cList && cList[0]?.id)
      if (initialId) {
        setSelectedId(initialId)
        fetchBudget(initialId, totalBudget)
      }
    } catch (e) {
      setError(e.message)
    }
  }, [selectedId])

  const fetchBudget = async (cid, total) => {
    setLoading(true)
    setCommitted(false)
    try {
      const res = await api.budget(cid, total)
      setBudgetPlan(res)
    } catch (e) {
      notify(e.message, 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCampaigns()
  }, [loadCampaigns])

  const handleSelectCampaign = (cid) => {
    setSelectedId(cid)
    fetchBudget(cid, totalBudget)
  }

  const handleRecalculate = (e) => {
    e?.preventDefault()
    if (selectedId) {
      notify('Budget Optimization Agent calculating dynamic allocations…')
      fetchBudget(selectedId, totalBudget)
    }
  }

  const handleCommit = () => {
    setCommitted(true)
    notify(`Capital reallocation of ₹${totalBudget.toLocaleString()} approved and committed!`)
  }

  const selectedCampaign = campaigns.find((c) => c.id === selectedId)

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Budget Optimization Engine</p>
          <h2>Dynamic <em>Capital Allocation</em></h2>
          <p className="sub tight">Algorithmic capital reallocation based on multi-channel conversion efficiency, marginal CPA, and projected return on ad spend (ROAS).</p>
        </div>
        <div className="cta-row nomargin">
          <Link to="/agents" className="btn small ghost">⚡ Multi-Agent Hub</Link>
          <Link to="/ab-testing" className="btn small ghost">🧪 A/B Testing</Link>
          <Link to="/campaigns" className="btn small ghost">Campaigns</Link>
        </div>
      </div>

      {error && <div className="notice err">{error}</div>}

      {/* Control panel */}
      <div className="panel" style={{ background: 'var(--paper-2)', marginBottom: '24px' }}>
        <form onSubmit={handleRecalculate} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="field" style={{ flex: '1 1 240px', margin: 0 }}>
            <span>Active Campaign</span>
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

          <label className="field" style={{ flex: '1 1 200px', margin: 0 }}>
            <span>Total Campaign Budget (₹)</span>
            <input
              type="number"
              step="5000"
              min="1000"
              value={totalBudget}
              onChange={(e) => setTotalBudget(Number(e.target.value))}
              style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff' }}
            />
          </label>

          <button type="submit" className="btn" disabled={loading || !selectedId}>
            {loading ? 'Optimizing…' : '⚡ Reallocate Capital'}
          </button>
        </form>
      </div>

      {/* Executive Summary */}
      {budgetPlan && (
        <div className="panel" style={{ background: 'var(--amber-bg)', borderColor: '#d9a21f', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className="pill" style={{ background: '#fff', fontWeight: 600 }}>
                  Algorithmic Allocation Summary
                </span>
                <span className="small-text muted">
                  Method: Pure Conversion Efficiency (No synthetic multipliers)
                </span>
              </div>
              <h3 style={{ marginTop: '6px' }}>{budgetPlan.executive_summary}</h3>
              <p className="small-text" style={{ margin: '6px 0 0', color: 'var(--ink)' }}>
                Total Portfolio Value: <b>₹{Number(budgetPlan.total_budget || totalBudget).toLocaleString()}</b> · 
                <span style={{ fontStyle: 'italic', color: 'var(--ink-2)', marginLeft: '6px' }}>
                  {budgetPlan.disclaimer || "'Approve' records the plan only, and no money moves."}
                </span>
              </p>
            </div>
            <button
              className="btn"
              disabled={committed}
              onClick={handleCommit}
              style={{ background: committed ? 'var(--green)' : 'var(--ink)', borderColor: committed ? 'var(--green)' : 'var(--ink)' }}
            >
              {committed ? '✓ Plan Recorded (No Money Moved)' : 'Approve & Record Plan'}
            </button>
          </div>
        </div>
      )}

      {/* Allocation breakdown */}
      {budgetPlan && budgetPlan.allocations && (
        <div className="panel" style={{ marginBottom: '32px' }}>
          <div className="panel-head">
            <div>
              <h3>Channel Reallocation Matrix</h3>
              <p>Numbers derived strictly from your campaign analytics (CVR &amp; CTR) — no synthetic ROI multipliers.</p>
            </div>
          </div>

          <div style={{ overflowX: 'auto', padding: '0 20px 20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 14px' }}>Platform</th>
                  <th style={{ padding: '12px 14px' }}>Baseline Share</th>
                  <th style={{ padding: '12px 14px' }}>Algorithmic Recommendation</th>
                  <th style={{ padding: '12px 14px' }}>Net Shift</th>
                  <th style={{ padding: '12px 14px' }}>Measured CVR / CTR</th>
                  <th style={{ padding: '12px 14px' }}>Algorithmic Rationale</th>
                </tr>
              </thead>
              <tbody>
                {budgetPlan.allocations.map((a, idx) => {
                  const pName = a.platform.toLowerCase()
                  const current = Number(a.current_allocation || 0)
                  const rec = Number(a.recommended_allocation || 0)
                  const diff = rec - current
                  const total = Number(budgetPlan.total_budget || totalBudget)
                  const recPct = total > 0 ? Math.round((rec / total) * 100) : 0

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                        {PLAT_LABEL[pName] || a.platform}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--ink-2)' }}>
                        ₹{current.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--ink)' }}>
                        ₹{rec.toLocaleString()} <small className="muted">({recPct}%)</small>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            background: diff > 0 ? 'var(--green-bg)' : diff < 0 ? 'var(--red-bg)' : 'var(--paper-2)',
                            color: diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--accent)' : 'var(--ink-2)',
                          }}
                        >
                          {diff > 0 ? `+₹${diff.toLocaleString()}` : diff < 0 ? `-₹${Math.abs(diff).toLocaleString()}` : 'No change'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--ink)' }}>
                        {a.conversion_rate !== undefined ? `${a.conversion_rate}% CVR · ${a.ctr}% CTR` : 'Measured from Data'}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--ink-2)', fontSize: '0.86rem' }}>
                        {a.rationale}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Visual Bar Comparison */}
      {budgetPlan && budgetPlan.allocations && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Portfolio Capital Distribution</h3>
              <p>Visual comparison of recommended capital split across active channels.</p>
            </div>
          </div>
          <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {budgetPlan.allocations.map((a, i) => {
              const pName = a.platform.toLowerCase()
              const rec = Number(a.recommended_allocation || 0)
              const total = Number(budgetPlan.total_budget || totalBudget)
              const pct = total > 0 ? Math.round((rec / total) * 100) : 0

              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '6px' }}>
                    <strong>{PLAT_LABEL[pName] || a.platform}</strong>
                    <span>₹{rec.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div style={{ height: '10px', background: 'var(--paper-2)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: pct > 35 ? 'var(--green)' : pct > 20 ? 'var(--ink)' : 'var(--accent)',
                        borderRadius: '99px',
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
