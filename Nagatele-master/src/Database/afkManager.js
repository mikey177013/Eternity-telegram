// src/Database/afkManager.js
// AFK (Away From Keyboard) system - SQLite-backed
// Supports multiple chats / groups simultaneously.

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class AfkManager {
  constructor() {
    this.dbPath = path.join(__dirname, 'afk.sqlite');
    this.db = new sqlite3.Database(this.dbPath);
    this.initDatabase();
  }

  initDatabase() {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS afk_status (
          user_id TEXT NOT NULL,
          chat_id TEXT NOT NULL,
          username TEXT,
          first_name TEXT,
          reason TEXT,
          since_timestamp INTEGER NOT NULL,
          mention_count INTEGER DEFAULT 0,
          PRIMARY KEY (user_id, chat_id)
        )
      `);

      this.db.run(`CREATE INDEX IF NOT EXISTS idx_afk_chat ON afk_status(chat_id)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_afk_user ON afk_status(user_id)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_afk_username ON afk_status(username)`);
    });
    console.log('✅ AFK database initialized');
  }

  /**
   * Set user as AFK for a specific chat.
   */
  async setAfk(userId, chatId, reason, userInfo = {}) {
    const uid = String(userId);
    const cid = String(chatId);
    const ts = Date.now();
    const username = (userInfo.username || '').toLowerCase() || null;
    const firstName = userInfo.first_name || null;

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO afk_status
           (user_id, chat_id, username, first_name, reason, since_timestamp, mention_count)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [uid, cid, username, firstName, reason || null, ts],
        function (err) {
          if (err) reject(err);
          else resolve({ user_id: uid, chat_id: cid, reason, since_timestamp: ts, mention_count: 0 });
        }
      );
    });
  }

  /**
   * Get AFK record for (user, chat). Returns null if not AFK.
   */
  async getAfk(userId, chatId) {
    const uid = String(userId);
    const cid = String(chatId);
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM afk_status WHERE user_id = ? AND chat_id = ?`,
        [uid, cid],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  /**
   * Get AFK record by username for a specific chat (used for @mention lookups).
   */
  async getAfkByUsername(username, chatId) {
    if (!username) return null;
    const uname = String(username).toLowerCase();
    const cid = String(chatId);
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM afk_status WHERE username = ? AND chat_id = ?`,
        [uname, cid],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  /**
   * Remove an AFK record.
   * Returns true if a row was deleted.
   */
  async removeAfk(userId, chatId) {
    const uid = String(userId);
    const cid = String(chatId);
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM afk_status WHERE user_id = ? AND chat_id = ?`,
        [uid, cid],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  /**
   * Increment mention count for an AFK user.
   */
  async incrementMention(userId, chatId) {
    const uid = String(userId);
    const cid = String(chatId);
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE afk_status SET mention_count = mention_count + 1
         WHERE user_id = ? AND chat_id = ?`,
        [uid, cid],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  /**
   * List all AFK users in a chat.
   */
  async listAfk(chatId) {
    const cid = String(chatId);
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM afk_status WHERE chat_id = ?`,
        [cid],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Convert a millisecond duration to a human-readable string.
   */
  humanDuration(ms) {
    if (!ms || ms < 0) return '0s';
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 && days === 0) parts.push(`${secs}s`);

    return parts.length ? parts.join(' ') : '0s';
  }

  close() {
    this.db.close();
  }
}

module.exports = new AfkManager();
