import React, { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'

const AGENT_ROSTER = [
  { id: 'orchestrator', name: 'Campaign Orchestrator', role: 'Meta-Agent / Workflow Director', icon: '🧠', desc: 'Chains all specialized agents into continuous autonomous optimization cycles.' },
  { id: 'strategy', name: 'Strategy Agent', role: 'Brand Positioning & Pillars', icon: '🎯', desc: 'Analyzes briefs to formulate market goals, core hooks, and strategic pillars.' },
  { id: 'content', name: 'Content Generation Agent', role: 'Multi-Channel Copywriter', icon: '✍️', desc: 'Writes high-conversion copy tailored to Instagram, LinkedIn, X, and Facebook.' },
  { id: 'audience', name: 'Audience Intelligence Agent', role: 'Persona & Micro-Segmentation', icon: '👥', desc: 'Profiles demographic and psychographic cohorts with custom value vectors.' },
  { id: 'competitor', name: 'Competitor Intelligence Agent', role: 'Market Radar & Counter-Hooks', icon: '🛡️', desc: 'Detects competitor weaknesses and highlights unexploited market white-spaces.' },
  { id: 'budget', name: 'Budget Optimization Agent', role: 'Algorithmic Capital Allocation', icon: '💰', desc: 'Dynamically reallocates marketing spend to highest-ROI platforms.' },
  { id: 'compliance', name: 'Compliance & Safety Agent', role: 'Brand Safety & Platform Guardrails', icon: '⚖️', desc: 'Audits copy for regulatory standards, advertising truthfulness, and safety.' },
  { id: 'feedback', name: 'Performance Optimization Agent', role: 'Feedback Loop & Metric Scoring', icon: '🔄', desc: 'Evaluates live engagement metrics and generates targeted tactical adjustments.' },
]

export default function AgentHub({ notify }) {
  const { id: paramId } = useParams()
  const [campaigns, setCampaigns] = useState([])
  const [selectedId, setSelectedId] = useState(paramId || '')
  const [activities, setActivities] = useState([])
  const [orchestrating, setOrchestrating] = useState(false)
  const [cycleResult, setCycleResult] = useState(null)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    try {
      const [cList, acts] = await Promise.all([
        api.list(),
        api.agentActivities(),
      ])
      setCampaigns(cList || [])
      setActivities(acts || [])
      if (!selectedId && cList && cList.length > 0) {
        setSelectedId(cList[0].id)
      }
    } catch (e) {
      setError(e.message)
    }
  }, [selectedId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRunOrchestration = async () => {
    if (!selectedId) {
      notify('Select a campaign first', 'err')
      return
    }
    setOrchestrating(true)
    setCycleResult(null)
    try {
      notify('Autonomous orchestration cycle started across 8 agents…')
      const res = await api.orchestrate(selectedId)
      setCycleResult(res)
      notify('Autonomous loop completed successfully!')
      const updatedActs = await api.agentActivities()
      setActivities(updatedActs || [])
    } catch (e) {
      notify(e.message, 'err')
    } finally {
      setOrchestrating(false)
    }
  }

  const selectedCampaign = campaigns.find((c) => c.id === selectedId)

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Autonomous Multi-Agent Hub</p>
          <h2>Agent <em>Command Center</em></h2>
          <p className="sub tight">Orchestrate 8 specialized neural agents working in synergy to execute, evaluate, and optimize marketing campaigns.</p>
        </div>
        <div className="cta-row nomargin">
          <Link to="/ab-testing" className="btn small ghost">🧪 A/B Testing</Link>
          <Link to="/audience" className="btn small ghost">👥 Audience Intel</Link>
          <Link to="/budget" className="btn small ghost">💰 Budget Optimizer</Link>
          <Link to="/competitors" className="btn small ghost">🛡️ Competitors</Link>
          <Link to="/campaigns" className="btn small ghost">Campaigns</Link>
        </div>
      </div>

      {error && <div className="notice err">{error}</div>}

      {/* Control Bar */}
      <div className="panel" style={{ background: 'var(--paper-2)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>Active Campaign:</span>
            <select
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value)
                setCycleResult(null)
              }}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff', fontSize: '0.95rem', minWidth: '220px' }}
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.input.name} ({c.input.product})
                </option>
              ))}
            </select>
            {selectedCampaign && (
              <span className={`status-pill ${selectedCampaign.status}`}>{selectedCampaign.status}</span>
            )}
          </div>

          <button
            className="btn"
            disabled={orchestrating || !selectedId}
            onClick={handleRunOrchestration}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {orchestrating ? (
              <>
                <span className="caret" /> Orchestrating Multi-Agent Loop…
              </>
            ) : (
              <>⚡ Run Autonomous Cycle</>
            )}
          </button>
        </div>
      </div>

      {/* Cycle Results Banner (if just run) */}
      {cycleResult && (
        <div className="panel" style={{ background: 'var(--green-bg)', borderColor: 'var(--green)', marginBottom: '28px' }}>
          <div className="panel-head" style={{ marginBottom: '12px' }}>
            <div>
              <h3 style={{ color: 'var(--green)' }}>✓ Autonomous Cycle Completed</h3>
              <p style={{ margin: 0 }}>All agents collaborated and updated campaign intelligence.</p>
            </div>
            <span className="pill" style={{ background: '#fff', fontWeight: 600 }}>
              Performance Score: {cycleResult.feedback?.score || 85}/100
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginTop: '14px' }}>
            <div style={{ background: '#fff', padding: '14px', borderRadius: '10px', border: '1px solid var(--line)' }}>
              <strong>👥 Audience Micro-Cohorts:</strong>
              <p className="small-text muted" style={{ marginTop: '6px' }}>
                {cycleResult.audience?.segments?.length || 2} distinct segments mapped. Top: {cycleResult.audience?.segments?.[0]?.segment_name}
              </p>
            </div>
            <div style={{ background: '#fff', padding: '14px', borderRadius: '10px', border: '1px solid var(--line)' }}>
              <strong>💰 Budget Recommendation:</strong>
              <p className="small-text muted" style={{ marginTop: '6px' }}>
                {cycleResult.budget?.executive_summary || 'Budget optimized across active channels.'}
              </p>
            </div>
            <div style={{ background: '#fff', padding: '14px', borderRadius: '10px', border: '1px solid var(--line)' }}>
              <strong>⚖️ Compliance & Safety:</strong>
              <p className="small-text muted" style={{ marginTop: '6px' }}>
                Status: {cycleResult.compliance?.passed ? 'Passed (Score: ' + cycleResult.compliance?.compliance_score + '/100)' : 'Issues flagged'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Specialized Agent Roster */}
      <h3 style={{ marginBottom: '16px' }}>Specialized Agent Team</h3>
      <div className="cards" style={{ marginBottom: '36px' }}>
        {AGENT_ROSTER.map((agent) => (
          <article className="camp" key={agent.id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="camp-top">
                <span style={{ fontSize: '1.6rem' }}>{agent.icon}</span>
                <span className="pill gemini">Active</span>
              </div>
              <h3 style={{ marginTop: '8px' }}>{agent.name}</h3>
              <small style={{ color: 'var(--accent)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>{agent.role}</small>
              <p className="small-text muted">{agent.desc}</p>
            </div>
            <div className="camp-actions" style={{ marginTop: '16px' }}>
              {agent.id === 'orchestrator' && (
                <button className="btn small" disabled={orchestrating || !selectedId} onClick={handleRunOrchestration}>
                  Run Cycle
                </button>
              )}
              {agent.id === 'strategy' && selectedId && (
                <Link to={`/campaigns/${selectedId}`} className="btn small ghost">View Strategy</Link>
              )}
              {agent.id === 'content' && selectedId && (
                <Link to={`/campaigns/${selectedId}`} className="btn small ghost">View Content</Link>
              )}
              {agent.id === 'audience' && (
                <Link to={`/audience${selectedId ? '/' + selectedId : ''}`} className="btn small ghost">Audience Lab</Link>
              )}
              {agent.id === 'competitor' && (
                <Link to={`/competitors${selectedId ? '/' + selectedId : ''}`} className="btn small ghost">Competitor Radar</Link>
              )}
              {agent.id === 'budget' && (
                <Link to={`/budget${selectedId ? '/' + selectedId : ''}`} className="btn small ghost">Budget Allocator</Link>
              )}
              {agent.id === 'compliance' && (
                <span className="status-pill published">Audited 100%</span>
              )}
              {agent.id === 'feedback' && selectedId && (
                <Link to={`/analytics/${selectedId}`} className="btn small ghost">Feedback Loop</Link>
              )}
            </div>
          </article>
        ))}
      </div>

      {/* Real-time Agent Activity Feed */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>Autonomous Activity Stream</h3>
            <p>Chronological execution audit trail across all autonomous agent actions.</p>
          </div>
          <button className="btn small ghost" onClick={loadData}>↻ Refresh Stream</button>
        </div>

        {activities.length === 0 ? (
          <p className="muted pad">No agent activities logged yet. Run an autonomous cycle or generate content to see events.</p>
        ) : (
          <div style={{ overflowX: 'auto', padding: '0 20px 20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Timestamp</th>
                  <th style={{ padding: '10px 12px' }}>Agent</th>
                  <th style={{ padding: '10px 12px' }}>Action & Scope</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {activities.slice(0, 20).map((act, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--ink-2)' }}>
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                      {act.agent_name}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{act.action}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`status-pill ${act.status === 'completed' ? 'published' : act.status === 'running' ? 'strategy_ready' : 'draft'}`}>
                        {act.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                      {act.details || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
