import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api.js'

const PLATFORMS = [
  { id: 'instagram', name: 'Instagram', icon: '📸', detail: 'Professional account linked to a Facebook Page' },
  { id: 'facebook', name: 'Facebook Pages', icon: '👥', detail: 'Publish to Pages you manage' },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼', detail: 'Publish text posts to your member profile' },
  { id: 'twitter', name: 'X / Twitter', icon: '𝕏', detail: 'Publish posts using OAuth 2.0 user authorization' },
]

export default function SocialAccounts({ notify }) {
  const [accounts, setAccounts] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState('')
  const location = useLocation()

  const load = async () => {
    try {
      const [connected, settings] = await Promise.all([api.getSocialAccounts(), api.oauthConfig()])
      setAccounts(connected || [])
      setConfig(settings)
    } catch (e) {
      notify(e.message, 'err')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const params = new URLSearchParams(location.search)
    const connected = params.get('connected')
    const error = params.get('oauth_error')
    if (connected) notify(`${connected} OAuth connection completed. Select it when publishing.`)
    if (error) notify(error, 'err')
    if (connected || error) window.history.replaceState({}, '', '/social')
  }, [location.search])

  const connect = (platform) => {
    if (!config?.configured?.encryption) {
      notify('Backend token encryption is not configured. Set SOCIAL_TOKEN_ENCRYPTION_KEY first.', 'err')
      return
    }
    const provider = platform === 'instagram' || platform === 'facebook' ? 'meta' : platform
    if (!config?.configured?.[provider]) {
      notify(`Add the ${provider.toUpperCase()} OAuth client ID and secret to backend/.env, then restart the backend.`, 'err')
      return
    }
    window.location.assign(`/oauth/${platform}/start`.startsWith('/oauth/') ? (import.meta.env.VITE_API_URL || 'http://localhost:8000') + `/oauth/${platform}/start` : `/oauth/${platform}/start`)
  }

  const disconnect = async (account) => {
    if (!window.confirm(`Disconnect ${account.account_name}?`)) return
    setDisconnecting(account.id)
    try {
      await api.disconnectSocialAccount(account.id)
      notify(`${account.account_name} disconnected`)
      await load()
    } catch (e) { notify(e.message, 'err') } finally { setDisconnecting('') }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">OAuth 2.0 · Live Publishing</p>
          <h2>Connect your <em>social accounts</em></h2>
          <p className="sub tight">Authorize Campaign.AI through each platform. Your access tokens are encrypted and stored on the backend; they are never sent to the browser.</p>
        </div>
        <button className="btn small ghost" onClick={load}>↻ Refresh</button>
      </div>

      <div className="notice" style={{ background: 'var(--card)', border: '1.5px solid var(--ink)', borderRadius: '16px', padding: '18px 24px', marginBottom: 24 }}>
        <strong>Before connecting</strong>
        <p className="small-text muted">Create developer apps and add the exact callback URLs shown below. Meta uses one app for Facebook and Instagram. Provider review/permissions may be required before accounts outside your developer/test roles can authorize.</p>
        {config && <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {Object.entries(config.redirect_uris || {}).map(([provider, uri]) => (
            <div key={provider} className="small-text"><b>{provider.toUpperCase()} callback:</b> <code>{uri}</code></div>
          ))}
          <div className="small-text"><b>Token encryption:</b> {config.configured.encryption ? 'Configured ✓' : 'Missing — set SOCIAL_TOKEN_ENCRYPTION_KEY'}</div>
        </div>}
      </div>

      <div className="cards">
        {PLATFORMS.map((platform) => {
          const linked = accounts.filter((a) => a.platform === platform.id)
          const provider = platform.id === 'instagram' || platform.id === 'facebook' ? 'meta' : platform.id
          const ready = config?.configured?.[provider] && config?.configured?.encryption
          return (
            <div className="camp" key={platform.id} style={{ borderTop: '4px solid var(--ink)' }}>
              <div className="camp-top">
                <span style={{ fontSize: '1.6rem' }}>{platform.icon}</span>
                <span className={`status-pill ${linked.length ? 'published' : 'strategy_ready'}`}>{linked.length ? `${linked.length} connected` : 'Not connected'}</span>
              </div>
              <h3 style={{ marginTop: 12 }}>{platform.name}</h3>
              <p className="muted small-text">{platform.detail}</p>
              <button className="btn small" disabled={!ready} onClick={() => connect(platform.id)} style={{ marginTop: 14 }}>
                {ready ? `Connect ${platform.name}` : 'Configure backend first'}
              </button>
              {!ready && <p className="muted small-text" style={{ marginTop: 8 }}>Set the {provider.toUpperCase()} app credentials and encryption key in backend/.env.</p>}
              {linked.map((account) => (
                <div key={account.id} style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 12 }}>
                  <b>{account.account_name}</b>
                  <p className="muted small-text">Connected {new Date(account.connected_at).toLocaleString()}</p>
                  <button className="btn ghost small" disabled={disconnecting === account.id} onClick={() => disconnect(account)}>
                    {disconnecting === account.id ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </div>
              ))}
            </div>
          )
        })}
      </div>
      <p className="muted small-text" style={{ marginTop: 24 }}>Instagram publishing currently supports image posts using a publicly accessible HTTPS image URL. Facebook Pages, LinkedIn member posts and X text posts are supported. Platform API access is subject to each provider’s app review, account type, scopes and rate limits.</p>
    </section>
  )
}
