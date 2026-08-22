import { searchWeb } from './webSearch.js';
import { getSystemHardwareInfo } from './systemInfo.js';

export { searchWeb, getSystemHardwareInfo };

/**
 * Determine if a user query requires real-time web search
 */
export function needsWebSearch(userMessage) {
  const text = userMessage.toLowerCase();
  const keywords = [
    'search', 'google', 'latest', 'news', 'weather', 'today', 'price',
    'who is', 'what is', 'when did', 'where is', 'current', 'score',
    'winner', 'match', 'release', 'update', 'movie', 'event', 'stock'
  ];
  return keywords.some(kw => text.includes(kw));
}
