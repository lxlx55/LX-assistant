import fetch from 'node-fetch';

const OLLAMA_URL = 'http://localhost:11434';
const MODEL_NAME = 'qwen2.5-coder:7b';

export async function isOllamaAvailable() {
  try {
    // Check if Ollama is running and has the model
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.models.some(m => m.name === MODEL_NAME || m.name.startsWith(MODEL_NAME));
  } catch {
    return false; // Connection refused or timeout
  }
}

import { searchWeb, needsWebSearch } from './tools/index.js';

export async function chatWithOllama(history) {
  const lastUserMsg = history[history.length - 1];
  let searchContext = '';

  // Auto web search if user query needs live internet data
  if (lastUserMsg && lastUserMsg.role === 'user' && needsWebSearch(lastUserMsg.content)) {
    try {
      const searchResults = await searchWeb(lastUserMsg.content, 4);
      if (searchResults && searchResults.length > 0) {
        searchContext = `\n\n[LIVE WEB SEARCH RESULTS]:\n` + 
          searchResults.map((r, i) => `${i + 1}. ${r.title}\n   Snippet: ${r.snippet}\n   URL: ${r.url}`).join('\n');
        console.log('[LX Ollama] Successfully injected web search context.');
      }
    } catch (err) {
      console.warn('[LX Ollama] Web search failed, proceeding without search context:', err.message);
    }
  }

  const systemPrompt = {
    role: 'system',
    content: "You are LX, a highly intelligent, sharp, and confident local AI assistant created by Amritom Borah. You run natively on Amritom's Windows PC using an RTX 4050 GPU. When live web search results are provided in the context, use them to provide up-to-date, accurate facts. Keep answers concise, confident, and direct."
  };

  // Inject search context into last user message if present
  const updatedHistory = history.map((msg, index) => {
    if (index === history.length - 1 && msg.role === 'user' && searchContext) {
      return { ...msg, content: msg.content + searchContext };
    }
    return msg;
  });

  const messages = [systemPrompt, ...updatedHistory];

  console.log(`[LX] Routing to Local Ollama (${MODEL_NAME})...`);
  
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: messages,
      stream: false,
      options: {
        num_predict: 300 // Snappy & detailed
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}`);
  }

  const data = await res.json();
  
  return {
    content: data.message.content,
    provider: searchContext ? 'Ollama (Local + Web Search)' : 'Ollama (Local)'
  };
}
