import { useEffect, useState } from 'react'
import './ChatPanel.css'

export default function ChatPanel({ messages, isTyping, isSpeaking, micState, lxCharIndex = 0 }) {
  const [visible, setVisible] = useState(false)

  const lastLxMsg = messages.filter(m => m.type === 'lx').pop()
  const lastUserMsg = messages.filter(m => m.type === 'user').pop()

  useEffect(() => {
    // Show panel if there's activity
    if (messages.length > 0 || isSpeaking || isTyping || micState === 'recording' || micState === 'processing') {
      setVisible(true)
    }

    // Auto-hide after 10 seconds of absolute silence (no speaking, no typing, no active mic input)
    const timeout = setTimeout(() => {
      if (!isSpeaking && !isTyping && micState !== 'recording' && micState !== 'processing') {
        setVisible(false)
      }
    }, 10000)

    return () => clearTimeout(timeout)
  }, [messages, isSpeaking, isTyping, micState])

  // Helper to chunk text into 5-word captions and find the active one
  const getActiveCaption = (text, charIndex) => {
    if (!text) return { text: '', id: 0 }
    
    const words = text.trim().split(/\s+/)
    const chunks = []
    let searchStart = 0
    
    for (let i = 0; i < words.length; i += 5) {
      const chunkWords = words.slice(i, i + 5)
      const chunkText = chunkWords.join(' ')
      
      // Find start index in original string
      const startIdx = text.indexOf(chunkWords[0], searchStart)
      
      // Find end index in original string
      const lastWord = chunkWords[chunkWords.length - 1]
      const endIdx = text.indexOf(lastWord, startIdx) + lastWord.length
      
      chunks.push({ id: i, text: chunkText, start: startIdx, end: endIdx })
      searchStart = endIdx
    }
    
    let active = chunks.find(c => charIndex >= c.start && charIndex <= c.end)
    if (!active) {
       active = chunks.find(c => c.start >= charIndex) || chunks[chunks.length - 1]
    }
    
    return active || { text: text, id: 0 }
  }

  const activeCaption = lastLxMsg ? getActiveCaption(lastLxMsg.text, lxCharIndex) : { text: '', id: 0 }

  return (
    <div className={`ephemeral-panel ${visible ? 'visible' : 'hidden'}`}>
      
      {/* Upper Left: L X Response */}
      <div className="ephemeral-lx-container">
        <div className={`indicator-circle lx-indicator ${isSpeaking ? 'speaking-pulse' : ''}`} />
        {isTyping ? (
          <h1 className="custom-layout-text typing-glow">THINKING...</h1>
        ) : lastLxMsg ? (
          <h1 key={activeCaption.id} className="custom-layout-text caption-animate">{activeCaption.text}</h1>
        ) : (
          <h1 className="custom-layout-text"></h1>
        )}
      </div>

      {/* Bottom Right: User Input */}
      <div className="ephemeral-user-container">
        {lastUserMsg && (
          <>
            <div className={`indicator-circle user-indicator ${micState === 'recording' ? 'listening-pulse' : ''}`} />
            <h2 className="custom-layout-text">{lastUserMsg.text}</h2>
          </>
        )}
      </div>
      
    </div>
  )
}
