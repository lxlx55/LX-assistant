import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import ttsRoute from './routes/tts.js';
import chatRoute from './routes/chat.js';
import transcribeRoute from './routes/transcribe.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/tts', ttsRoute);
app.use('/api/chat', chatRoute);
app.use('/api/transcribe', transcribeRoute);

// Start server
app.listen(PORT, () => {
  console.log(`[Backend] Server listening on port ${PORT}`);
});
