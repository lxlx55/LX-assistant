// Deep Root Solution: Groq Whisper STT API
// Restored due to native browser recognition failure.
// Uses whisper-large-v3-turbo for much faster response times and better accent handling.

const BACKEND_STT_URL = 'http://localhost:3000/api/transcribe'
const SILENCE_TIMEOUT = 2000 // Increased to 2.0s so it doesn't cut off when taking a breath
const MIN_AUDIO_LENGTH = 400  // Minimum recording duration in ms to catch quick responses like "Yes"
const VOLUME_THRESHOLD = 0.007 // Sweet spot: ignores room hum but captures quiet speech continuously

const WHISPER_HALLUCINATIONS = [
  'thank you.', 'thank you', 'thanks.', 'thanks',
  'thanks for watching.', 'thanks for watching',
  'please subscribe.', 'please subscribe', 'subscribe.', 'subscribe',
  'bye.', 'bye', 'goodbye.', 'goodbye', 'you.', 'you',
  'amritom.', 'lx.', 'hello.', 'hello',
  'hello sir.', 'hello sir', 'sir.', 'sir', 'hello, sir.', 'hello, sir',
  'lx is speaking to lx.', 'lx is speaking to lx',
  'hmm.', 'hmm', 'hm.', 'hm', 'uh.', 'uh', 'um.', 'um',
  'oh.', 'oh', 'ah.', 'ah', 'i\'m sorry.', 'yeah.', 'yeah',
  'the end.', 'the end', 'so.', 'so', 'and.', 'and',
  'silence.', 'silence', '...', '.', ''
]

export class LXMicrophone {
  constructor({ apiKey, onTranscript, onStateChange, onError }) {
    this.apiKey = apiKey
    this.onTranscript = onTranscript
    this.onStateChange = onStateChange
    this.onError = onError

    this.stream = null
    this.audioCtx = null
    this.analyser = null
    this.recorder = null
    this.chunks = []
    
    this.isPaused = false
    this.silenceTimer = null
    this.monitorRAF = null
    this.recordStart = 0
    this.isRecording = false
    this.isDestroyed = false
    this.lastTranscribeTime = 0
  }

  async start() {
    this.isDestroyed = false;
    this.isPaused = false;
    await this._acquireHardwareStream();
  }

  async _acquireHardwareStream() {
    if (this.isDestroyed || this.isPaused) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
    } catch (err) {
      this.onError?.('Microphone access denied. Please allow it.')
      return
    }

    if (this.isDestroyed || this.isPaused) {
      this._releaseHardwareStream();
      return;
    }

    this.onStateChange?.('listening')

    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const source = this.audioCtx.createMediaStreamSource(this.stream)
    this.analyser = this.audioCtx.createAnalyser()
    this.analyser.fftSize = 512
    this.analyser.smoothingTimeConstant = 0.3
    source.connect(this.analyser)

    this._monitorAudio()
  }

  _releaseHardwareStream() {
    cancelAnimationFrame(this.monitorRAF)
    clearTimeout(this.silenceTimer)
    
    if (this.recorder && this.recorder.state !== 'inactive') {
      try { this.recorder.stop() } catch(_) {}
    }
    this.recorder = null
    this.chunks = []
    this.isRecording = false

    this.stream?.getTracks().forEach(t => t.stop())
    this.stream = null

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {})
    }
    this.audioCtx = null
    this.analyser = null
  }

  pause() {
    if (this.isPaused) return;
    this.isPaused = true
    this.onStateChange?.('paused')
    this._releaseHardwareStream()
  }

  resume() {
    if (!this.isPaused || this.isDestroyed) return;
    this.isPaused = false
    this.onStateChange?.('listening')
    this._acquireHardwareStream()
  }

  destroy() {
    this.isDestroyed = true
    this.pause()
  }

  _startRecording() {
    if (this.isRecording || !this.stream || this.isPaused) return

    const alive = this.stream.getAudioTracks().some(t => t.readyState === 'live')
    if (!alive) return

    this.chunks = []
    this.recordStart = Date.now()

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm' : ''

    try {
      this.recorder = mimeType 
        ? new MediaRecorder(this.stream, { mimeType })
        : new MediaRecorder(this.stream)
    } catch (e) {
      console.error('[LX STT] Failed to create MediaRecorder', e)
      return
    }

    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0 && !this.isPaused) {
        this.chunks.push(e.data)
      }
    }

    this.recorder.start(100)
    this.isRecording = true
    this.onStateChange?.('recording')
  }

  _monitorAudio() {
    if (!this.analyser || this.isDestroyed || this.isPaused) return

    const data = new Float32Array(this.analyser.fftSize)
    this.analyser.getFloatTimeDomainData(data)

    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
    const rms = Math.sqrt(sum / data.length)

    if (rms > VOLUME_THRESHOLD) {
      if (!this.isRecording) {
        this._startRecording()
      }
      
      clearTimeout(this.silenceTimer)
      this.silenceTimer = setTimeout(() => {
        if (this.isRecording) {
          this._stopAndTranscribe()
        }
      }, SILENCE_TIMEOUT)
    }

    this.monitorRAF = requestAnimationFrame(() => this._monitorAudio())
  }

  async _stopAndTranscribe() {
    if (!this.isRecording) return

    this.isRecording = false
    this.onStateChange?.('processing')
    clearTimeout(this.silenceTimer)

    const duration = Date.now() - this.recordStart

    if (this.isPaused || !this.recorder) {
      this.chunks = []
      return
    }

    if (this.recorder.state !== 'inactive') {
      try { this.recorder.stop() } catch(_) {}
    }

    if (duration < MIN_AUDIO_LENGTH || this.chunks.length === 0) {
      this.chunks = []
      if (!this.isPaused) this.onStateChange?.('listening')
      return
    }

    const blob = new Blob(this.chunks, { type: this.chunks[0]?.type || 'audio/webm' })
    this.chunks = []
    this.recorder = null

    if (blob.size < 2000) {
      if (!this.isPaused) this.onStateChange?.('listening')
      return
    }

    this.lastTranscribeTime = Date.now()

    try {
      const buffer = await blob.arrayBuffer();
      let res = await window.lxAPI.transcribe(buffer);

      if (res.error) {
        if (res.error.includes('429')) {
          this.onError?.('STT RATE LIMIT. COOLING DOWN.')
          setTimeout(() => {
            if (!this.isPaused) this.onStateChange?.('listening')
          }, 5000)
        } else {
          console.warn(`[LX STT] API Error: ${res.error}`)
          if (!this.isPaused) this.onStateChange?.('listening')
        }
        return
      }

      const text = res?.text?.trim()

      if (this.isPaused) return

      const lowerText = (text || '').toLowerCase()
      if (lowerText.length < 2 || WHISPER_HALLUCINATIONS.includes(lowerText)) {
        if (!this.isPaused) this.onStateChange?.('listening')
        return
      }

      if (text && text.length > 1) {
        this.onTranscript?.(text)
      } else {
        if (!this.isPaused) this.onStateChange?.('listening')
      }
    } catch (err) {
      console.error('[LX STT] Transcription error:', err)
      if (!this.isPaused) this.onStateChange?.('listening')
    }
  }
}
