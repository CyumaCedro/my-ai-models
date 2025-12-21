const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
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
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database
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
          ['ollama_url', 'http://192.168.1.70:11434'],
          ['ollama_model', 'deepseek-coder-v2'],
          ['enable_schema_info', 'true'],
          ['use_smart_chat', 'true'],
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
    const rows = await this.db.all('SELECT setting_name, setting_value FROM chat_settings');
    const settings = {};
    rows.forEach(row => {
      settings[row.setting_name] = row.setting_value;
    });
    return settings;
  }

  async updateSetting(name, value) {
    await this.db.run(
      `INSERT INTO chat_settings (setting_name, setting_value) 
       VALUES (?, ?) 
       ON CONFLICT(setting_name) DO UPDATE SET 
       setting_value = excluded.setting_value, 
       updated_at = CURRENT_TIMESTAMP`,
      [name, value]
    );
  }

  async saveChat(sessionId, userMessage, aiResponse, tablesAccessed = '') {
    await this.db.run(
      `INSERT INTO chat_history (session_id, user_message, ai_response, tables_accessed) 
       VALUES (?, ?, ?, ?)`,
      [sessionId, userMessage, aiResponse, tablesAccessed]
    );
  }

  async getHistory(sessionId, limit = 50) {
    return await this.db.all(
      `SELECT id, user_message, ai_response, tables_accessed, timestamp 
       FROM chat_history 
       WHERE session_id = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [sessionId, limit]
    );
  }

  async getConversationHistoryForAI(sessionId, limit = 3) {
    const rows = await this.db.all(
      `SELECT user_message, ai_response 
       FROM chat_history 
       WHERE session_id = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [sessionId, limit]
    );
    
    const messages = [];
    for (const row of rows.reverse()) {
      messages.push({ role: 'user', content: row.user_message });
      messages.push({ role: 'assistant', content: row.ai_response });
    }
    return messages;
  }

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }
}

module.exports = new SystemDatabase(); // Singleton
