import express from 'express';
import multer from 'multer';
import FormData from 'form-data';
import fetch from 'node-fetch';

const router = express.Router();

// Multer handles the incoming multipart/form-data from the frontend
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  const groqKey = process.env.VITE_GROQ_API_KEY;
  if (!groqKey) {
    return res.status(500).json({ error: 'Groq API Key not configured on backend' });
  }

  try {
    const formData = new FormData();
    // Append the buffer directly. form-data requires a filename for buffers.
    formData.append('file', req.file.buffer, { filename: 'audio.webm', contentType: 'audio/webm' });
    formData.append('model', 'whisper-large-v3-turbo');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Groq STT Error: ${response.status}`);
    }

    const data = await response.json();
    res.json({ text: data.text });
  } catch (err) {
    console.error('[Transcribe] STT Error:', err);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});

export default router;
