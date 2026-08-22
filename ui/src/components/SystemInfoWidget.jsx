import { useState, useEffect } from 'react'
import { fetchAssamEnvironment } from '../services/environment'
import './SystemInfoWidget.css'

export default function SystemInfoWidget({ 
  time, appUpSince, messages,
  micEnabled, setMicEnabled,
  locEnabled, setLocEnabled,
  bgmEnabled, setBgmEnabled,
  apiEnabled, setApiEnabled
}) {
  const [weatherData, setWeatherData] = useState({ temp: '--', condition: 'WAITING', region: 'INITIALIZING' })

  useEffect(() => {
    async function loadWeather() {
      const payload = await fetchAssamEnvironment()
      if (payload.data) {
        setWeatherData({
          temp: payload.data.temp,
          condition: payload.data.condition.toUpperCase(),
          region: payload.data.region.toUpperCase()
        })
      }
    }
    loadWeather()
    const interval = setInterval(loadWeather, 1000 * 60 * 15) // refresh every 15 min
    return () => clearInterval(interval)
  }, [])

  // Calculate Uptime (Hours and Minutes)
  let uptimeStr = '00:00'
  if (appUpSince) {
    const diffMs = time - appUpSince
    const diffHrs = Math.floor(diffMs / 3600000)
    const diffMins = Math.floor((diffMs % 3600000) / 60000)
    const diffSecs = Math.floor((diffMs % 60000) / 1000)
    
    if (diffHrs > 0) {
      uptimeStr = `${diffHrs}h ${diffMins}m`
    } else {
      uptimeStr = `${diffMins.toString().padStart(2, '0')}:${diffSecs.toString().padStart(2, '0')}`
    }
  }

  // Count user commands
  const commandCount = messages.filter(m => m.type === 'user').length

  const dateStr = time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
  const timeStr = time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
  const secondsStr = time.getSeconds().toString().padStart(2, '0')

  const [hudLocked, setHudLocked] = useState(() => localStorage.getItem('lx_hud_locked') === 'true')

  const toggleHudLock = (e) => {
    const isLocked = e.target.checked
    setHudLocked(isLocked)
    localStorage.setItem('lx_hud_locked', isLocked ? 'true' : 'false')
    
    // Dispatch a custom event to force Draggable components to re-render and pick up the new cursor/lock state immediately
    window.dispatchEvent(new Event('storage')) 
  }

  return (
    <div className="system-info-widget">
      {/* Header */}
      <div className="hud-header drag-handle">
        <span>SYSTEM_INFO</span>
        <div className="hud-pulse-dot"></div>
      </div>

      <div className="hud-divider"></div>

      {/* Clock Area */}
      <div className="hud-clock-section">
        <div className="hud-time">
          {timeStr}<span className="hud-seconds">:{secondsStr}</span>
        </div>
        <div className="hud-date">{dateStr}</div>
      </div>

      <div className="hud-divider-diamond">
        <div className="diamond"></div>
      </div>

      {/* Weather Area */}
      <div className="hud-weather-section">
        <div className="hud-weather-icon">☁️</div>
        <div className="hud-weather-details">
          <div className="hud-temp">{weatherData.temp}°C</div>
          <div className="hud-condition">{weatherData.condition}</div>
        </div>
      </div>

      <div className="hud-divider-diamond">
        <div className="diamond"></div>
      </div>

      {/* Location Area */}
      <div className={`hud-location-box ${!locEnabled ? 'disabled-box' : ''}`}>
        <span className="location-pin">📍</span>
        <span className="location-text">{locEnabled ? weatherData.region : 'GPS OFFLINE'}</span>
      </div>

      <div className="hud-divider-diamond">
        <div className="diamond"></div>
      </div>

      {/* Footer Stats */}
      <div className="hud-footer">
        <div className="hud-stat-box">
          <div className="stat-label">UPTIME</div>
          <div className="stat-value">{uptimeStr}</div>
        </div>
        <div className="hud-stat-divider"></div>
        <div className="hud-stat-box">
          <div className="stat-label">COMMANDS</div>
          <div className="stat-value">{commandCount}</div>
        </div>
      </div>

      <div className="hud-divider"></div>

      {/* Hardware Controls */}
      <div className="hud-hardware-controls">
        <div className="hud-control-row">
          <span className="hud-control-label">LOCK HUD</span>
          <label className="hud-switch">
            <input type="checkbox" checked={hudLocked} onChange={toggleHudLock} />
            <span className="hud-slider"></span>
          </label>
        </div>
        <div className="hud-control-row">
          <span className="hud-control-label">API</span>
          <label className="hud-switch">
            <input type="checkbox" checked={apiEnabled} onChange={(e) => setApiEnabled(e.target.checked)} />
            <span className="hud-slider"></span>
          </label>
        </div>
        <div className="hud-control-row">
          <span className="hud-control-label">MIC</span>
          <label className="hud-switch">
            <input type="checkbox" checked={micEnabled} onChange={(e) => setMicEnabled(e.target.checked)} />
            <span className="hud-slider"></span>
          </label>
        </div>
        <div className="hud-control-row">
          <span className="hud-control-label">GPS</span>
          <label className="hud-switch">
            <input type="checkbox" checked={locEnabled} onChange={(e) => setLocEnabled(e.target.checked)} />
            <span className="hud-slider"></span>
          </label>
        </div>
        <div className="hud-control-row">
          <span className="hud-control-label">BGM</span>
          <label className="hud-switch">
            <input type="checkbox" checked={bgmEnabled} onChange={(e) => setBgmEnabled(e.target.checked)} />
            <span className="hud-slider"></span>
          </label>
        </div>
      </div>
    </div>
  )
}
