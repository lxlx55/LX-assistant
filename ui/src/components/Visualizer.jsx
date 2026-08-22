import { useEffect, useRef } from 'react'
import './Visualizer.css'

export default function Visualizer({ isSpeaking, micState, analyser }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationFrameId
    
    // Simulate AI voice visualization
    let simPhase = 0
    
    const draw = () => {
      animationFrameId = requestAnimationFrame(draw)
      
      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)
      
      const barCount = 24
      const spacing = 4
      const barWidth = (width - (spacing * (barCount - 1))) / barCount
      
      let dataArray = new Uint8Array(barCount)
      
      if (isSpeaking) {
        // Simulated AI voice
        simPhase += 0.15
        for (let i = 0; i < barCount; i++) {
          const noise = Math.sin(simPhase + i * 0.5) * Math.cos(simPhase * 0.8 - i * 0.2)
          dataArray[i] = Math.max(0, 100 + noise * 100)
        }
      } else if (analyser && (micState === 'listening' || micState === 'recording')) {
        // Real User Voice
        const fbcArray = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(fbcArray)
        
        // Downsample frequency data to barCount
        const step = Math.floor(fbcArray.length / (barCount * 2)) // Use lower half of frequencies (human voice)
        for (let i = 0; i < barCount; i++) {
          let sum = 0
          for(let j = 0; j < step; j++) {
            sum += fbcArray[i * step + j]
          }
          dataArray[i] = sum / step
        }
      } else {
        // Idle
        for (let i = 0; i < barCount; i++) {
          dataArray[i] = 5 // tiny bump
        }
      }
      
      // Draw Bars
      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i]
        const percent = value / 255
        const barHeight = Math.max(5, percent * height)
        
        ctx.fillStyle = 'rgba(255, 179, 179, 0.6)' // Blended reddish hue
        ctx.fillRect(
          i * (barWidth + spacing),
          height - barHeight,
          barWidth,
          barHeight
        )
      }
    }
    
    draw()
    return () => cancelAnimationFrame(animationFrameId)
  }, [isSpeaking, micState, analyser])

  return (
    <div className="visualizer-container">
      {/* Bar Equalizer */}
      <div className="eq-container">
        <canvas ref={canvasRef} width="300" height="80" className="eq-canvas" />
      </div>
    </div>
  )
}
