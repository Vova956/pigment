import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";

let db: Database<sqlite3.Database, sqlite3.Statement>;

export async function initDB() {
  db = await open({
    filename: "./pigment.db",
    driver: sqlite3.Database,
  });

  return db;
}

export function getDB() {
  if (!db) {
    initDB();
  }
  return db;
}