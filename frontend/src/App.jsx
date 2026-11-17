import React, { useCallback, useEffect, useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
import Landing from './pages/Landing.jsx'
import Create from './pages/Create.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Workspace from './pages/Workspace.jsx'
import Analytics from './pages/Analytics.jsx'
import Scheduler from './pages/Scheduler.jsx'
import SocialAccounts from './pages/SocialAccounts.jsx'
import AgentHub from './pages/AgentHub.jsx'
import ABTesting from './pages/ABTesting.jsx'
import AudienceIntelligence from './pages/AudienceIntelligence.jsx'
import BudgetOptimizer from './pages/BudgetOptimizer.jsx'
import CompetitorIntelligence from './pages/CompetitorIntelligence.jsx'
import { api } from './api.js'

export default function App() {
  const [health, setHealth] = useState(null)
  const [toast, setToast] = useState(null)
  const { pathname } = useLocation()

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: 'down' }))
  }, [])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const notify = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), kind === 'err' ? 8000 : 3600)
  }, [])

  return (
    <>
      <Nav health={health} />
      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/new" element={<Create notify={notify} />} />
          <Route path="/campaigns" element={<Dashboard notify={notify} />} />
          <Route path="/agents" element={<AgentHub notify={notify} />} />
          <Route path="/agents/:id" element={<AgentHub notify={notify} />} />
          <Route path="/ab-testing" element={<ABTesting notify={notify} />} />
          <Route path="/ab-testing/:id" element={<ABTesting notify={notify} />} />
          <Route path="/audience" element={<AudienceIntelligence notify={notify} />} />
          <Route path="/audience/:id" element={<AudienceIntelligence notify={notify} />} />
          <Route path="/budget" element={<BudgetOptimizer notify={notify} />} />
          <Route path="/budget/:id" element={<BudgetOptimizer notify={notify} />} />
          <Route path="/competitors" element={<CompetitorIntelligence notify={notify} />} />
          <Route path="/competitors/:id" element={<CompetitorIntelligence notify={notify} />} />
          <Route path="/scheduler" element={<Scheduler notify={notify} />} />
          <Route path="/social" element={<SocialAccounts notify={notify} />} />
          <Route path="/analytics" element={<Analytics notify={notify} />} />
          <Route path="/analytics/:id" element={<Analytics notify={notify} />} />
          <Route path="/campaigns/:id" element={<Workspace notify={notify} health={health} />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </main>
      <Footer />
      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.msg}</div>}
    </>
  )
}
