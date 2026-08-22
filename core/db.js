import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;

/**
 * Initialize the SQLite database.
 * The database file is stored in the app's userData directory so it persists across updates.
 */
export function initDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'lx_memory.db');
  
  console.log(`[LX Memory] Database location: ${dbPath}`);
  
  db = new Database(dbPath);
  
  // Enable WAL mode for better concurrent read/write performance
  db.pragma('journal_mode = WAL');
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      provider TEXT DEFAULT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp);
    
    CREATE TABLE IF NOT EXISTS memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  console.log('[LX Memory] Database initialized.');
  return db;
}

/**
 * Get the current session ID. A new session is created each time the app launches.
 */
let currentSessionId = null;
export function getSessionId() {
  if (!currentSessionId) {
    currentSessionId = `session_${Date.now()}`;
  }
  return currentSessionId;
}

/**
 * Save a message to the conversations table.
 */
export function saveMessage(role, content, provider = null) {
  if (!db) return;
  const stmt = db.prepare(
    'INSERT INTO conversations (session_id, role, content, provider) VALUES (?, ?, ?, ?)'
  );
  stmt.run(getSessionId(), role, content, provider);
}

/**
 * Get the last N messages across all sessions (for context continuity).
 */
export function getRecentMessages(limit = 50) {
  if (!db) return [];
  const stmt = db.prepare(
    'SELECT role, content, provider, timestamp FROM conversations ORDER BY id DESC LIMIT ?'
  );
  const rows = stmt.all(limit);
  // Reverse so they're in chronological order
  return rows.reverse();
}

/**
 * Get all messages from the current session.
 */
export function getSessionMessages() {
  if (!db) return [];
  const stmt = db.prepare(
    'SELECT role, content, provider, timestamp FROM conversations WHERE session_id = ? ORDER BY id ASC'
  );
  return stmt.all(getSessionId());
}

/**
 * Clear all conversation history.
 */
export function clearHistory() {
  if (!db) return;
  db.exec('DELETE FROM conversations');
  console.log('[LX Memory] All conversation history cleared.');
}

/**
 * Store a key-value pair in persistent memory (for user preferences, facts, etc.)
 */
export function setMemory(key, value) {
  if (!db) return;
  const stmt = db.prepare(
    'INSERT INTO memory (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
  );
  stmt.run(key, typeof value === 'string' ? value : JSON.stringify(value));
}

/**
 * Retrieve a value from persistent memory.
 */
export function getMemory(key) {
  if (!db) return null;
  const stmt = db.prepare('SELECT value FROM memory WHERE key = ?');
  const row = stmt.get(key);
  return row ? row.value : null;
}

/**
 * Get conversation stats.
 */
export function getStats() {
  if (!db) return {};
  const totalMessages = db.prepare('SELECT COUNT(*) as count FROM conversations').get().count;
  const totalSessions = db.prepare('SELECT COUNT(DISTINCT session_id) as count FROM conversations').get().count;
  const firstMessage = db.prepare('SELECT timestamp FROM conversations ORDER BY id ASC LIMIT 1').get();
  return {
    totalMessages,
    totalSessions,
    firstInteraction: firstMessage?.timestamp || null
  };
}
