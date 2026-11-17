import React from 'react'

const tagLine = (tags) => (tags || []).join(' ')

function Avatar({ name }) {
  return <div className="avatar">{(name || 'C').slice(0, 1).toUpperCase()}</div>
}

export function InstagramPreview({ c, brand }) {
  return (
    <div className="phone ig">
      <div className="ph-head"><Avatar name={brand} /><b>{brand.toLowerCase().replace(/\s+/g, '')}</b><span>•••</span></div>
      <div className="ig-img"><span>{c.headline || brand}</span></div>
      <div className="ig-actions">♡ ◌ ➤<span>⚑</span></div>
      <p className="cap"><b>{brand.toLowerCase().replace(/\s+/g, '')}</b> {c.body}</p>
      {c.call_to_action && <p className="cta-line">{c.call_to_action}</p>}
      <p className="tags">{tagLine(c.hashtags)}</p>
    </div>
  )
}

export function LinkedInPreview({ c, brand }) {
  return (
    <div className="post li">
      <div className="ph-head"><Avatar name={brand} /><div><b>{brand}</b><small>Promoted · 1h</small></div></div>
      {c.headline && <h5>{c.headline}</h5>}
      <p className="li-body">{c.body}</p>
      {c.call_to_action && <p className="cta-line">{c.call_to_action}</p>}
      <p className="tags">{tagLine(c.hashtags)}</p>
      <div className="li-actions"><span>Like</span><span>Comment</span><span>Repost</span><span>Send</span></div>
    </div>
  )
}

export function TwitterPreview({ c, brand }) {
  const text = `${c.body} ${tagLine(c.hashtags)}`.trim()
  return (
    <div className="post tw">
      <div className="ph-head"><Avatar name={brand} /><div><b>{brand}</b><small>@{brand.toLowerCase().replace(/\s+/g, '')}</small></div></div>
      <p className="li-body">{text}</p>
      <small className={text.length > 280 ? 'over' : 'muted'}>{text.length}/280</small>
    </div>
  )
}

export function FacebookPreview({ c, brand }) {
  return (
    <div className="post fb">
      <div className="ph-head"><Avatar name={brand} /><div><b>{brand}</b><small>Sponsored</small></div></div>
      {c.headline && <h5>{c.headline}</h5>}
      <p className="li-body">{c.body}</p>
      {c.call_to_action && <p className="cta-line">{c.call_to_action}</p>}
      <p className="tags">{tagLine(c.hashtags)}</p>
      <div className="li-actions"><span>👍 Like</span><span>💬 Comment</span><span>↪ Share</span></div>
    </div>
  )
}

const MAP = { instagram: InstagramPreview, linkedin: LinkedInPreview, twitter: TwitterPreview, facebook: FacebookPreview }

export default function Preview({ platform, content, brand }) {
  const C = MAP[platform]
  return C ? <C c={content} brand={brand} /> : null
}
