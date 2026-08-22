import { useEffect, useState } from 'react'
import './BootScreen.css'

const BOOT_LINES = [
  { text: 'INITIALIZING CORE SYSTEMS...', delay: 0 },
  { text: 'LOADING NEURAL NETWORK...', delay: 200 },
  { text: 'CALIBRATING SENSORS...', delay: 400 },
  { text: 'CONNECTING TO SERVERS...', delay: 600 },
  { text: 'SYSTEM READY.', delay: 800, highlight: true },
]

export default function BootScreen({ onBoot }) {
  const [visibleLines, setVisibleLines] = useState([])
  const [fadeOut, setFadeOut] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Show each boot line with staggered timing
    BOOT_LINES.forEach((line, i) => {
      setTimeout(() => {
        setVisibleLines(prev => [...prev, line])
        setProgress(Math.round(((i + 1) / BOOT_LINES.length) * 100))
      }, line.delay)
    })

    // Start fade-out and call onBoot
    setTimeout(() => setFadeOut(true), 1200)
    setTimeout(() => onBoot(true), 1800)
  }, [onBoot])

  return (
    <div className={`boot-screen ${fadeOut ? 'fade-out' : ''}`}>
      {/* Grid overlay */}
      <div className="boot-grid" />

      {/* Center content */}
      <div className="boot-center">
        {/* LX Logo / Title */}
        <div className="boot-logo">
          <span className="boot-logo-lx">LX</span>
          <span className="boot-logo-sub">ADVANCED INTELLIGENCE SYSTEM</span>
        </div>

        {/* Progress bar */}
        <div className="boot-progress-track">
          <div className="boot-progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="boot-progress-label">{progress}%</div>

        {/* Terminal lines */}
        <div className="boot-terminal">
          {visibleLines.map((line, i) => (
            <div
              key={i}
              className={`boot-line ${line.highlight ? 'highlight' : ''}`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <span className="boot-prompt">&gt;</span> {line.text}
            </div>
          ))}
        </div>
      </div>

      {/* Corner decorations */}
      <div className="boot-corner boot-corner-tl" />
      <div className="boot-corner boot-corner-tr" />
      <div className="boot-corner boot-corner-bl" />
      <div className="boot-corner boot-corner-br" />
    </div>
  )
}
