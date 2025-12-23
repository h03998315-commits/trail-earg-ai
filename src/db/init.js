const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dir = process.env.RENDER
  ? "/opt/render/project/src/db"
  : __dirname;

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const dbPath = path.join(dir, "database.sqlite");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      created_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS otps (
      email TEXT,
      code TEXT,
      expires_at INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT,
      created_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT,
      role TEXT,
      content TEXT,
      created_at TEXT
    )
  `);
});

module.exports = db;
