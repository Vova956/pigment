import { Router } from 'express';
import { getDB } from '../db/database';

const router = Router();

function generateSessionId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// POST /sessions — create a new session
router.post('/', async (req, res) => {
  const { name } = req.body;
  const db = getDB();

  let id = generateSessionId();
  // Retry on collision (unlikely but safe)
  for (let i = 0; i < 5; i++) {
    const existing = await db.get('SELECT id FROM sessions WHERE id = ?', id);
    if (!existing) {
      break;
    }
    id = generateSessionId();
  }

  await db.run('INSERT INTO sessions (id, name) VALUES (?, ?)', id, name || null);
  return res.status(201).json({ sessionId: id });
});

// GET /sessions/:id — check if a session exists
router.get('/:id', async (req, res) => {
  const db = getDB();
  const session = await db.get(
    'SELECT id, name, created_at FROM sessions WHERE id = ?',
    req.params.id.toUpperCase()
  );
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  return res.json(session);
});

export default router;
