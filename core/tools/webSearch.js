import fetch from 'node-fetch';

/**
 * Keyless real-time web search using DuckDuckGo HTML endpoint.
 * Returns structured search results (title, snippet, url).
 */
export async function searchWeb(query, maxResults = 5) {
  try {
    console.log(`[LX Tool] Searching live web for: "${query}"`);
    
    // DuckDuckGo HTML endpoint
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo Search HTTP ${response.status}`);
    }

    const html = await response.text();
    const results = [];

    // Simple regex parser for DuckDuckGo HTML snippets
    const resultRegex = /<a class="result__url" href="([^"]+)".*?>[\s\S]*?<a class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    const titleRegex = /<a class="result__a"[^>]*>([\s\S]*?)<\/a>/g;

    const titles = [];
    let titleMatch;
    while ((titleMatch = titleRegex.exec(html)) !== null) {
      const cleanTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
      if (cleanTitle) titles.push(cleanTitle);
    }

    const snippetMatches = [...html.matchAll(/<a class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g)];
    const urlMatches = [...html.matchAll(/<a class="result__url" href="([^"]+)"/g)];

    for (let i = 0; i < Math.min(titles.length, maxResults); i++) {
      const rawUrl = urlMatches[i] ? urlMatches[i][1].trim() : '';
      // Decode DuckDuckGo redirect URL if present
      let cleanUrl = rawUrl;
      if (rawUrl.includes('uddg=')) {
        const match = rawUrl.match(/uddg=([^&]+)/);
        if (match) cleanUrl = decodeURIComponent(match[1]);
      }
      
      const snippet = snippetMatches[i] 
        ? snippetMatches[i][1].replace(/<[^>]+>/g, '').trim() 
        : '';

      if (titles[i] && snippet) {
        results.push({
          title: titles[i],
          snippet: snippet,
          url: cleanUrl
        });
      }
    }

    // Fallback if HTML regex parsing finds few results
    if (results.length === 0) {
      return fallbackSearch(query);
    }

    return results;
  } catch (error) {
    console.error('[LX Tool Error] Web search failed:', error.message);
    return fallbackSearch(query);
  }
}

/**
 * Fallback search via DuckDuckGo Instant Answer API
 */
async function fallbackSearch(query) {
  try {
    const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(apiUrl);
    const data = await res.json();
    
    const results = [];
    if (data.AbstractText) {
      results.push({
        title: data.Heading || query,
        snippet: data.AbstractText,
        url: data.AbstractURL || ''
      });
    }
    
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 3)) {
        if (topic.Text) {
          results.push({
            title: topic.FirstURL ? topic.FirstURL.split('/').pop().replace(/_/g, ' ') : query,
            snippet: topic.Text,
            url: topic.FirstURL || ''
          });
        }
      }
    }
    
    return results;
  } catch {
    return [{ title: 'Search Offline', snippet: 'Unable to reach search engine.', url: '' }];
  }
}
