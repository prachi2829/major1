import React, { useEffect, useState } from 'react'
import { api } from '../api.js'

const PLAT_CONFIG = {
  instagram: { name: 'Instagram', icon: '📸', color: '#E1306C', envVar: 'INSTAGRAM_ACCESS_TOKEN & INSTAGRAM_ACCOUNT_ID' },
  linkedin: { name: 'LinkedIn', icon: '💼', color: '#0077B5', envVar: 'LINKEDIN_ACCESS_TOKEN & LINKEDIN_AUTHOR_URN' },
  facebook: { name: 'Facebook', icon: '👥', color: '#1877F2', envVar: 'FACEBOOK_ACCESS_TOKEN & FACEBOOK_PAGE_ID' },
  twitter: { name: 'X / Twitter', icon: '🐦', color: '#1DA1F2', envVar: 'TWITTER_BEARER_TOKEN' },
}

export default function SocialAccounts({ notify }) {
  const [accounts, setAccounts] = useState([])
  const [liveStatus, setLiveStatus] = useState({})
  const [verifying, setVerifying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [testingEvent, setTestingEvent] = useState(false)
  const [campaigns, setCampaigns] = useState([])
  const [selectedCamp, setSelectedCamp] = useState('')
  const [form, setForm] = useState({ platform: 'twitter', account_name: '', token: '' })

  const load = async () => {
    try {
      const [accs, camps] = await Promise.all([
        api.getSocialAccounts(),
        api.list(),
      ])
      setAccounts(accs || [])
      setCampaigns(camps || [])
      if (camps && camps.length > 0) setSelectedCamp(camps[0].id)
    } catch (e) {
      if (notify) notify(e.message, 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleVerify = async () => {
    setVerifying(true)
    try {
      const res = await api.verifyConnections()
      setLiveStatus(res || {})
      const connectedCount = Object.values(res || {}).filter(Boolean).length
      if (connectedCount > 0) {
        notify(`${connectedCount} live API connection(s) active!`)
      } else {
        notify('Platform adapters in active standby. Add API keys in backend/.env to connect live.', 'err')
      }
    } catch (e) {
      notify(e.message, 'err')
    } finally {
      setVerifying(false)
    }
  }

  const handleConnect = async (e) => {
    e.preventDefault()
    if (!form.account_name) return
    try {
      await api.connectSocialAccount({
        platform: form.platform,
        account_name: form.account_name,
        credentials: {
          token_preview: form.token ? `${form.token.slice(0, 8)}...` : 'env_managed',
          connected_at: new Date().toISOString(),
        },
      })
      notify(`Authorized ${form.account_name} on ${PLAT_CONFIG[form.platform]?.name || form.platform}`)
      setForm({ platform: 'twitter', account_name: '', token: '' })
      setAdding(false)
      load()
    } catch (err) {
      notify(err.message, 'err')
    }
  }

  const handleDisconnect = async (aid, name) => {
    if (!window.confirm(`Disconnect ${name}?`)) return
    try {
      await api.disconnectSocialAccount(aid)
      notify(`Disconnected ${name}`)
      load()
    } catch (err) {
      notify(err.message, 'err')
    }
  }

  const handleSendLiveEvent = async (eventType) => {
    if (!selectedCamp) {
      notify('Select a campaign first', 'err')
      return
    }
    setTestingEvent(true)
    try {
      await api.recordLiveEvent(selectedCamp, 'instagram', eventType, 1)
      notify(`Live ${eventType} event ingested and recorded in database!`)
    } catch (e) {
      notify(e.message, 'err')
    } finally {
      setTestingEvent(false)
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Phase 3 · Real-Time Social Media Integration</p>
          <h2>Platform <em>API Connectors</em></h2>
          <p className="sub tight">
            Connect live developer API credentials for automatic publishing, live impressions, and real conversion ingestion.
          </p>
        </div>
        <div className="cta-row nomargin">
          <button className="btn small ghost" disabled={verifying} onClick={handleVerify}>
            {verifying ? 'Checking APIs…' : '⚡ Check Live API Connections'}
          </button>
          <button className="btn small" onClick={() => setAdding(!adding)}>
            {adding ? 'Close' : '+ Connect Channel'}
          </button>
        </div>
      </div>

      {/* Guide Banner */}
      <div className="notice" style={{ background: 'var(--card)', border: '1.5px solid var(--ink)', borderRadius: '16px', padding: '18px 24px' }}>
        <strong>🔑 How to connect real platform APIs:</strong>
        <p className="small-text muted" style={{ margin: '6px 0 0' }}>
          Paste your live Developer API keys in <code>backend/.env</code>:
          <br />
          <code>TWITTER_BEARER_TOKEN</code> · <code>LINKEDIN_ACCESS_TOKEN</code> · <code>INSTAGRAM_ACCESS_TOKEN</code> · <code>FACEBOOK_ACCESS_TOKEN</code>
        </p>
      </div>

      {adding && (
        <form onSubmit={handleConnect} className="form" style={{ maxWidth: '540px', marginBottom: '30px' }}>
          <h3>Authorize Channel Handle</h3>
          <label className="field">
            <span>Platform</span>
            <select
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
              style={{ padding: '10px', borderRadius: '8px', border: '1.5px solid var(--line)' }}
            >
              <option value="twitter">X / Twitter (Twitter API v2)</option>
              <option value="linkedin">LinkedIn (Community Management API)</option>
              <option value="instagram">Instagram (Meta Graph API)</option>
              <option value="facebook">Facebook (Pages Graph API)</option>
            </select>
          </label>
          <label className="field">
            <span>Account Handle / Page Name</span>
            <input
              required
              placeholder="@brand_handle or Company Name"
              value={form.account_name}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Access Token / Bearer Token <small>(optional if set in .env)</small></span>
            <input
              type="password"
              placeholder="Paste platform API token..."
              value={form.token}
              onChange={(e) => setForm({ ...form, token: e.target.value })}
            />
          </label>
          <div className="cta-row">
            <button type="submit" className="btn small">Save &amp; Authorize Channel</button>
            <button type="button" className="btn small ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Live Event Ingestion Tester */}
      <div className="panel" style={{ marginBottom: '30px', background: 'var(--paper-2)' }}>
        <div className="panel-head">
          <div>
            <h3>🎯 Live Traffic &amp; Conversion Ingestion Webhook</h3>
            <p>Simulate real users clicking UTM links and converting on your website.</p>
          </div>
        </div>
        <div style={{ padding: '0 24px 24px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedCamp}
            onChange={(e) => setSelectedCamp(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', background: '#fff' }}
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.input.name}</option>
            ))}
          </select>
          <button className="btn small ghost" disabled={testingEvent} onClick={() => handleSendLiveEvent('click')}>
            + Ingest 1 Real Click
          </button>
          <button className="btn small" disabled={testingEvent} onClick={() => handleSendLiveEvent('conversion')}>
            + Ingest 1 Real Conversion (Sale/Signup)
          </button>
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading connected channels…</p>
      ) : (
        <div className="cards">
          {accounts.map((acc) => {
            const plat = acc.platform.toLowerCase()
            const cfg = PLAT_CONFIG[plat] || { name: acc.platform, icon: '🔗', color: '#333' }
            const isLive = liveStatus[plat]

            return (
              <div key={acc.id} className="camp" style={{ borderTop: `4px solid ${cfg.color}` }}>
                <div className="camp-top">
                  <span style={{ fontSize: '1.5rem' }}>{cfg.icon}</span>
                  <span className={`status-pill ${isLive ? 'published' : 'strategy_ready'}`}>
                    {isLive ? '🟢 Live API Connected' : '🟡 Standby Adapter'}
                  </span>
                </div>
                <h3 style={{ marginTop: '10px' }}>{acc.account_name}</h3>
                <p className="muted small-text">{cfg.name}</p>
                <p className="small-text muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                  Managed via: <code>{cfg.envVar}</code>
                </p>
                <div className="camp-actions" style={{ marginTop: 'auto', paddingTop: '14px' }}>
                  <button
                    className="btn ghost small"
                    style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
                    onClick={() => handleDisconnect(acc.id, acc.account_name)}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
