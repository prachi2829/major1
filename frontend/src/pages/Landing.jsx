import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PipelineDiagram from '../components/PipelineDiagram.jsx'

const SAMPLE = {
  instagram: {
    label: 'Instagram',
    text: "Ready to level up? Life as a college student is busy, and FitLife makes fitness easier. Quick workouts, zero excuses. Let's go!",
    tags: '#FitLife #StudentFitness #NewLaunch',
  },
  linkedin: {
    label: 'LinkedIn',
    text: 'Many college students struggle to find fitness solutions that fit their routine.\n\nFitLife addresses this with simple, convenient workouts built around everyday schedules.\n\nTry FitLife today.',
    tags: '#FitLife #Innovation',
  },
}

const STEPS = [
  ['Describe', 'Enter product, objective, audience, tone and platforms once. The backend validates it and keeps it as shared context for every agent.'],
  ['Plan', 'The Strategy Agent derives the core message, content pillars, messaging approach and call to action. No posts yet, only direction.'],
  ['Write', 'The Content Agent reads the strategy and writes a different post for each platform: casual for Instagram, professional for LinkedIn.'],
  ['Review', 'Preview each post as it would appear, edit any word live, approve it, then publish. The marketer keeps the final say.'],
]

const STATUS = [
  ['Campaign creation, validation and processing', 'Done'],
  ['Strategy Agent and Content Generation Agent', 'Done'],
  ['Platform-specific previews and live editing', 'Done'],
  ['Approve → publish workflow & real-time scheduling background worker', 'Done'],
  ['Real-time Gemini generation with structured JSON contracts', 'Done'],
  ['Persistent SQLite store with real-time live event ingestion', 'Done'],
  ['Multi-platform social integrations (X, LinkedIn, Instagram, Facebook)', 'Done'],
  ['AI Performance Optimization feedback loop & recommendations', 'Done'],
  ['Phase 3 Autonomous Marketing Intelligence (8 Specialized Agents)', 'Done'],
  ['A/B Testing Lab, Audience Micro-Cohorts & Dynamic Budget Reallocation', 'Done'],
]

const STACK = [
  ['Frontend', 'React + Vite', 'Forms, dashboard, strategy view, previews, agent hub, A/B lab, scheduler'],
  ['Backend', 'Python + FastAPI', 'REST endpoints, background scheduler worker, multi-agent orchestration'],
  ['AI Engine', 'Google Gemini (REST)', '8 specialized agents: Orchestrator, Strategy, Content, Audience, Competitor, Budget, Compliance, Feedback'],
  ['Storage', 'SQLite', 'Persistent database with ACID safety, event logging, and scheduling queues'],
]

export default function Landing() {
  const [tab, setTab] = useState('instagram')
  const [shown, setShown] = useState(0)
  const s = SAMPLE[tab]

  useEffect(() => {
    setShown(0)
    const t = setInterval(() => setShown((n) => (n >= s.text.length ? n : n + 2)), 22)
    return () => clearInterval(t)
  }, [tab, s.text.length])

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Phase 3 · Autonomous Marketing Intelligence</p>
          <h1>One brief in. A whole campaign out, <em>agent by agent</em>.</h1>
          <p className="lede">
            Campaign.AI orchestrates an 8-agent neural marketing agency. From brand positioning and multi-platform content to automated scheduling, A/B testing, and algorithmic budget shifting — all in continuous feedback.
          </p>
          <div className="cta-row">
            <Link to="/new" className="btn">Create a campaign</Link>
            <Link to="/agents" className="btn ghost">⚡ Agent Command Center</Link>
            <Link to="/campaigns" className="btn ghost">Campaigns</Link>
            <Link to="/ab-testing" className="btn ghost">🧪 A/B Testing</Link>
            <Link to="/scheduler" className="btn ghost">📅 Scheduler</Link>
          </div>
          <dl className="facts">
            <div><dt>8</dt><dd>specialised agents</dd></div>
            <div><dt>4</dt><dd>platforms supported</dd></div>
            <div><dt>24/7</dt><dd>autonomous cycles</dd></div>
          </dl>
        </div>

        <div className="hero-card" aria-label="Example output">
          <div className="hc-top">
            <span className="tag">Simulated preview · FitLife Launch</span>
            <div className="seg">
              {Object.entries(SAMPLE).map(([k, v]) => (
                <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{v.label}</button>
              ))}
            </div>
          </div>
          <div className="hc-strategy">
            <span>Strategy</span>
            <p>Staying fit doesn't have to be hard, even with a busy college schedule.</p>
          </div>
          <div className="hc-post">
            <p>{s.text.slice(0, shown)}<span className="caret" /></p>
            <small>{shown >= s.text.length ? s.tags : ''}</small>
          </div>
          <p className="hc-note">Same product, same strategy, different voice per platform.</p>
        </div>
      </section>

      <section className="section" id="how">
        <p className="eyebrow">How it works</p>
        <h2>From a form to a <em>reviewed campaign</em></h2>
        <p className="sub">Four steps, one pipeline. The output of each stage becomes the input of the next.</p>
        <ol className="steps">
          {STEPS.map(([t, d], i) => (
            <li key={t}><span className="num">{i + 1}</span><h3>{t}</h3><p>{d}</p></li>
          ))}
        </ol>
      </section>

      <section className="section alt" id="agents">
        <p className="eyebrow">The agents</p>
        <h2>Inside the <em>orchestrated pipeline</em></h2>
        <p className="sub">
          The agents are software components sharing one Gemini model, each with its own prompt, responsibility and
          input/output contract. Select any block to see what it does and where it lives. The dots are data moving through.
        </p>
        <PipelineDiagram />
      </section>

      <section className="section" id="why">
        <p className="eyebrow">Why separate agents</p>
        <h2>Planning and writing are <em>different jobs</em></h2>
        <div className="cols">
          <div className="card"><h3>One LLM call</h3><p>Strategy and wording blur together, platform voices come out samey, and there's nothing to inspect or fix between steps.</p></div>
          <div className="card hl"><h3>Campaign.AI pipeline</h3><p>A strategy is produced first, then reused for every platform. Each stage has a typed contract, so it's easy to test, swap or extend.</p></div>
          <div className="card"><h3>Human in the loop</h3><p>AI can be repetitive or off-brand. Previews, live editing and an approval gate leave the final decision with the marketer.</p></div>
        </div>
      </section>

      <section className="section alt" id="status">
        <p className="eyebrow">Where the project stands</p>
        <h2>Phases 1 and 2 are <em>built and tested</em></h2>
        <p className="sub">The backend has an automated test suite covering validation, the full pipeline, editing, approval gating and clear handling of Gemini errors.</p>
        <ul className="status">
          {STATUS.map(([t, s2]) => (
            <li key={t}><span>{t}</span><b className={s2 === 'Done' ? 'done' : 'next'}>{s2}</b></li>
          ))}
        </ul>
      </section>

      <section className="section" id="stack">
        <p className="eyebrow">Stack</p>
        <h2>What it's <em>made of</em></h2>
        <table className="table">
          <thead><tr><th>Layer</th><th>Technology</th><th>Responsibility</th></tr></thead>
          <tbody>{STACK.map((r) => <tr key={r[0]}><td>{r[0]}</td><td><code>{r[1]}</code></td><td>{r[2]}</td></tr>)}</tbody>
        </table>
        <div className="cta-band">
          <h3>Ready to see it run?</h3>
          <Link to="/new" className="btn">Create your first campaign</Link>
        </div>
      </section>
    </>
  )
}
