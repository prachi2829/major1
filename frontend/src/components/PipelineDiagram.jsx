import React, { useState } from 'react'

const BLOCKS = [
  {
    key: 'input', n: '01', title: 'Campaign input', who: 'React form → POST /campaigns',
    what: 'The user states product, objective, audience, tone and platforms once. FastAPI validates it against a schema before anything reaches an agent.',
    io: ['In: campaign form', 'Out: validated CampaignCreate'], file: 'backend/app/schemas.py',
  },
  {
    key: 'strategy', n: '02', title: 'Strategy Agent', who: 'The marketing planner',
    what: 'Turns requirements into a plan: goal, core message, content pillars, messaging approach and call to action. It never writes the final posts.',
    io: ['In: CampaignCreate', 'Out: Strategy'], file: 'backend/app/agents.py → StrategyAgent',
  },
  {
    key: 'content', n: '03', title: 'Content Agent', who: 'The copywriter',
    what: 'Takes the campaign and the strategy and writes one post per platform. Instagram is casual with hashtags; LinkedIn is value-focused and professional.',
    io: ['In: CampaignCreate + Strategy', 'Out: PlatformContent per platform'], file: 'backend/app/agents.py → ContentAgent',
  },
  {
    key: 'review', n: '04', title: 'Review & edit', who: 'Human in the loop',
    what: 'Previews look like the real platform. The marketer edits any word and the preview updates instantly. Edits reset approval.',
    io: ['In: generated content', 'Out: approved content'], file: 'frontend/src/pages/Workspace.jsx',
  },
  {
    key: 'publish', n: '05', title: 'Publish', who: 'Approval-gated workflow',
    what: 'Only approved content can be published, and published content is locked. This is a simulated publish; real platform APIs are a Phase 2 extension.',
    io: ['In: approved content', 'Out: published status + timestamp'], file: 'backend/app/main.py → /publish',
  },
]

export default function PipelineDiagram({ compact = false }) {
  const [active, setActive] = useState('strategy')
  const cur = BLOCKS.find((b) => b.key === active)

  return (
    <div className="pipeline">
      <div className="track" aria-hidden="true">
        <span className="dot d1" /><span className="dot d2" /><span className="dot d3" />
      </div>
      <div className="blocks">
        {BLOCKS.map((b) => (
          <button key={b.key} className={`block ${active === b.key ? 'on' : ''}`} onClick={() => setActive(b.key)}>
            <small>{b.n}</small>
            <strong>{b.title}</strong>
            <span>{b.who}</span>
          </button>
        ))}
      </div>

      {!compact && (
        <div className="detail">
          <div>
            <h3>{cur.title}</h3>
            <p>{cur.what}</p>
            <ul className="io">{cur.io.map((i) => <li key={i}>{i}</li>)}</ul>
          </div>
          <div className="file"><span>Implemented in</span><code>{cur.file}</code></div>
        </div>
      )}

    </div>
  )
}
