let sqlite3, open;
try {
  sqlite3 = require('sqlite3').verbose();
  open = require('sqlite').open;
} catch (error) {
  console.warn('SQLite dependencies not found, system database will be disabled:', error.message);
}
const path = require('path');

/**
 * System Database - Handles internal state like chat history and settings using SQLite
 */
class SystemDatabase {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, '..', 'system-state.sqlite');
  }

async initialize() {
    try {
      if (!sqlite3) {
        throw new Error('SQLite3 not available');
      }
      
      // Create database instance
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          throw err;
        }
      });
      
      // Wait for database to be ready
      await new Promise((resolve, reject) => {
        this.db.serialize(() => {
          // Initialize tables
          this.db.run(`
            CREATE TABLE IF NOT EXISTS chat_settings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              setting_name TEXT UNIQUE NOT NULL,
              setting_value TEXT,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
          `, (initErr) => {
            if (initErr) {
              reject(initErr);
            } else {
              // Initialize history table
              this.db.run(`
                CREATE TABLE IF NOT EXISTS chat_history (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  session_id TEXT NOT NULL,
                  user_message TEXT NOT NULL,
                  ai_response TEXT,
                  tables_accessed TEXT,
                  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                );
              `, (historyErr) => {
                if (historyErr) {
                  reject(historyErr);
                } else {
                  // Seed default settings if empty
                  this.db.get('SELECT COUNT(*) as count FROM chat_settings', [], (countErr, row) => {
                    if (countErr) {
                      reject(countErr);
                    } else if (row.count === 0) {
                      const defaults = [
['ollama_url', 'http://ollama:11434'],
                        ['ollama_model', 'deepseek-coder-v2'],
                        ['enable_schema_info', 'true'],
                        ['use_smart_chat', 'true'],
['enabled_tables', ''],
                        ['max_results', '100']
                      ];
                      
                      let completed = 0;
                      const total = defaults.length;
                      
                      defaults.forEach(([name, val]) => {
                        this.db.run(
                          'INSERT INTO chat_settings (setting_name, setting_value) VALUES (?, ?)',
                          [name, val],
                          () => {
                            completed++;
                            if (completed === total) {
                              resolve();
                            }
                          }
                        );
                      });
                    } else {
                      resolve();
                    }
                  });
                }
              });
            }
          });
        });
      });

      // Initialize tables if they don't exist
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS chat_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          setting_name TEXT UNIQUE NOT NULL,
          setting_value TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS chat_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          user_message TEXT NOT NULL,
          ai_response TEXT,
          tables_accessed TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Seed default settings if empty
      const settingsCount = await this.db.get('SELECT COUNT(*) as count FROM chat_settings');
      if (settingsCount.count === 0) {
        const defaults = [
          ['ollama_url', 'http://ollama:11434'],
          ['ollama_model', 'deepseek-coder-v2'],
          ['enable_schema_info', 'true'],
          ['use_smart_chat', 'true'],
          ['enabled_tables', 'products'],
          ['max_results', '100']
        ];
        
        for (const [name, val] of defaults) {
          await this.db.run(
            'INSERT INTO chat_settings (setting_name, setting_value) VALUES (?, ?)',
            [name, val]
          );
        }
      }

      console.log(`System database initialized at ${this.dbPath}`);
      return true;
    } catch (error) {
      console.error('Failed to initialize system database:', error);
      throw error;
    }
  }

async getSettings() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT setting_name, setting_value FROM chat_settings', [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const settings = {};
          rows.forEach(row => {
            settings[row.setting_name] = row.setting_value;
          });
          resolve(settings);
        }
      });
    });
  }

async updateSetting(name, value) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO chat_settings (setting_name, setting_value, updated_at) 
         VALUES (?, ?, CURRENT_TIMESTAMP)`,
        [name, value],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this);
          }
        }
      );
    });
  }

async saveChat(sessionId, userMessage, aiResponse, tablesAccessed = '') {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO chat_history (session_id, user_message, ai_response, tables_accessed) 
         VALUES (?, ?, ?, ?)`,
        [sessionId, userMessage, aiResponse, tablesAccessed],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this);
          }
        }
      );
    });
  }

async getHistory(sessionId, limit = 50) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, user_message, ai_response, tables_accessed, timestamp 
         FROM chat_history 
         WHERE session_id = ? 
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [sessionId, limit],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

async getConversationHistoryForAI(sessionId, limit = 3) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT user_message, ai_response 
         FROM chat_history 
         WHERE session_id = ? 
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [sessionId, limit],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            const messages = [];
            for (const row of rows.reverse()) {
              messages.push({ role: 'user', content: row.user_message });
              messages.push({ role: 'assistant', content: row.ai_response });
            }
            resolve(messages);
          }
        }
      );
    });
  }

async close() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  }
}

module.exports = new SystemDatabase(); // Singleton
