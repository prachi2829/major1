const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function req(path, options = {}) {
  let res
  try {
    res = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new Error('Cannot reach the backend. Is it running on ' + BASE + '?')
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    let msg = data.detail
    if (Array.isArray(msg)) msg = msg.map((e) => e.msg.replace('Value error, ', '')).join('; ')
    throw new Error(msg || `Request failed (${res.status})`)
  }
  return data
}

const post = (p, body) => req(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined })

export const api = {
  health: () => req('/health'),
  list: () => req('/campaigns'),
  get: (id) => req(`/campaigns/${id}`),
  create: (payload) => post('/campaigns', payload),
  remove: (id) => req(`/campaigns/${id}`, { method: 'DELETE' }),
  strategy: (id) => post(`/campaigns/${id}/strategy`),
  content: (id) => post(`/campaigns/${id}/content`),
  regenerate: (id, p) => post(`/campaigns/${id}/content/${p}/regenerate`),
  edit: (id, p, patch) => req(`/campaigns/${id}/content/${p}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  approve: (id, p) => post(`/campaigns/${id}/content/${p}/approve`),
  analytics: (id) => req(`/campaigns/${id}/analytics`),
  simulateAnalytics: (id) => post(`/campaigns/${id}/analytics/simulate`),
  overview: () => req('/analytics/overview'),
  publish: (id, platforms) => post(`/campaigns/${id}/publish`, platforms ? { platforms } : {}),

  // Phase 2 Remaining: Scheduling, AI Feedback & Social Integrations
  schedulePost: (id, payload) => post(`/campaigns/${id}/schedule`, payload),
  getCampaignSchedules: (id) => req(`/campaigns/${id}/schedule`),
  listAllSchedules: () => req('/schedule'),
  cancelSchedule: (sid) => req(`/schedule/${sid}`, { method: 'DELETE' }),
  getFeedback: (id) => post(`/campaigns/${id}/feedback`),
  getFeedbackHistory: (id) => req(`/campaigns/${id}/feedback`),
  getSocialAccounts: () => req('/social-accounts'),
  connectSocialAccount: (data) => post('/social-accounts', data),
  disconnectSocialAccount: (aid) => req(`/social-accounts/${aid}`, { method: 'DELETE' }),
  verifyConnections: () => req('/publishing/verify'),
  recordLiveEvent: (campaign_id, platform, event_type, count = 1) => post('/analytics/events', { campaign_id, platform, event_type, count }),

  // Phase 3 Intelligence
  audience: (id, refresh = false) => req(`/campaigns/${id}/audience${refresh ? '?refresh=true' : ''}`),
  reprofileAudience: (id) => post(`/campaigns/${id}/audience?refresh=true`),
  competitors: (id) => post(`/campaigns/${id}/competitors`),
  budget: (id, total = 100000) => post(`/campaigns/${id}/budget?total_budget=${total}`),
  compliance: (id) => post(`/campaigns/${id}/compliance`),
  abTest: (id, name = 'Emotional vs Discount') => post(`/campaigns/${id}/ab-test?test_name=${encodeURIComponent(name)}`),
  listAbTests: (id) => req(`/campaigns/${id}/ab-tests`),
  orchestrate: (id) => post(`/campaigns/${id}/orchestrate`),
  agentActivities: () => req('/agents/activity'),
}
