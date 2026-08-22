// Image Search Service — Uses Wikimedia Action API for instant, relevant images.
// No API key needed. Lightning fast CDN. CORS enabled with origin=*.

const STOP_WORDS = new Set([
  'sir','the','a','an','is','are','was','were','be','been','am','do','does',
  'did','have','has','had','will','would','could','should','may','might',
  'shall','can','to','of','in','for','on','with','at','by','from','it',
  'its','this','that','these','those','i','you','he','she','we','they',
  'me','him','her','us','them','my','your','his','our','their','what',
  'which','who','whom','how','when','where','why','not','no','yes','so',
  'if','but','and','or','just','also','very','really','quite','about',
  'here','there','hello','hi','hey','sure','okay','ok','well','like',
  'think','know','say','said','tell','told','see','saw','look','get',
  'got','go','going','went','come','came','make','made','take','took',
  'give','gave','let','some','any','all','each','every','much','many',
  'more','most','other','than','then','now','still','already','too',
  'up','down','out','off','over','under','between','into','through'
])

function extractKeywords(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/)
  return words.filter(w => w.length > 2 && !STOP_WORDS.has(w))
}

async function fetchWikipediaImage(term) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrlimit=5&prop=pageimages&format=json&pithumbsize=600&origin=*`
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000) // 3 second hard timeout
    
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    
    if (!res.ok) return null
    
    const data = await res.json()
    const pages = data?.query?.pages
    if (!pages) return null
    
    for (const pageId in pages) {
      if (pages[pageId]?.thumbnail?.source) {
        return pages[pageId].thumbnail.source
      }
    }
    return null
  } catch (e) {
    return null
  }
}

export async function fetchReferenceImage(query) {
  try {
    if (!query) return null

    const keywords = extractKeywords(query)
    if (keywords.length === 0) return null

    // Fire off Wikipedia searches for the top 2 keywords IN PARALLEL for maximum speed
    const searchPromises = keywords.slice(0, 2).map(term => fetchWikipediaImage(term))
    const results = await Promise.all(searchPromises)
    
    const validImg = results.find(img => img !== null)
    if (validImg) {
      return { urls: [validImg] }
    }

    // Fallback: Pollinations AI (using turbo model for extreme speed)
    const seed = Math.floor(Math.random() * 1000000)
    const fallbackPrompt = keywords.slice(0, 3).join(' ')
    const fallback = `https://image.pollinations.ai/prompt/${encodeURIComponent(fallbackPrompt)}?width=480&height=288&nologo=true&seed=${seed}&model=turbo`
    return { urls: [fallback] }

  } catch (e) {
    console.error('[LX Image Search] Error:', e)
    return null
  }
}
