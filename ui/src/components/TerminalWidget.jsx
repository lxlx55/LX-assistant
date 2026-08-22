import { useState, useEffect, useRef } from 'react'
import './TerminalWidget.css'

export default function TerminalWidget() {
  const [logs, setLogs] = useState([])
  const bottomRef = useRef(null)

  useEffect(() => {
    // Add initial boot log
    setLogs(['> SYSTEM INITIALIZED', '> WAITING FOR INPUT...'])

    const handleLog = (e) => {
      setLogs(prev => {
        const newLogs = [...prev, e.detail]
        return newLogs.length > 12 ? newLogs.slice(newLogs.length - 12) : newLogs
      })
    }

    window.addEventListener('lx-terminal-log', handleLog)
    return () => window.removeEventListener('lx-terminal-log', handleLog)
  }, [])

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="mini-terminal">
      <div className="terminal-header drag-handle">
        <span className="dot dot-red"></span>
        <span className="dot dot-yellow"></span>
        <span className="dot dot-green"></span>
        <span className="title">LX.SYS_PROC</span>
      </div>
      <div className="terminal-body">
        {logs.map((log, i) => (
          <div key={i} className="terminal-line">{log}</div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
