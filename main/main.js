import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import FormData from 'form-data';

// Load root .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Boot Express Backend in the main process (Phase 1B)
import '../core/server.js';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    frame: true,
    backgroundColor: '#050101',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../ui/dist/index.html'));
  }
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let ttsInstance = null;
async function getEdgeTTS() {
  if (!ttsInstance) {
    ttsInstance = new MsEdgeTTS();
    await ttsInstance.setMetadata("en-GB-RyanNeural", OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  }
  return ttsInstance;
}

import { isOllamaAvailable, chatWithOllama } from '../core/ollama.js';
import { initDatabase, saveMessage, getRecentMessages, clearHistory, getStats, setMemory, getMemory } from '../core/db.js';

// Phase 1C & Phase 3 & Phase 4: IPC Bridge handlers
ipcMain.handle('lx:chat', async (event, data) => {
  try {
    // Phase 4: Save the user's message to persistent memory
    const lastUserMsg = data.history[data.history.length - 1];
    if (lastUserMsg && lastUserMsg.role === 'user') {
      saveMessage('user', lastUserMsg.content);
    }

    let result;

    // Phase 3: Local Offline AI first
    if (await isOllamaAvailable()) {
      result = await chatWithOllama(data.history);
    } else {
      // Fallback to Express backend (Cloud API) if Ollama is offline
      console.log('[LX] Ollama offline. Falling back to Cloud API...');
      const res = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      result = await res.json();
    }

    // Phase 4: Save the AI's response to persistent memory
    if (result && result.content) {
      saveMessage('assistant', result.content, result.provider || null);
    }

    return result;
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('lx:transcribe', async (event, arrayBuffer) => {
  try {
    const groqKey = process.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error('Groq API Key missing');

    const formData = new FormData();
    const buffer = Buffer.from(arrayBuffer);
    formData.append('file', buffer, { filename: 'audio.webm', contentType: 'audio/webm' });
    formData.append('model', 'whisper-large-v3-turbo');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!res.ok) throw new Error(`STT Error: ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error(e);
    return { error: e.message };
  }
});

ipcMain.handle('lx:speak', async (event, text) => {
  try {
    const tts = await getEdgeTTS();
    const { audioStream } = await tts.toStream(text);
    
    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    
    // Return base64 string because binary Buffers sometimes get stripped by IPC context isolation
    const buffer = Buffer.concat(chunks);
    return buffer.toString('base64');
  } catch (e) {
    console.error(e);
    return { error: e.message };
  }
});

ipcMain.handle('lx:status', async () => {
  const ollamaOnline = await isOllamaAvailable();
  const stats = getStats();
  return {
    status: 'LX Core Online',
    mode: 'Electron IPC',
    ollamaOnline,
    memory: stats
  };
});

// Phase 4: Memory IPC handlers
ipcMain.handle('lx:getHistory', (event, limit) => {
  return getRecentMessages(limit || 50);
});

ipcMain.handle('lx:clearHistory', () => {
  clearHistory();
  return { success: true };
});

import { searchWeb, getSystemHardwareInfo } from '../core/tools/index.js';

// Phase 5: Tools IPC Handlers
ipcMain.handle('lx:search', async (event, query) => {
  return await searchWeb(query);
});

ipcMain.handle('lx:systemInfo', () => {
  return getSystemHardwareInfo();
});

ipcMain.handle('lx:getStats', () => {
  return getStats();
});

app.whenReady().then(() => {
  // Phase 4: Initialize the database before creating the window
  initDatabase();
  console.log('[LX] Memory system online.');

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
