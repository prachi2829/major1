import React from 'react'

export default function Footer() {
  return (
    <footer className="footer">
      <div>
        <strong>Campaign<em>.AI</em></strong>
        <p>An autonomous multi-agent marketing orchestration platform. Strategy, content, previews, live editing, an approval-to-publish workflow, persistent storage and an analytics dashboard.</p>
      </div>
      <div>
        <h4>Honest notes</h4>
        <ul>
          <li>Publishing is a simulated workflow; no live Instagram or LinkedIn API calls.</li>
          <li>Campaigns are saved in a local SQLite database and survive restarts.</li>
          <li>All copy is generated live by Gemini; if it is unreachable you see an error, not fake text.</li>
          <li>Analytics numbers are simulated and labeled as such; real platform APIs and scheduling are future work.</li>
        </ul>
      </div>
    </footer>
  )
}
