import { useState, useCallback, useEffect, useRef } from 'react'
import ChatPanel from './components/ChatPanel'
import Visualizer from './components/Visualizer'
import BootScreen from './components/BootScreen'
import SystemInfoWidget from './components/SystemInfoWidget'
import ReferencePanel from './components/ReferencePanel'
import TerminalWidget from './components/TerminalWidget'
import Draggable from './components/Draggable'
import CursorTrail from './components/CursorTrail'
import { askLX, resetChat } from './services/ai'
import { speak, stopSpeaking } from './services/tts'
import { LXMicrophone } from './services/stt'
import { fetchAssamEnvironment } from './services/environment'
import { playUIClick, initAudio } from './services/audioEffects'
import { fetchReferenceImage } from './services/imageSearch'
import './App.css'

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY

function App() {
  const [isBooted, setIsBooted] = useState(false)
  const [apiEnabled, setApiEnabled] = useState(true) // Tracks if Groq AI is on
  const [time, setTime] = useState(new Date())
  const [appUpSince, setAppUpSince] = useState(null)

  const [messages, setMessages] = useState([])
  const [micState, setMicState] = useState('off')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isTyping, setIsTyping] = useState(false)

  const [inputText, setInputText] = useState('')

  const [micEnabled, setMicEnabled] = useState(true)
  const [locEnabled, setLocEnabled] = useState(true)
  const [lxCharIndex, setLxCharIndex] = useState(0)

  // Reference image panel state
  const [refImage, setRefImage] = useState(null)
  const [refKeyword, setRefKeyword] = useState('')
  const [refVisible, setRefVisible] = useState(false)
  const refHideTimer = useRef(null)

  const micRef = useRef(null)
  const isProcessingRef = useRef(false)
  const isSpeakingRef = useRef(false)
  const bgMusicRef = useRef(null)
  const handleSendRef = useRef(null) // always points to latest handleSend
  const [bgmEnabled, setBgmEnabled] = useState(true)
  const [mediaAction, setMediaAction] = useState(null) // For youtube/open URL
  const lastSpokenChunkRef = useRef('') // Track last sentence spoken
  const [isBootingViewer, setIsBootingViewer] = useState(false) // 3-sec startup animation

  // Helper to chunk text into 5-word captions
  const getActiveCaption = (text, charIndex) => {
    if (!text) return { text: '' }
    const words = text.trim().split(/\s+/)
    const chunks = []
    let searchStart = 0
    for (let i = 0; i < words.length; i += 5) {
      const chunkWords = words.slice(i, i + 5)
      const chunkText = chunkWords.join(' ')
      const startIdx = text.indexOf(chunkWords[0], searchStart)
      const lastWord = chunkWords[chunkWords.length - 1]
      const endIdx = text.indexOf(lastWord, startIdx) + lastWord.length
      chunks.push({ text: chunkText, start: startIdx, end: endIdx })
      searchStart = endIdx
    }
    let active = chunks.find(c => charIndex >= c.start && charIndex <= c.end)
    if (!active) active = chunks.find(c => c.start >= charIndex) || chunks[chunks.length - 1]
    return active || { text: text }
  }

  // Global click ripple effect
  useEffect(() => {
    const handleClick = (e) => {
      const ripple = document.createElement('div')
      ripple.className = 'click-ripple'
      ripple.style.left = `${e.clientX}px`
      ripple.style.top = `${e.clientY}px`
      document.body.appendChild(ripple)
      setTimeout(() => ripple.remove(), 500)
    }
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Sync bgmEnabled to audio element
  useEffect(() => {
    if (bgMusicRef.current) {
      if (bgmEnabled) {
        bgMusicRef.current.play().catch(() => {})
        bgMusicRef.current.volume = 0.05
      } else {
        bgMusicRef.current.pause()
      }
    }
  }, [bgmEnabled])

  // Play music: start at 5s, fade IN over 2s, play forever at 20% volume
  const startMusicTimer = useCallback(() => {
    const audio = bgMusicRef.current
    if (!audio) return

    audio.volume = 0
    audio.currentTime = 5 // Skip first 5 seconds to avoid cracking
    if (bgmEnabled) audio.play().catch(() => {})

    // FADE IN: 0 → 0.05 over 2 seconds
    const fadeInSteps = 40
    const fadeInInterval = 2000 / fadeInSteps
    let fadeInStep = 0
    const fadeIn = setInterval(() => {
      fadeInStep++
      const vol = Math.min(0.05, 0.05 * (fadeInStep / fadeInSteps))
      if (audio) { audio.volume = vol }
      if (fadeInStep >= fadeInSteps) clearInterval(fadeIn)
    }, fadeInInterval)
  }, [bgmEnabled])

  // Global click: play UI sound only
  useEffect(() => {
    const handleClick = () => {
      initAudio()
      playUIClick()
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Fetch reference image for what LX just said
  const updateReferenceImage = useCallback(async (keyword, uiAction) => {
    // If we have an explicit UI action, we show it in the reference panel or open it directly
    if (uiAction) {
      if (uiAction.action_type === 'open_url') {
        window.dispatchEvent(new CustomEvent('lx-terminal-log', { detail: `> OPENING URL: ${uiAction.query_or_url}` }))
        const opened = window.open(uiAction.query_or_url, '_blank')
        if (opened) {
          return
        }
        window.dispatchEvent(new CustomEvent('lx-terminal-log', { detail: '> POPUP BLOCKED. AWAITING MANUAL OVERRIDE.' }))
      }
      setMediaAction(uiAction)
      setRefVisible(true)
      return
    }

    if (!keyword) {
      return
    }

    // Don't hide the panel — just swap the image URL directly so it flows smoothly
    clearTimeout(refHideTimer.current)

    const img = await fetchReferenceImage(keyword)
    if (!img) return

    setRefKeyword(keyword)
    setRefImage(img.urls)
    setMediaAction(null)
    setRefVisible(true)
  }, [])

  const startSystem = useCallback(() => {
    if (micRef.current || !GROQ_KEY) return

    const mic = new LXMicrophone({
      apiKey: GROQ_KEY,
      // Use ref so we always call the latest handleSend (fixes stale closure)
      onTranscript: (text) => {
        if (!isProcessingRef.current && handleSendRef.current) {
          handleSendRef.current(text)
        }
      },
      onStateChange: (state) => setMicState(state),
      onError: (msg) => {
        console.error('[MIC]', msg)
        window.dispatchEvent(new CustomEvent('lx-terminal-log', { detail: `> [SYSTEM WARNING] ${msg}` }))
      },
    })

    micRef.current = mic
    mic.start()
  }, [])

  useEffect(() => {
    if (micEnabled && isBooted && apiEnabled) {
      startSystem()
    } else {
      micRef.current?.destroy()
      micRef.current = null
      setMicState('off')
    }
    return () => {
      micRef.current?.destroy()
      micRef.current = null
    }
  }, [micEnabled, startSystem, isBooted, apiEnabled])

  const handleBoot = async (isApiEnabled) => {
    setApiEnabled(isApiEnabled)
    setIsBooted(true)
    setAppUpSince(new Date())
    resetChat()

    // Start the 3-second boot animation in the image viewer
    setIsBootingViewer(true)
    setTimeout(() => setIsBootingViewer(false), 3000)

    // Phase 4: Hydrate chat history from persistent memory
    try {
      if (window.lxAPI && window.lxAPI.getHistory) {
        const savedHistory = await window.lxAPI.getHistory(20)
        if (savedHistory && savedHistory.length > 0) {
          const hydratedMessages = savedHistory.map((msg, i) => ({
            id: Date.now() + i,
            type: msg.role === 'user' ? 'user' : 'lx',
            text: msg.content,
            timestamp: new Date(msg.timestamp),
          }))
          setMessages(hydratedMessages)
          window.dispatchEvent(new CustomEvent('lx-terminal-log', { detail: `> MEMORY: Loaded ${savedHistory.length} past messages` }))
        }
      }
    } catch (e) {
      console.warn('[LX] Could not hydrate history:', e)
    }

    // Start music with fade-in
    if (bgMusicRef.current) {
      startMusicTimer()
    }

    if (!isApiEnabled) {
      // OFFLINE MODE: No API calls
      setMessages([{
        id: Date.now(),
        type: 'lx',
        text: 'SYSTEMS OFFLINE. LOCAL MODE ENGAGED. AI FEATURES DISABLED.',
        timestamp: new Date(),
        isError: true,
      }])
      window.dispatchEvent(new CustomEvent('lx-terminal-log', { detail: '> API CONNECTION OFFLINE' }))
      return // Stop boot sequence here
    }

    isProcessingRef.current = true
    setIsTyping(true)

    let envContext = null
    let bootVisual = 'high tech radar map'
    if (locEnabled) {
      window.dispatchEvent(new CustomEvent('lx-terminal-log', { detail: '> FETCHING GEO-LOCATION DATA...' }))
      const envData = await fetchAssamEnvironment()
      envContext = envData.contextString
      if (envData.data) {
        bootVisual = `map of ${envData.data.region} with ${envData.data.condition} weather`
      }
    }

    window.dispatchEvent(new CustomEvent('lx-terminal-log', { detail: '> INITIATING BOOT SEQUENCE...' }))
    const bootPrompt = "SYSTEM BOOT. Greet the user as 'Sir'. Say 'Hello Sir, systems configured.' then briefly mention today's weather and time. Max 2 sentences."
    const result = await askLX(bootPrompt, envContext)
    window.dispatchEvent(new CustomEvent('lx-terminal-log', { detail: '> BOOT SEQUENCE COMPLETE' }))

    setMessages([{
      id: Date.now(),
      type: 'lx',
      text: result.text.toUpperCase(),
      timestamp: new Date(),
      isError: !result.success,
    }])
    setIsTyping(false)

    setLxCharIndex(0)
    setIsSpeaking(true)
    isSpeakingRef.current = true

    // Explicitly pause the microphone before speaking to prevent echo
    micRef.current?.pause()

    // Fetch reference image in parallel using the explicit custom boot keyword
    updateReferenceImage(bootVisual, result.uiAction)

    await new Promise((resolve) => {
      speak(result.text, {
        onEnd: () => { isSpeakingRef.current = false; resolve() },
        onBoundary: (idx) => { setLxCharIndex(idx) }
      })
    })

    setIsSpeaking(false)
    isSpeakingRef.current = false
    isProcessingRef.current = false

    setTimeout(() => {
      if (!isProcessingRef.current && micEnabled) micRef.current?.resume()
    }, 800)
  }

  const handleSend = useCallback(async (text) => {
    if (!text.trim() || isProcessingRef.current) return
    isProcessingRef.current = true

    micRef.current?.pause()
    stopSpeaking()
    isSpeakingRef.current = false

    window.dispatchEvent(new CustomEvent('lx-terminal-log', { detail: '> USER INPUT RECEIVED' }))
    window.dispatchEvent(new CustomEvent('lx-terminal-log', { detail: '> PROCESSING INTENT...' }))

    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'user',
      text: text.trim().toUpperCase(),
      timestamp: new Date(),
    }])
    setIsTyping(true)

    let envContext = null
    if (locEnabled) {
      window.dispatchEvent(new CustomEvent('lx-terminal-log', { detail: '> FETCHING GEO-LOCATION DATA...' }))
      const envData = await fetchAssamEnvironment()
      envContext = envData.contextString
    }

    window.dispatchEvent(new CustomEvent('lx-terminal-log', { detail: '> QUERYING LX NEURAL NET...' }))
    const result = await askLX(text.trim(), envContext)
    window.dispatchEvent(new CustomEvent('lx-terminal-log', { detail: '> RESPONSE GENERATED' }))

    setMessages(prev => [...prev, {
      id: Date.now() + 1,
      type: 'lx',
      text: result.text.toUpperCase(),
      timestamp: new Date(),
      isError: !result.success,
    }])
    setIsTyping(false)

    setLxCharIndex(0)
    setIsSpeaking(true)
    isSpeakingRef.current = true

    // Fetch reference image in parallel using the keyword the AI just generated
    updateReferenceImage(result.visual_keyword, result.uiAction)

    await new Promise((resolve) => {
      speak(result.text, {
        onEnd: () => { isSpeakingRef.current = false; resolve() },
        onBoundary: (idx) => { setLxCharIndex(idx); const active = getActiveCaption(result.text, idx); if (active && active.text && active.text !== lastSpokenChunkRef.current) { lastSpokenChunkRef.current = active.text; updateReferenceImage(active.text, null); } }
      })
    })

    setIsSpeaking(false)
    isSpeakingRef.current = false
    isProcessingRef.current = false

    setTimeout(() => {
      if (!isProcessingRef.current && micEnabled) micRef.current?.resume()
    }, 800)
  }, [locEnabled, micEnabled, updateReferenceImage])

  // Handle manual typed commands
  const handleManualSubmit = useCallback((e) => {
    e.preventDefault()
    if (!inputText.trim() || isProcessingRef.current) return
    playUIClick()
    const text = inputText
    setInputText('')
    handleSend(text)
  }, [inputText, handleSend])

  // Keep the ref always pointing to the latest handleSend
  handleSendRef.current = handleSend

  // Dedicated button to interrupt speech instantly
  const handleInterrupt = useCallback((e) => {
    // Prevent event bubbling if necessary
    if (e) e.stopPropagation()

    if (isSpeakingRef.current) {
      stopSpeaking()
      setIsSpeaking(false)
      isSpeakingRef.current = false
      isProcessingRef.current = false
      window.dispatchEvent(new CustomEvent('lx-terminal-log', { detail: '> SPEECH INTERRUPTED (MANUAL OVERRIDE)' }))
      
      // Resume mic immediately so user can talk
      if (micEnabled) {
        micRef.current?.resume()
      }
    }
  }, [micEnabled])

  return (
    <div className="app-container">
      <CursorTrail />
      {!isBooted && <BootScreen onBoot={handleBoot} />}

      {/* Animated Background Layers */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />
      <div className="bg-scanline" />

      {/* Animated leaf overlays */}
      <div className="leaf-top-left" />
      <div className="leaf-bottom-right" />

      {/* Static Corner Texts */}
      <div className={`static-text corner-top-left ${isBooted ? 'boot-animate' : ''}`}>
        <div className="hud-clock-time">
          {time.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
        </div>
        <div className="hud-clock-label">ASSAM, INDIA · IST</div>
      </div>

      <div className={`static-text corner-bottom-left developer-tag ${isBooted ? 'boot-animate' : ''}`}>
        <span className="dev-label">DEVELOPED BY</span>
        <span className="dev-name">AMRITOM BORAH</span>
      </div>
      <div className={`static-text corner-bottom-right ${isBooted ? 'boot-animate' : ''}`}>
        <strong>Project:</strong> LX
      </div>

      {/* System Information Panel — top-left */}
      <Draggable id="system-info" initialPos={{ x: 20, y: 20 }}>
        <SystemInfoWidget
          time={time}
          appUpSince={appUpSince}
          messages={messages}
          micEnabled={micEnabled} setMicEnabled={setMicEnabled}
          locEnabled={locEnabled} setLocEnabled={setLocEnabled}
          bgmEnabled={bgmEnabled} setBgmEnabled={setBgmEnabled}
          apiEnabled={apiEnabled} setApiEnabled={setApiEnabled}
        />
      </Draggable>

      {/* Terminal Log Panel — bottom-left */}
      <Draggable id="terminal" initialPos={{ x: 20, y: window.innerHeight - 270 }}>
        <TerminalWidget />
      </Draggable>

      {/* Reference Image Panel — top-right */}
      <Draggable id="reference" initialPos={{ x: window.innerWidth - 520, y: 50 }} style={{ opacity: refVisible || isBootingViewer ? 1 : 0, transition: 'opacity 0.5s ease', pointerEvents: refVisible || isBootingViewer ? 'auto' : 'none' }}>
        <ReferencePanel
          imageUrl={refImage}
          keyword={refKeyword}
          visible={refVisible}
          mediaAction={mediaAction}
          bootMode={isBootingViewer}
        />
      </Draggable>

      {/* Manual Command Input Bar with Inline Pause Button */}
      {isBooted && (
        <form className="command-input-wrapper" onSubmit={handleManualSubmit}>
          <input
            type="text"
            className="command-input"
            placeholder={isProcessingRef.current ? (isSpeaking ? "LX IS SPEAKING..." : "PROCESSING...") : "ENTER COMMAND..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isProcessingRef.current}
            autoComplete="off"
          />
          {isSpeaking && (
            <button type="button" className="interrupt-inline-btn" onClick={handleInterrupt} title="Stop Speech">
              <svg className="power-icon" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            </button>
          )}
        </form>
      )}

      {/* Visualizer — bottom-left */}
      <Visualizer
        isSpeaking={isSpeaking}
        micState={micState}
        analyser={micRef.current?.analyser}
      />



      {/* Main Chat Panel */}
      <div className="interface-layout">
        <ChatPanel
          messages={messages}
          isTyping={isTyping}
          isSpeaking={isSpeaking}
          micState={micState}
          lxCharIndex={lxCharIndex}
        />
      </div>

      {/* Background Music - loops continuously starting from 5s */}
      <audio 
        ref={bgMusicRef} 
        src="/bgm.mp3" 
        onTimeUpdate={(e) => {
          if (e.target.currentTime >= e.target.duration - 0.5) {
            e.target.currentTime = 5;
            e.target.play().catch(() => {});
          }
        }}
      />
    </div>
  )
}

export default App
