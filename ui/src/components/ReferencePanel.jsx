import { useEffect, useState } from 'react'
import './ReferencePanel.css'

function BootAnimation() {
  const [progress, setProgress] = useState(0)
  const [lines, setLines] = useState([])

  const BOOT_LINES = [
    'INITIALIZING VISUAL CORTEX...',
    'LOADING PERCEPTION ENGINE...',
    'CALIBRATING IMAGE SENSORS...',
    'CONNECTING NEURAL PATHWAYS...',
    'SCANNING ENVIRONMENT...',
    'VISUAL SUBSYSTEM ONLINE.'
  ]

  useEffect(() => {
    // Animate progress bar
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); return 100 }
        return p + 2
      })
    }, 50)

    // Stagger boot lines
    BOOT_LINES.forEach((line, i) => {
      setTimeout(() => setLines(prev => [...prev, line]), i * 400)
    })

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="ref-boot-animation">
      {/* Radar sweep */}
      <div className="ref-boot-radar">
        <div className="ref-boot-radar-ring" />
        <div className="ref-boot-radar-ring ref-boot-radar-ring-2" />
        <div className="ref-boot-radar-sweep" />
        <div className="ref-boot-radar-dot" />
      </div>

      {/* Boot terminal */}
      <div className="ref-boot-terminal">
        {lines.map((line, i) => (
          <div key={i} className={`ref-boot-line ${i === lines.length - 1 ? 'ref-boot-line-active' : ''}`}>
            <span className="ref-boot-prompt">&gt;</span> {line}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="ref-boot-progress-track">
        <div className="ref-boot-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="ref-boot-progress-label">{progress}%</div>
    </div>
  )
}

export default function ReferencePanel({ imageUrl, keyword, visible, mediaAction, bootMode }) {
  const [loaded, setLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [currentRenderedImage, setCurrentRenderedImage] = useState(null)
  
  // Custom Tabs for Social/Media Browsing
  const [activeTab, setActiveTab] = useState('VISUAL')
  
  const images = Array.isArray(imageUrl) ? imageUrl : [imageUrl].filter(Boolean)
  const image = images[0]
  
  const isYouTubeAction = mediaAction && mediaAction.action_type === 'play_youtube'
  const isSpotifyAction = mediaAction && mediaAction.action_type === 'play_spotify'
  const isUrlAction = mediaAction && mediaAction.action_type === 'open_url'
  
  const isMedia = isYouTubeAction || isSpotifyAction

  // Reset states when the requested image changes
  useEffect(() => {
    setLoaded(false)
    setImgError(false)
    if (isYouTubeAction) setActiveTab('VISUAL') // Auto-switch back to visual for AI media actions
  }, [image, mediaAction])

  useEffect(() => {
    if (isSpotifyAction && mediaAction && mediaAction.query_or_url) {
      window.open(`https://open.spotify.com/search/${encodeURIComponent(mediaAction.query_or_url)}`, '_blank')
    } else if (isYouTubeAction && mediaAction && mediaAction.query_or_url) {
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(mediaAction.query_or_url)}`, '_blank')
    }
  }, [isSpotifyAction, isYouTubeAction, mediaAction])

  // Show during boot mode OR normal visible mode OR if we are explicitly on a custom tab
  if (!bootMode && (!visible || (!image && !isMedia && !isUrlAction)) && activeTab === 'VISUAL') return null

  const actionYtUrl = isYouTubeAction
    ? `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(mediaAction.query_or_url)}&autoplay=1`
    : null

  return (
    <div className={`ref-panel ref-panel--visible`}>
      <div className="ref-bracket ref-bracket-tl" />
      <div className="ref-bracket ref-bracket-tr" />
      <div className="ref-bracket ref-bracket-bl" />
      <div className="ref-bracket ref-bracket-br" />

      <div className="ref-header drag-handle">
        <span className="ref-header-dot" />
        <span className="ref-header-label">
          {bootMode ? 'SYSTEM STARTUP' : (activeTab === 'VISUAL' && isYouTubeAction ? 'YOUTUBE MEDIA PLAYBACK' : (isSpotifyAction ? 'SPOTIFY LAUNCHED' : (isUrlAction ? 'EXTERNAL LINK READY' : `${activeTab} FEED`)))}
        </span>
        <span className="ref-header-dot" />
      </div>

      <div className="ref-tabs">
        <button className={`ref-tab ${activeTab === 'VISUAL' ? 'active' : ''}`} onClick={() => setActiveTab('VISUAL')}>VISUAL AI</button>
        <button className={`ref-tab ${activeTab === 'YOUTUBE' ? 'active' : ''}`} onClick={() => setActiveTab('YOUTUBE')}>YOUTUBE</button>
        <button className={`ref-tab ${activeTab === 'INSTAGRAM' ? 'active' : ''}`} onClick={() => setActiveTab('INSTAGRAM')}>INSTAGRAM</button>
      </div>

      <div className="ref-image-wrap">
        {bootMode ? (
          <BootAnimation />
        ) : activeTab === 'YOUTUBE' || activeTab === 'INSTAGRAM' ? (
          <div className="ref-url-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '20px', textAlign: 'center' }}>
            <div style={{ color: 'rgba(255, 179, 179, 0.8)', fontSize: '0.9rem', marginBottom: '15px', fontFamily: '"Share Tech Mono", monospace' }}>
              {activeTab} READY FOR LAUNCH IN NEW TAB
            </div>
            <button 
              onClick={() => window.open(activeTab === 'YOUTUBE' ? 'https://www.youtube.com' : 'https://www.instagram.com', '_blank')}
              style={{
                background: 'rgba(255, 71, 87, 0.2)', border: '1px solid rgba(255, 71, 87, 0.5)',
                color: '#ffb3b3', padding: '10px 20px', borderRadius: '4px',
                fontFamily: '"Orbitron", sans-serif', letterSpacing: '0.1em',
                cursor: 'pointer', transition: 'all 0.2s', animation: 'pulse-danger-inline 2s infinite alternate'
              }}
            >
              LAUNCH {activeTab}
            </button>
          </div>
        ) : (
          <>
            {!loaded && !currentRenderedImage && !isMedia && !isUrlAction && <div className="ref-skeleton" />}
            
            {!loaded && currentRenderedImage && !isMedia && !isUrlAction && (
               <img
                 src={currentRenderedImage}
                 className="ref-image ref-image-active"
                 style={{ display: 'block' }}
                 alt="previous"
               />
            )}
            
            {isUrlAction || isSpotifyAction || isYouTubeAction ? (
              <div className="ref-url-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '20px', textAlign: 'center' }}>
                <div style={{ color: 'rgba(255, 179, 179, 0.8)', fontSize: '0.9rem', marginBottom: '15px', fontFamily: '"Share Tech Mono", monospace' }}>
                  {isSpotifyAction ? 'SPOTIFY LAUNCHED IN NEW TAB' : isYouTubeAction ? 'YOUTUBE LAUNCHED IN NEW TAB' : 'URL PREPARED FOR LAUNCH'}
                </div>
                <button 
                  onClick={() => window.open(isSpotifyAction ? `https://open.spotify.com/search/${encodeURIComponent(mediaAction.query_or_url)}` : isYouTubeAction ? `https://www.youtube.com/results?search_query=${encodeURIComponent(mediaAction.query_or_url)}` : mediaAction.query_or_url, '_blank')}
                  style={{
                    background: 'rgba(255, 71, 87, 0.2)', border: '1px solid rgba(255, 71, 87, 0.5)',
                    color: '#ffb3b3', padding: '10px 20px', borderRadius: '4px',
                    fontFamily: '"Orbitron", sans-serif', letterSpacing: '0.1em',
                    cursor: 'pointer', transition: 'all 0.2s', animation: 'pulse-danger-inline 2s infinite alternate'
                  }}
                >
                  CLICK TO OPEN
                </button>
              </div>
            ) : (
              image && (
                <img
                  key={image}
                  src={image}
                  alt={keyword}
                  className={`ref-image ${loaded ? 'ref-image-active' : ''}`}
                  style={{ display: loaded && !imgError ? 'block' : 'none' }}
                  onLoad={() => {
                    setLoaded(true)
                    setCurrentRenderedImage(image)
                  }}
                  onError={() => setImgError(true)}
                />
              )
            )}
          </>
        )}
      </div>

      <div className="ref-scanline" />
    </div>
  )
}
