// Synthesized sound effects using Web Audio API to avoid external dependencies

export let audioCtx = null
export let masterCompressor = null

export function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    
    // Add a master compressor to completely prevent audio clipping/cracking
    masterCompressor = audioCtx.createDynamicsCompressor()
    masterCompressor.threshold.setValueAtTime(-24, audioCtx.currentTime)
    masterCompressor.knee.setValueAtTime(30, audioCtx.currentTime)
    masterCompressor.ratio.setValueAtTime(12, audioCtx.currentTime)
    masterCompressor.attack.setValueAtTime(0.003, audioCtx.currentTime)
    masterCompressor.release.setValueAtTime(0.25, audioCtx.currentTime)
    
    masterCompressor.connect(audioCtx.destination)
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
}

export function playUIClick() {
  initAudio()
  
  // Powerful, deep robotic UI click
  const osc1 = audioCtx.createOscillator()
  const osc2 = audioCtx.createOscillator()
  const filter = audioCtx.createBiquadFilter()
  const gainNode = audioCtx.createGain()
  
  osc1.type = 'square'
  osc2.type = 'sawtooth'
  
  // Lower frequencies for a chunkier, mechanical sound
  osc1.frequency.setValueAtTime(400, audioCtx.currentTime)
  osc1.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.05)
  
  osc2.frequency.setValueAtTime(800, audioCtx.currentTime)
  osc2.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05)

  // Bandpass filter to make it sound like it's coming through a comm channel
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(1000, audioCtx.currentTime)
  filter.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.05)
  
  gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05)
  
  osc1.connect(filter)
  osc2.connect(filter)
  filter.connect(gainNode)
  gainNode.connect(masterCompressor)
  
  osc1.start()
  osc2.start()
  osc1.stop(audioCtx.currentTime + 0.05)
  osc2.stop(audioCtx.currentTime + 0.05)
}

export function playBootSound() {
  initAudio()
  const t = audioCtx.currentTime

  // JARVIS-style high-tech power-up sweep
  const sweep = audioCtx.createOscillator()
  const sub = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  
  sweep.type = 'square'
  sub.type = 'sawtooth'

  // Fast upward frequency sweep
  sweep.frequency.setValueAtTime(150, t)
  sweep.frequency.exponentialRampToValueAtTime(1200, t + 0.15)
  sweep.frequency.linearRampToValueAtTime(1400, t + 0.5)

  sub.frequency.setValueAtTime(50, t)
  sub.frequency.linearRampToValueAtTime(150, t + 0.4)

  // Sharp attack, quick decay
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.4, t + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6)

  sweep.connect(gain)
  sub.connect(gain)
  gain.connect(masterCompressor)

  sweep.start(t)
  sub.start(t)
  
  sweep.stop(t + 0.6)
  sub.stop(t + 0.6)
}
