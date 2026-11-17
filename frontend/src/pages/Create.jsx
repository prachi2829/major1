import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'

const PLATFORMS = [
  ['instagram', 'Instagram'],
  ['linkedin', 'LinkedIn'],
  ['twitter', 'X / Twitter'],
  ['facebook', 'Facebook'],
]
const TONES = ['Energetic and friendly', 'Professional and credible', 'Premium and elegant', 'Playful and witty', 'Warm and reassuring']

const EMPTY = { name: '', product: '', objective: '', audience: '', tone: TONES[0], platforms: ['instagram', 'linkedin'], description: '' }
const EXAMPLE = {
  name: 'FitLife Launch', product: 'Fitness application', objective: 'Increase downloads',
  audience: 'College students', tone: 'Energetic and friendly', platforms: ['instagram', 'linkedin'],
  description: 'An app for easy daily workouts',
}

function Field({ k, label, hint, f, set, errors, ...rest }) {
  return (
    <label className={`field ${errors[k] ? 'bad' : ''}`}>
      <span>{label}</span>
      <input value={f[k]} onChange={set(k)} {...rest} />
      {errors[k] ? <em>{errors[k]}</em> : hint && <small>{hint}</small>}
    </label>
  )
}

export default function Create({ notify }) {
  const nav = useNavigate()
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const toggle = (p) =>
    setF({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p] })

  function validate() {
    const e = {}
    if (f.name.trim().length < 2) e.name = 'Give the campaign a name'
    if (f.product.trim().length < 2) e.product = 'What are you promoting?'
    if (f.objective.trim().length < 2) e.objective = 'What should the campaign achieve?'
    if (f.audience.trim().length < 2) e.audience = 'Who is it for?'
    if (!f.platforms.length) e.platforms = 'Choose at least one platform'
    setErrors(e)
    return !Object.keys(e).length
  }

  async function submit(ev) {
    ev.preventDefault()
    if (!validate()) return
    setBusy(true)
    try {
      const c = await api.create({ ...f, name: f.name.trim(), product: f.product.trim(), objective: f.objective.trim(), audience: f.audience.trim() })
      nav(`/campaigns/${c.id}`)
    } catch (err) {
      notify(err.message, 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page narrow">
      <p className="eyebrow">Stage 1 · Campaign creation</p>
      <h2>Tell the agents <em>what you need</em></h2>
      <p className="sub">You provide the requirements. The agents turn them into strategy and content.</p>

      <form className="form" onSubmit={submit} noValidate>
        <div className="grid2">
          <Field f={f} set={set} errors={errors} k="name" label="Campaign name" placeholder="FitLife Launch" maxLength={80} />
          <Field f={f} set={set} errors={errors} k="product" label="Product" placeholder="Fitness application" maxLength={120} />
          <Field f={f} set={set} errors={errors} k="objective" label="Objective" placeholder="Increase downloads" maxLength={160} />
          <Field f={f} set={set} errors={errors} k="audience" label="Target audience" placeholder="College students" maxLength={160} />
        </div>

        <label className="field">
          <span>Tone</span>
          <input list="tones" value={f.tone} onChange={set('tone')} maxLength={80} />
          <datalist id="tones">{TONES.map((t) => <option key={t} value={t} />)}</datalist>
          <small>Pick one or type your own.</small>
        </label>

        <fieldset className={`field ${errors.platforms ? 'bad' : ''}`}>
          <span>Platforms</span>
          <div className="chips">
            {PLATFORMS.map(([k, l]) => (
              <button type="button" key={k} className={`chip-btn ${f.platforms.includes(k) ? 'on' : ''}`} onClick={() => toggle(k)} aria-pressed={f.platforms.includes(k)}>{l}</button>
            ))}
          </div>
          {errors.platforms && <em>{errors.platforms}</em>}
        </fieldset>

        <label className="field">
          <span>Description <small>(optional)</small></span>
          <textarea rows="3" value={f.description} onChange={set('description')} maxLength={600} placeholder="An app for easy daily workouts" />
        </label>

        <div className="cta-row">
          <button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create campaign'}</button>
          <button type="button" className="btn ghost" onClick={() => { setF(EXAMPLE); setErrors({}) }}>Fill with example</button>
        </div>
      </form>
    </section>
  )
}
