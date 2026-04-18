// src/db/user.model.ts
import { getDB } from './database';
import bcrypt from 'bcrypt';

export async function createUser(username: string, email: string, password: string) {
  const db = getDB();
  const passwordHash = await bcrypt.hash(password, 10);

  await db.run(
    `INSERT INTO users (username, email, password_hash)
     VALUES (?, ?, ?)`,
    [username, email, passwordHash]
  );
}

export async function findUserByEmail(email: string) {
  const db = getDB();
  return db.get(`SELECT * FROM users WHERE email = ?`, [email]);
}
