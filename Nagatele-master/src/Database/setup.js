const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    const dbPath = path.join(__dirname, 'users.sqlite');
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Database connection error:', err.message);
      } else {
        console.log('✅ Connected to SQLite database');
        this.createTables();
      }
    });
  }

  createTables() {
    const queries = [
      // Users table (existing)
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        username TEXT,
        phone_number TEXT NOT NULL,
        full_name TEXT,
        registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Group Settings table (NEW - for welcome/goodbye)
      `CREATE TABLE IF NOT EXISTS group_settings (
        chat_id TEXT PRIMARY KEY,
        welcome_enabled INTEGER DEFAULT 1,
        goodbye_enabled INTEGER DEFAULT 1,
        welcome_message TEXT DEFAULT '',
        goodbye_message TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Welcome tracking table (NEW - to prevent duplicate welcomes)
      `CREATE TABLE IF NOT EXISTS welcome_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        welcomed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(chat_id, user_id)
      )`,
      
      `CREATE INDEX IF NOT EXISTS idx_user_id ON users(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_welcome_tracking ON welcome_tracking(chat_id, user_id)`
    ];

    queries.forEach((query, index) => {
      this.db.run(query, (err) => {
        if (err) {
          console.error(`❌ Error creating table ${index + 1}:`, err.message);
        }
      });
    });
    
    console.log('✅ All database tables initialized (including welcome/goodbye system)');
  }

  // Check if user is registered
  async isUserRegistered(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as count FROM users WHERE user_id = ?',
        [userId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row.count > 0);
          }
        }
      );
    });
  }

  // Register a new user
  async registerUser(userId, username, phoneNumber, fullName) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO users (user_id, username, phone_number, full_name) 
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
         phone_number = excluded.phone_number,
         last_seen = CURRENT_TIMESTAMP`,
        [userId, username, phoneNumber, fullName],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ success: true, id: this.lastID });
          }
        }
      );
    });
  }

  // Get user info
  async getUser(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE user_id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  // Get user by Telegram ID
  async getUserByTelegramId(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE user_id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  // Search users by name or username
  async searchUsers(searchTerm) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM users 
         WHERE username LIKE ? 
            OR full_name LIKE ? 
            OR phone_number LIKE ?
         ORDER BY registered_at DESC`,
        [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // Get all registered users (for admin)
  async getAllRegisteredUsers(limit = 100) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM users ORDER BY registered_at DESC LIMIT ?',
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // Update last seen
  async updateLastSeen(userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE user_id = ?',
        [userId],
        (err) => {
          if (err) reject(err);
          else resolve(true);
        }
      );
    });
  }

  // Get total registered users
  async getTotalUsers() {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as count FROM users',
        [],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });
  }

  // ==================== NEW METHODS FOR WELCOME/GOODBYE SYSTEM ====================
  
  // Get group settings
  async getGroupSettings(chatId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM group_settings WHERE chat_id = ?',
        [chatId],
        (err, row) => {
          if (err) reject(err);
          else if (row) resolve(row);
          else {
            // Create default settings if not exists
            this.db.run(
              'INSERT INTO group_settings (chat_id) VALUES (?)',
              [chatId],
              function(err2) {
                if (err2) reject(err2);
                else resolve({
                  chat_id: chatId,
                  welcome_enabled: 1,
                  goodbye_enabled: 1,
                  welcome_message: '',
                  goodbye_message: ''
                });
              }
            );
          }
        }
      );
    });
  }

  // Update group settings
  async updateGroupSettings(chatId, updates) {
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    
    values.push(chatId);
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE group_settings SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  // Check if user was already welcomed
  async checkAlreadyWelcomed(chatId, userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as count FROM welcome_tracking WHERE chat_id = ? AND user_id = ?',
        [chatId, userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count > 0);
        }
      );
    });
  }

  // Mark user as welcomed
  async markAsWelcomed(chatId, userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO welcome_tracking (chat_id, user_id) VALUES (?, ?)',
        [chatId, userId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  // Clear welcome history
  async clearWelcomeHistory(chatId, userId = null) {
    if (userId) {
      return new Promise((resolve, reject) => {
        this.db.run(
          'DELETE FROM welcome_tracking WHERE chat_id = ? AND user_id = ?',
          [chatId, userId],
          function(err) {
            if (err) reject(err);
            else resolve(this.changes > 0);
          }
        );
      });
    } else {
      return new Promise((resolve, reject) => {
        this.db.run(
          'DELETE FROM welcome_tracking WHERE chat_id = ?',
          [chatId],
          function(err) {
            if (err) reject(err);
            else resolve(this.changes);
          }
        );
      });
    }
  }

  // Close database connection
  close() {
    this.db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed');
      }
    });
  }
}

module.exports = Database;