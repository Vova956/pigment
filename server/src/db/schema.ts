// src/db/schema.ts
import { getDB } from './database';

export async function createTables() {
  const db = getDB();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Persisted canvas state. Stored as JSON blobs per session so the
    -- schema survives client-side type changes (strokes, images, texts, layers).
    CREATE TABLE IF NOT EXISTS session_state (
      session_id TEXT PRIMARY KEY,
      -- JSON: { layers: Record<string, LayerData>, images: CanvasImage[], texts: CanvasText[] }
      snapshot TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
  `);
}
