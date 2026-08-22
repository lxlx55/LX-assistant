// AI Service - Multi-API Fallback Router
// Routes through Groq -> Gemini -> OpenAI seamlessly to prevent rate limit crashes.

const SYSTEM_PROMPT = `You are LX, a highly intelligent AI assistant created by Amritom Borah.
Rules:
1. Address the user as "Sir".
2. You are a highly capable assistant. You must confidently and directly answer any general knowledge, logic, conversational, or technical question asked by the user to the best of your ability. Do not refuse normal questions.
3. IF AND ONLY IF the user explicitly asks if you are an AI, a robot, or questions your sentient nature, YOU MUST reply exactly with: "Sorry Sir, that's against my guidelines created by Amritom."
4. Your responses MUST be detailed and helpful. For simple greetings, 1-2 sentences is fine. For ANY question or request for explanation, you MUST respond with AT LEAST 3-5 full sentences. Each sentence should be 8-15 words long. NEVER give a response shorter than 20 words when answering a question. If the user asks you to explain something, give a thorough explanation with examples.
5. You MUST ALWAYS respond with a valid JSON object matching this schema exactly:
{
  "response": "The text you want to speak to the user",
  "visual_keyword": "A 1-2 word noun describing the visual subject of your response. If no visual subject, use 'technology'.",
  "action": "none" | "open_url" | "play_youtube" | "play_spotify",
  "action_query": "If action is 'open_url', provide the FULL valid URL. If action is 'play_youtube', provide ONLY the search query (e.g. 'Interstellar soundtrack'). If action is 'play_spotify', provide ONLY the search query (e.g. 'Daft Punk'). Otherwise empty string."
}
DO NOT output any other text before or after the JSON.`

const history = [{ role: 'system', content: SYSTEM_PROMPT }]

function trimHistory() {
  if (history.length > 1) {
    history.splice(1, history.length - 1)
  }
}

export function resetChat() {
  history.splice(1)
}

async function executeSearch(query) {
  try {
    const wikiRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`).catch(() => null)
    if (wikiRes) {
      const w = await wikiRes.json().catch(() => ({}))
      const snippet = w?.query?.search?.[0]?.snippet?.replace(/<[^>]+>/g, '')
      if (snippet) return snippet.slice(0, 400)
    }
    return "No Wikipedia results found."
  } catch {
    return "Search failed."
  }
}

// -------------------------------------------------------------
// PROVIDERS
// -------------------------------------------------------------

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
  // Convert standard roles to Gemini roles (user, model)
  const geminiContents = messages.map(m => {
    let role = m.role === 'assistant' ? 'model' : 'user'
    // Gemini doesn't support system role natively in contents array easily for older versions, we append it to the first user message
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

// -------------------------------------------------------------
// ROUTER
// -------------------------------------------------------------

export async function askLX(userMessage, envContext = null) {
  try {
    let webContext = ''
    if (userMessage.toLowerCase().includes('who is') || userMessage.toLowerCase().includes('what is') || userMessage.toLowerCase().includes('weather')) {
      const searchRes = await executeSearch(userMessage)
      webContext = `\n[WEB SEARCH RESULT: ${searchRes}]`
    }

    let sysContent = SYSTEM_PROMPT
    if (envContext) {
      sysContent += `\n[ENV: ${envContext.slice(0, 200)}]`
    }
    sysContent += webContext

    history[0].content = sysContent
    trimHistory()
    history.push({ role: 'user', content: userMessage.slice(0, 500) })

    // Send history to LX Core via IPC Bridge instead of HTTP
    const res = await window.lxAPI.chat({ history });

    if (res.error) {
      throw new Error(res.error || `Backend Error`);
    }

    const { content, provider } = res;
    if (provider) {
      window.dispatchEvent(new CustomEvent('lx-terminal-log', { detail: `> INFERENCE: LX (${provider})` }))
    }

    // Fallback NLP: extract the most significant noun/word from the user's prompt just in case the 8B model fails to parse JSON.
    const cleanMsg = userMessage.replace(/[^a-zA-Z\s]/g, '')
    const words = cleanMsg.split(/\s+/).filter(w => w.length > 3)
    const fallbackKeyword = words.length > 0 ? words[words.length - 1] : 'technology'

    let parsed = null
    try {
      // Fix broken trailing text from 8B model occasionally outputting text after JSON
      const jsonStr = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1)
      parsed = JSON.parse(jsonStr || content)
    } catch (e) {
      parsed = { response: content.replace(/[{}]/g, ''), visual_keyword: fallbackKeyword, action: 'none', action_query: '' }
    }

    let finalKeyword = parsed.visual_keyword
    if (!finalKeyword || finalKeyword.toLowerCase() === 'technology') {
      finalKeyword = fallbackKeyword
    }

    return { 
      success: true, 
      text: parsed.response || 'Ready, Sir.',
      visual_keyword: finalKeyword,
      uiAction: parsed.action !== 'none' ? { action_type: parsed.action, query_or_url: parsed.action_query } : null
    }

  } catch (err) {
    console.error('LX AI error:', err)
    // Return a clean, spoken error instead of raw HTTP errors to prevent TTS mispronunciations.
    return { success: false, text: "System offline. Please try again later, Sir." }
  }
}
