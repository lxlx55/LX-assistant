// LX TTS — Edge TTS Proxy Engine (Ryan Neural)
import { audioCtx, masterCompressor, initAudio } from './audioEffects'

let currentCallId = 0;
let currentSource = null;
let durationInterval = null;

function normalizeForSpeech(text) {
  return text
    .replace(/(\d+)\.(\d+)/g, (_, whole, decimal) => `${whole} point ${decimal}`)
    .replace(/(\d+)\s*%/g, '$1 percent')
    .replace(/°C/gi, ' degrees Celsius')
    .replace(/°F/gi, ' degrees Fahrenheit')
    .replace(/°/g, ' degrees')
    .replace(/km\/h/gi, 'kilometers per hour')
    .replace(/hPa/gi, 'hectopascals')
}

export async function speak(rawText, { onStart, onEnd, onBoundary } = {}) {
  stopSpeaking();
  
  if (!rawText || !rawText.trim()) {
    onEnd?.();
    return;
  }

  currentCallId++;
  const myCallId = currentCallId;
  const text = normalizeForSpeech(rawText);
  
  // Split into chunks to get faster TTFB (time to first byte)
  const sentences = text.match(/[^.!?\n]+[.!?\n]*|\s+$/g)?.map(s => s.trim()).filter(s => s) || [text];
  const chunks = [];
  let currentStr = "";
  
  for (const sentence of sentences) {
      if ((currentStr + " " + sentence).length < 100) {
          currentStr += (currentStr ? " " : "") + sentence;
      } else {
          if (currentStr) chunks.push(currentStr);
          currentStr = sentence;
      }
  }
  if (currentStr) chunks.push(currentStr);

  let currentChunkIdx = 0;
  let searchOffset = 0;

  async function speakNextChunk() {
    if (myCallId !== currentCallId || currentChunkIdx >= chunks.length) {
      if (myCallId === currentCallId && onEnd) onEnd();
      return;
    }

    const chunkText = chunks[currentChunkIdx];
    const chunkStartInOriginal = text.indexOf(chunkText, searchOffset);
    
    // Route through backend proxy over IPC instead of HTTP
    try {
      const base64 = await window.lxAPI.speak(chunkText);
      if (!base64 || typeof base64 !== 'string') return;
      
      if (myCallId !== currentCallId) return;
      
      initAudio(); // Guarantee AudioContext is awake
      
      // Convert base64 to ArrayBuffer
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      audioCtx.decodeAudioData(bytes.buffer, (buffer) => {
        if (myCallId !== currentCallId) return;

        currentSource = audioCtx.createBufferSource();
        currentSource.buffer = buffer;
        currentSource.playbackRate.value = 1.05; // Slightly faster for AI feel
        currentSource.connect(masterCompressor);

        // Word boundary estimation
        const words = chunkText.split(/\s+/);
        let wordIndex = 0;
        const msPerWord = (buffer.duration * 1000) / (words.length * 1.05);
        
        durationInterval = setInterval(() => {
            if (!currentSource || myCallId !== currentCallId) {
                clearInterval(durationInterval);
                return;
            }
            if (wordIndex < words.length && onBoundary) {
                const wordStart = chunkText.indexOf(words[wordIndex]);
                if (wordStart !== -1) {
                    onBoundary(chunkStartInOriginal + wordStart);
                }
                wordIndex++;
            }
        }, msPerWord);

        currentSource.onended = () => {
          clearInterval(durationInterval);
          if (myCallId !== currentCallId) return;
          
          searchOffset = chunkStartInOriginal + chunkText.length;
          if (onBoundary) onBoundary(searchOffset);
          
          currentChunkIdx++;
          speakNextChunk();
        };

        if (currentChunkIdx === 0 && onStart) onStart();
        currentSource.start();

      }, (e) => {
        console.error('[LX TTS] Decode Error:', e);
        if (myCallId === currentCallId) {
          currentChunkIdx++;
          speakNextChunk();
        }
      });

    } catch (e) {
      console.error('[LX TTS] Network Error:', e);
      if (myCallId === currentCallId) {
        currentChunkIdx++;
        speakNextChunk();
      }
    }
  }

  speakNextChunk();
}

export function stopSpeaking() {
  currentCallId++;
  clearInterval(durationInterval);
  if (currentSource) {
    try { currentSource.stop(); } catch(e){}
    try { currentSource.disconnect(); } catch(e){}
    currentSource = null;
  }
}
