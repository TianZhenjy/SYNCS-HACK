// db.js
const Database = require('better-sqlite3');
const db = new Database('tiktok.db');

db.pragma('journal_mode = wal');

db.prepare(`
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    likes INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

module.exports = db;