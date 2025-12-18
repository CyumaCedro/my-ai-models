const express = require('express');
const mysql = require('mysql2/promise');
const axios = require('axios');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json());

// Database connection
let db;
async function initDatabase() {
  try {
    db = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || 'chatuser',
      password: process.env.MYSQL_PASSWORD || 'chatpass',
      database: process.env.MYSQL_DATABASE || 'chatdb',
      namedPlaceholders: true
    });
    console.log('Connected to MySQL database');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

// Settings cache
let settingsCache = {};
let cacheTimestamp = 0;
const CACHE_DURATION = 60000; // 1 minute

async function getSettings() {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_DURATION && Object.keys(settingsCache).length > 0) {
    return settingsCache;
  }

  try {
    const [rows] = await db.execute('SELECT setting_name, setting_value FROM chat_settings');
    settingsCache = {};
    rows.forEach(row => {
      settingsCache[row.setting_name] = row.setting_value;
    });
    cacheTimestamp = now;
    return settingsCache;
  } catch (error) {
    console.error('Error fetching settings:', error);
    return settingsCache;
  }
}

async function getTableSchema() {
  const settings = await getSettings();
  const enabledTables = settings.enabled_tables ? settings.enabled_tables.split(',') : [];
  
  if (enabledTables.length === 0) return '';
  
  let schema = 'Database Schema:\n';
  for (const table of enabledTables) {
    try {
      const [columns] = await db.execute(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [table.trim()]);
      
      schema += `\nTable: ${table.trim()}\n`;
      columns.forEach(col => {
        schema += `  - ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL'} ${col.COLUMN_KEY ? 'KEY' : ''}\n`;
      });
    } catch (error) {
      console.error(`Error getting schema for table ${table}:`, error);
    }
  }
  return schema;
}

async function executeSafeQuery(query) {
  const settings = await getSettings();
  const enabledTables = settings.enabled_tables ? settings.enabled_tables.split(',').map(t => t.trim()) : [];
  const maxResults = parseInt(settings.max_results) || 100;
  
  // Basic SQL injection protection
  const lowerQuery = query.toLowerCase();
  const dangerousKeywords = ['drop', 'delete', 'update', 'insert', 'alter', 'create', 'truncate', 'exec', 'execute'];
  
  for (const keyword of dangerousKeywords) {
    if (lowerQuery.includes(keyword)) {
      throw new Error(`Dangerous SQL keyword detected: ${keyword}`);
    }
  }
  
  // Check if query only accesses enabled tables
  const tablesInQuery = [];
  const tableMatches = query.match(/from\s+(\w+)|join\s+(\w+)/gi);
  if (tableMatches) {
    tableMatches.forEach(match => {
      const parts = match.toLowerCase().split(/\s+/);
      const tableName = parts[parts.length - 1];
      if (!tablesInQuery.includes(tableName)) {
        tablesInQuery.push(tableName);
      }
    });
  }
  
  const unauthorizedTables = tablesInQuery.filter(table => !enabledTables.includes(table));
  if (unauthorizedTables.length > 0) {
    throw new Error(`Access to tables not allowed: ${unauthorizedTables.join(', ')}`);
  }
  
  // Add LIMIT if not present
  if (!lowerQuery.includes('limit')) {
    query += ` LIMIT ${maxResults}`;
  }
  
  try {
    const [rows] = await db.execute(query);
    return rows;
  } catch (error) {
    console.error('Query execution error:', error);
    throw new Error(`Query failed: ${error.message}`);
  }
}

async function callOllama(prompt, context = '') {
  const settings = await getSettings();
  const ollamaUrl = settings.ollama_url || 'http://192.168.1.70:11434';
  const model = settings.ollama_model || 'deepseek-coder-v2';
  
  const systemPrompt = `You are a helpful AI assistant that can analyze database information. 
${context}
${context ? '\nUse the above schema information to answer questions accurately.\n' : ''}
When users ask for data, generate SQL queries to retrieve the information. 
Only access the tables that are available in the schema.
Always explain your reasoning and show the SQL queries you use.
Format your responses clearly with explanations and results.`;

  try {
    const primaryPayload = {
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      stream: false
    };
    try {
      const response = await axios.post(`${ollamaUrl}/api/chat`, primaryPayload, { timeout: 120000, validateStatus: s => s >= 200 && s < 300 });
      const content = response.data && response.data.message && response.data.message.content ? response.data.message.content : '';
      if (content) return content;
    } catch (e) {}
    const minimalPayload = {
      model: model,
      messages: [
        { role: 'user', content: prompt }
      ],
      stream: false
    };
    const response2 = await axios.post(`${ollamaUrl}/api/chat`, minimalPayload, { timeout: 120000, validateStatus: s => s >= 200 && s < 300 });
    return response2.data && response2.data.message && response2.data.message.content ? response2.data.message.content : '';
  } catch (error) {
    console.error('Ollama API error:', error);
    throw new Error('Failed to get response from Ollama');
  }
}

