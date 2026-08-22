import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

async function callOpenAIFormat(url, key, model, messages, enforceJson = true) {
  const bodyPayload = {
    model: model,
    messages: messages,
    temperature: 0.7,
    max_tokens: 300
  }
  if (enforceJson) {
    bodyPayload.response_format = { type: "json_object" }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bodyPayload),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data?.choices?.[0]?.message?.content
}

async function callGeminiFormat(key, messages) {
  const geminiContents = messages.map(m => {
    let role = m.role === 'assistant' ? 'model' : 'user'
    return { role: role, parts: [{ text: m.content }] }
  })
  
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: geminiContents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
        responseMimeType: "application/json"
      }
    })
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text
}

router.post('/', async (req, res) => {
  const { history } = req.body;
  
  if (!history || !Array.isArray(history)) {
    return res.status(400).json({ error: 'History array is required' });
  }

  const keys = {
    groq: process.env.VITE_GROQ_API_KEY,
    gemini: process.env.VITE_GEMINI_API_KEY,
    openai: process.env.VITE_OPENAI_API_KEY,
    nvidia: process.env.VITE_NVIDIA_API_KEY
  };

  let content = null;
  let lastError = null;
  let provider = '';

  // 1. Try NVIDIA (Llama 3.1 70B) First
  if (keys.nvidia && !content) {
    try {
      content = await callOpenAIFormat('https://integrate.api.nvidia.com/v1/chat/completions', keys.nvidia, 'meta/llama-3.1-70b-instruct', history, false);
      provider = 'PRIMARY CORE';
    } catch (e) {
      lastError = e;
    }
  }

  // 2. Try Groq (Llama 3.3 70B)
  if (keys.groq && keys.groq !== 'your_api_key_here' && !content) {
    try {
      content = await callOpenAIFormat('https://api.groq.com/openai/v1/chat/completions', keys.groq, 'llama-3.3-70b-versatile', history);
      provider = 'SECONDARY CORE';
    } catch (e) {
      lastError = e;
    }
  }

  // 3. Try OpenAI
  if (keys.openai && !content) {
    try {
      content = await callOpenAIFormat('https://api.openai.com/v1/chat/completions', keys.openai, 'gpt-4o-mini', history);
      provider = 'TERTIARY CORE';
    } catch (e) {
      lastError = e;
    }
  }

  // 4. Try Groq Fallback (Llama 3 8B)
  if (keys.groq && keys.groq !== 'your_api_key_here' && !content) {
    try {
      content = await callOpenAIFormat('https://api.groq.com/openai/v1/chat/completions', keys.groq, 'llama-3.1-8b-instant', history, false);
      provider = 'QUATERNARY CORE';
    } catch (e) {
      lastError = e;
    }
  }

  // 5. Try Gemini (Last Resort)
  if (keys.gemini && !content) {
    try {
      content = await callGeminiFormat(keys.gemini, history);
      provider = 'QUINARY CORE';
    } catch (e) {
      lastError = e;
    }
  }

  if (!content) {
    return res.status(503).json({ error: 'All API uplinks congested', details: lastError?.message });
  }

  res.json({ content, provider });
});

export default router;
