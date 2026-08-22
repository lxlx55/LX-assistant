import express from 'express';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const router = express.Router();

let ttsInstance = null;

async function getEdgeTTS() {
  if (!ttsInstance) {
    ttsInstance = new MsEdgeTTS();
    await ttsInstance.setMetadata("en-GB-RyanNeural", OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  }
  return ttsInstance;
}

router.get('/', async (req, res) => {
  const text = req.query.text;
  if (!text) {
    return res.status(400).send('Missing text');
  }

  try {
    const tts = await getEdgeTTS();
    res.setHeader('Content-Type', 'audio/mpeg');
    
    const { audioStream } = await tts.toStream(text);
    audioStream.pipe(res);
    
    audioStream.on('error', (err) => {
      console.error('[TTS] Stream Error:', err);
      res.end();
    });
  } catch (err) {
    console.error('[TTS] Backend Proxy Error:', err);
    res.status(500).send('TTS Error');
  }
});

export default router;