// Validation schemas
const chatRequestSchema = Joi.object({
  message: Joi.string().required().min(1).max(2000),
  sessionId: Joi.string().optional().default(() => uuidv4())
});

const settingsUpdateSchema = Joi.object({
  settings: Joi.object().required()
});

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const { error, value } = settingsUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const { settings } = value;
    
    for (const [key, val] of Object.entries(settings)) {
      await db.execute(
        'INSERT INTO chat_settings (setting_name, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = CURRENT_TIMESTAMP',
        [key, val, val]
      );
    }
    
    // Clear cache
    settingsCache = {};
    cacheTimestamp = 0;
    
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

  app.get('/api/tables', async (req, res) => {
    try {
      const settings = await getSettings();
      const enabledTables = settings.enabled_tables ? settings.enabled_tables.split(',') : [];
      
      const tables = [];
      for (const table of enabledTables) {
        const name = table.trim().replace(/[^a-zA-Z0-9_]/g, '');
        const [result] = await db.execute(`SELECT COUNT(*) as count FROM \`${name}\``);
        tables.push({
          name: name,
          count: result[0].count
        });
      }
      
      res.json({ success: true, tables });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { error, value } = chatRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    const { message, sessionId } = value;
    const settings = await getSettings();
    const enableSchema = settings.enable_schema_info === 'true';
    
    let context = '';
    let tablesAccessed = [];
    
    if (enableSchema) {
      context = await getTableSchema();
    }
    
    // Check if message is asking for data
    const dataKeywords = ['show', 'get', 'list', 'find', 'search', 'count', 'how many', 'what', 'when', 'where'];
    const isDataRequest = dataKeywords.some(keyword => message.toLowerCase().includes(keyword));
    
    let aiResponse = await callOllama(message, context);
    let queryResults = null;
    
    // Try to extract and execute SQL queries from the response
    if (isDataRequest) {
      const sqlMatch = aiResponse.match(/```sql\n([\s\S]*?)\n```/i) || 
                       aiResponse.match(/SELECT[\s\S]*?(?=\n\n|\n[A-Z]|\n#|$)/i);
      
      if (sqlMatch) {
        const query = sqlMatch[1] || sqlMatch[0];
        try {
          queryResults = await executeSafeQuery(query);
          
          // Extract table names from query
          const tableMatches = query.match(/from\s+(\w+)|join\s+(\w+)/gi);
          if (tableMatches) {
            tableMatches.forEach(match => {
              const parts = match.toLowerCase().split(/\s+/);
              const tableName = parts[parts.length - 1];
              if (!tablesAccessed.includes(tableName)) {
                tablesAccessed.push(tableName);
              }
            });
          }
          
          // Add results to AI response
          aiResponse += '\n\nQuery Results:\n```\n' + JSON.stringify(queryResults, null, 2) + '\n```';
        } catch (queryError) {
          aiResponse += `\n\n⚠️ Query Error: ${queryError.message}`;
        }
      }
    }
    
    // Save chat history
    await db.execute(
      'INSERT INTO chat_history (session_id, user_message, ai_response, tables_accessed) VALUES (?, ?, ?, ?)',
      [sessionId, message, aiResponse, tablesAccessed.join(',')]
    );
    
    res.json({
      success: true,
      response: aiResponse,
      sessionId,
      queryResults,
      tablesAccessed
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const [rows] = await db.execute(
      'SELECT * FROM chat_history WHERE session_id = ? ORDER BY timestamp DESC LIMIT 50',
      [sessionId]
    );
    
    res.json({ success: true, history: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
async function startServer() {
  await initDatabase();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Chat backend server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}

startServer().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (db) await db.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  if (db) await db.end();
  process.exit(0);
});
