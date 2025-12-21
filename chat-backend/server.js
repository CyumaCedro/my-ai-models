const express = require('express');
const mysql = require('mysql2/promise');
const axios = require('axios');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();
const http = require('http');
const https = require('https');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(cors());

// Enhanced JSON parsing with error handling
app.use(express.json({ 
  limit: '10mb',
  strict: true,
  type: 'application/json'
}));

// Catch JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body',
      details: err.message
    });
  }
  next();
});

// Response helper function to ensure valid JSON
function sendJsonResponse(res, statusCode, data) {
  try {
    // Validate that data can be stringified
    const jsonString = JSON.stringify(data);
    
    // Set proper headers
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(statusCode);
    res.send(jsonString);
  } catch (error) {
    console.error('JSON serialization error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error: Unable to serialize response'
    });
  }
}

// Database connection pool for better performance
let pool;
async function initDatabase() {
  try {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || 'chatuser',
      password: process.env.MYSQL_PASSWORD || 'chatpass',
      database: process.env.MYSQL_DATABASE || 'chatdb',
      namedPlaceholders: true,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    console.log('Connected to MySQL database pool');
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
    const [rows] = await pool.execute('SELECT setting_name, setting_value FROM chat_settings');
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

// Enhanced schema fetching with relationships and constraints
async function getTableSchema() {
  const settings = await getSettings();
  const enabledTables = settings.enabled_tables ? settings.enabled_tables.split(',') : [];
  
  if (enabledTables.length === 0) return '';
  
  let schema = 'Database Schema (use this to understand data relationships):\n';
  
  for (const table of enabledTables) {
    try {
      const tableName = table.trim();
      
      // Get column information
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, 
               COLUMN_DEFAULT, COLUMN_COMMENT, CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [tableName]);
      
      // Get foreign key relationships
      const [foreignKeys] = await pool.execute(`
        SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = ?
          AND REFERENCED_TABLE_NAME IS NOT NULL
      `, [tableName]);
      
      // Get sample data for better context
      const [sampleData] = await pool.execute(`SELECT * FROM \`${tableName}\` LIMIT 3`);
      
      schema += `\nTable: ${tableName}\n`;
      schema += `Columns:\n`;
      columns.forEach(col => {
        const nullable = col.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL';
        const keyInfo = col.COLUMN_KEY === 'PRI' ? '[PRIMARY KEY]' : 
                       col.COLUMN_KEY === 'UNI' ? '[UNIQUE]' : 
                       col.COLUMN_KEY === 'MUL' ? '[INDEXED]' : '';
        const comment = col.COLUMN_COMMENT ? `// ${col.COLUMN_COMMENT}` : '';
        schema += `  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}${col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : ''} ${nullable} ${keyInfo} ${comment}\n`;
      });
      
      if (foreignKeys.length > 0) {
        schema += `Relationships:\n`;
        foreignKeys.forEach(fk => {
          schema += `  - ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}\n`;
        });
      }
      
      if (sampleData.length > 0) {
        schema += `Sample data (${sampleData.length} rows): ${JSON.stringify(sampleData[0])}\n`;
      }
      
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
  
  // Sanitize and normalize query
  const cleanQuery = query.trim();
  const lowerQuery = cleanQuery.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Enhanced SQL injection protection - more comprehensive patterns
  const dangerousPatterns = [
    // DDL/DML operations
    /\b(drop|delete|update|insert|alter|create|truncate|replace|grant|revoke)\b/i,
    // Execution and file operations
    /\bexec(ute)?\s*\(/i,
    /\binto\s+(outfile|dumpfile)\b/i,
    /\bload_file\s*\(/i,
    // Time-based attacks
    /\bsleep\s*\(/i,
    /\bbenchmark\s*\(/i,
    // Comment attacks
    /--/,
    /\/\*/,
    /\*\/$/,
    // Union-based attacks
    /\bunion\b.*\bselect\b/i,
    /;.*\b(select|drop|delete|update|insert)\b/i,
    // Subquery attacks
    /\b(select\s+.*\s+from\s+.*\s+where\s+.*\s+in\s*\()/i,
    // Information schema attacks
    /\b(information_schema|sys|mysql|performance_schema)\b/i,
    // Function attacks
    /\b(concat|group_concat|substring|ascii|char|ord|length)\s*\(/i,
    // Boolean-based attacks
    /\band\s+1\s*=\s*1\b/i,
    /\bor\s+1\s*=\s*1\b/i,
    // Conditional attacks
    /\bif\s*\(/i,
    /\bcase\s+when\b/i
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(lowerQuery)) {
      console.error('Dangerous SQL pattern detected:', pattern);
      throw new Error(`Potentially dangerous SQL pattern detected: ${pattern.source}`);
    }
  }
  
  // Extract and validate table names with enhanced security
  const tableRegex = /\bfrom\s+`?(\w+)`?|\bjoin\s+`?(\w+)`?|\binto\s+`?(\w+)`?/gi;
  const tablesInQuery = new Set();
  let match;
  while ((match = tableRegex.exec(cleanQuery)) !== null) {
    const tableName = (match[1] || match[2] || match[3]).toLowerCase();
    if (tableName && !['information_schema', 'sys', 'mysql', 'performance_schema'].includes(tableName)) {
      tablesInQuery.add(tableName);
    }
  }
  
  const unauthorizedTables = Array.from(tablesInQuery).filter(
    table => !enabledTables.map(t => t.toLowerCase()).includes(table)
  );
  
  if (unauthorizedTables.length > 0) {
    console.error('Unauthorized table access attempt:', unauthorizedTables);
    throw new Error(`Access denied to tables: ${unauthorizedTables.join(', ')}`);
  }
  
  // Additional validation: only allow SELECT statements
  if (!/^select\s+/i.test(lowerQuery)) {
    throw new Error('Only SELECT queries are allowed');
  }
  
  // Remove trailing semicolons and add LIMIT if not present
  const finalQuery = cleanQuery.replace(/;+\s*$/i, '');
  if (!/\blimit\s+\d+/i.test(lowerQuery)) {
    const limitedQuery = finalQuery + ` LIMIT ${Math.min(maxResults, 1000)}`; // Hard cap at 1000
    try {
      const [rows] = await pool.execute(limitedQuery);
      return rows;
    } catch (error) {
      console.error('Query execution error:', error);
      throw new Error(`Query failed: ${error.message}`);
    }
  }
  
  try {
    const [rows] = await pool.execute(finalQuery);
    return rows;
  } catch (error) {
    console.error('Query execution error:', error);
    throw new Error(`Query failed: ${error.message}`);
  }
}

// Improved prompt engineering for better AI responses
async function callOllama(prompt, context = '', conversationHistory = []) {
  const settings = await getSettings();
  const ollamaUrl = settings.ollama_url || 'http://localhost:11434';
  const model = settings.ollama_model || 'deepseek-coder-v2';
  
  const systemPrompt = `You are a helpful assistant that provides intelligent insights from data. Follow these rules strictly:

1. ANSWER FORMAT: Provide clear, natural language answers about the actual data. Be conversational and helpful.
2. SQL GENERATION: When you need to retrieve data, include SQL in <sql>...</sql> tags. This will be executed automatically.
3. QUERY BEST PRACTICES:
   - Use JOINs when data spans multiple sources
   - Use aggregate functions (COUNT, SUM, AVG) for statistics
   - Use GROUP BY for categorized results
   - Use ORDER BY to sort results logically
   - Use WHERE clauses to filter data precisely
   - ALWAYS use LIMIT for performance
4. DATA FOCUS: Talk about what the data reveals, not about tables, fields, or technical details
5. NO TECHNICAL JARGON: Never mention "database", "SQL", "query", "table", "field", "column", or technical terms
6. FORBIDDEN OPERATIONS: Never use DROP, DELETE, UPDATE, INSERT, ALTER, CREATE, TRUNCATE, EXEC, EXECUTE
7. DATA PRIORITY: Always prefer actual retrieved data over general knowledge
8. CONTEXT AWARENESS: Consider previous conversation context when answering
9. NATURAL RESPONSES: Answer as if you're a smart assistant presenting useful information, not a technical system
10. FALLBACK STRATEGY: If technical content is detected, provide a helpful conversational response without technical details. If unable to help, suggest rephrasing the question.

${context}

Available Data Sources:
${context}`;

  const messages = [
    { role: 'system', content: systemPrompt }
  ];
  
  // Add conversation history for context (last 3 exchanges)
  const recentHistory = conversationHistory.slice(-6);
  messages.push(...recentHistory);
  
  messages.push({ role: 'user', content: prompt });

  const payload = {
    model: model,
    messages: messages,
    stream: false,
    options: {
      temperature: 0.1, // Lower temperature for more consistent SQL generation
      top_p: 0.9,
      num_predict: 1000
    }
  };

  const url = new URL(`${ollamaUrl}/api/chat`);
  const body = JSON.stringify(payload);
  const options = {
    hostname: url.hostname,
    port: url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  const client = url.protocol === 'https:' ? https : http;
  const responseData = await new Promise((resolve, reject) => {
    const req = client.request(options, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Ollama API returned status ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy(new Error('Request timeout'));
    });
    req.end(body);
  });

  const parsed = JSON.parse(responseData);
  return parsed?.message?.content || '';
}

function stripTechnicalContent(text) {
  if (!text) return '';
  let cleaned = text;
  
  // Remove SQL tags and content
  cleaned = cleaned.replace(/<sql>[\s\S]*?<\/sql>/gi, '');
  
  // Remove code blocks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/`[^`]+`/g, '');
  
  // Remove SQL statements that leaked through
  cleaned = cleaned.replace(/\b(SELECT|WITH|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|LIMIT)\b[\s\S]*?(;|\n\n|$)/gi, '');
  
  // Remove technical terms accidentally included
  cleaned = cleaned.replace(/\b(database|query|table|SQL|execute|fetch)\b/gi, '');
  
  return cleaned.trim();
}

async function summarizeWithData(question, dataJson, context = '') {
  const settings = await getSettings();
  const ollamaUrl = settings.ollama_url || 'http://localhost:11434';
  const model = settings.ollama_model || 'deepseek-coder-v2';
  
  const systemPrompt = `You are a helpful analyst providing insights from data. Focus on what the data reveals, not technical details.

RULES:
- Analyze the information and answer the user's question directly
- Use natural, conversational language - absolutely no technical jargon
- Talk about what the data shows, patterns, or trends you notice
- Be concise but complete and helpful
- Never mention "database", "SQL", "query", "table", "field", "column" or any technical terms
- Format numbers with appropriate units for easy understanding
- Highlight the most important insights or patterns
- Answer as if you're presenting useful information to someone interested in the results

${context ? 'Context: ' + context : ''}`;

  const userPrompt = `Question: ${question}

Data retrieved:
${dataJson}

Please analyze this data and provide a clear, helpful answer to the question.`;

  const payload = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    stream: false,
    options: {
      temperature: 0.3,
      top_p: 0.9
    }
  };

  const url = new URL(`${ollamaUrl}/api/chat`);
  const body = JSON.stringify(payload);
  const options = {
    hostname: url.hostname,
    port: url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  const client = url.protocol === 'https:' ? https : http;
  const responseData = await new Promise((resolve, reject) => {
    const req = client.request(options, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Status ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy(new Error('Timeout'));
    });
    req.end(body);
  });

  const parsed = JSON.parse(responseData);
  return stripTechnicalContent(parsed?.message?.content || '');
}

async function callGeneralAnswer(prompt) {
  const settings = await getSettings();
  const ollamaUrl = settings.ollama_url || 'http://localhost:11434';
  const model = settings.ollama_model || 'deepseek-coder-v2';
  
  const systemPrompt = `You are a helpful assistant. Answer questions clearly and concisely.
Keep responses natural and conversational. No technical jargon unless specifically asked.`;

  const payload = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    stream: false
  };

  const url = new URL(`${ollamaUrl}/api/chat`);
  const body = JSON.stringify(payload);
  const options = {
    hostname: url.hostname,
    port: url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  const client = url.protocol === 'https:' ? https : http;
  const responseData = await new Promise((resolve, reject) => {
    const req = client.request(options, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Status ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy(new Error('Timeout'));
    });
    req.end(body);
  });

  const parsed = JSON.parse(responseData);
  return stripTechnicalContent(parsed?.message?.content || '');
}

async function buildSchemaMap(enabledTables) {
  const map = {};
  if (!enabledTables || enabledTables.length === 0) return map;
  
  for (const table of enabledTables) {
    try {
      const tableName = table.trim();
      const [cols] = await pool.execute(
        `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? 
         ORDER BY ORDINAL_POSITION`,
        [tableName]
      );
      
      map[tableName] = {
        columns: cols.map(c => ({
          name: c.COLUMN_NAME.toLowerCase(),
          type: c.DATA_TYPE,
          comment: c.COLUMN_COMMENT
        }))
      };
    } catch (err) {
      console.error(`Error building schema for ${table}:`, err);
    }
  }
  return map;
}

function findRelevantTables(message, schemaMap) {
  const text = message.toLowerCase();
  const tokens = text.split(/[^a-z0-9_]+/).filter(Boolean);
  const scores = [];
  
  for (const [table, info] of Object.entries(schemaMap)) {
    let score = 0;
    const tableLower = table.toLowerCase();
    
    // Direct table name mention
    if (tokens.some(t => tableLower.includes(t) || t.includes(tableLower))) {
      score += 5;
    }
    
    // Column name matches
    for (const col of info.columns) {
      if (tokens.some(t => col.name.includes(t) || t.includes(col.name))) {
        score += 2;
      }
      // Check column comments for semantic matches
      if (col.comment) {
        const commentLower = col.comment.toLowerCase();
        if (tokens.some(t => commentLower.includes(t))) {
          score += 1;
        }
      }
    }
    
    if (score > 0) {
      scores.push({ table, score });
    }
  }
  
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, 3).map(s => s.table); // Return top 3 relevant tables
}

// Enhanced conversation history retrieval
async function getConversationHistory(sessionId, limit = 3) {
  try {
    const [rows] = await pool.execute(
      `SELECT user_message, ai_response 
       FROM chat_history 
       WHERE session_id = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [sessionId, limit]
    );
    
    // Convert to message format for Ollama
    const messages = [];
    for (const row of rows.reverse()) {
      messages.push({ role: 'user', content: row.user_message });
      messages.push({ role: 'assistant', content: row.ai_response });
    }
    
    return messages;
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    return [];
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
  sendJsonResponse(res, 200, { status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    sendJsonResponse(res, 200, { success: true, settings });
  } catch (error) {
    sendJsonResponse(res, 500, { success: false, error: error.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const { error, value } = settingsUpdateSchema.validate(req.body);
    if (error) {
      return sendJsonResponse(res, 400, { success: false, error: error.details[0].message });
    }

    const { settings } = value;
    
    for (const [key, val] of Object.entries(settings)) {
      await pool.execute(
        `INSERT INTO chat_settings (setting_name, setting_value) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = CURRENT_TIMESTAMP`,
        [key, val, val]
      );
    }
    
    // Clear cache
    settingsCache = {};
    cacheTimestamp = 0;
    
    sendJsonResponse(res, 200, { success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Settings update error:', error);
    sendJsonResponse(res, 500, { success: false, error: error.message });
  }
});

app.get('/api/tables', async (req, res) => {
  try {
    const settings = await getSettings();
    const enabledTables = settings.enabled_tables ? settings.enabled_tables.split(',') : [];
    
    const tables = [];
    for (const table of enabledTables) {
      const name = table.trim().replace(/[^a-zA-Z0-9_]/g, '');
      const [result] = await pool.execute(`SELECT COUNT(*) as count FROM \`${name}\``);
      
      // Get table comment/description
      const [tableInfo] = await pool.execute(
        `SELECT TABLE_COMMENT 
         FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [name]
      );
      
      tables.push({
        name: name,
        count: result[0].count,
        description: tableInfo[0]?.TABLE_COMMENT || ''
      });
    }
    
    sendJsonResponse(res, 200, { success: true, tables });
  } catch (error) {
    sendJsonResponse(res, 500, { success: false, error: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { error, value } = chatRequestSchema.validate(req.body);
    if (error) {
      return sendJsonResponse(res, 400, { success: false, error: error.details[0].message });
    }

    const { message, sessionId } = value;
    const settings = await getSettings();
    const enableSchema = settings.enable_schema_info === 'true';
    
    let context = '';
    let tablesAccessed = [];
    
    if (enableSchema) {
      context = await getTableSchema();
    }
    
    // Get conversation history for better context
    const conversationHistory = await getConversationHistory(sessionId);
    
    // Determine if this is a data request
    const dataKeywords = [
      'show', 'list', 'get', 'find', 'search', 'count', 'how many', 'how much',
      'what', 'when', 'where', 'who', 'which', 'display', 'give me', 'tell me',
      'average', 'total', 'sum', 'maximum', 'minimum', 'latest', 'recent'
    ];
    const isDataRequest = dataKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
    
    let aiResponse;
    let queryResults = null;
    const enabledTables = settings.enabled_tables ? 
      settings.enabled_tables.split(',').map(t => t.trim()) : [];
    const schemaMap = await buildSchemaMap(enabledTables);
    
    try {
      aiResponse = await callOllama(message, context, conversationHistory);
    } catch (ollamaError) {
      console.error('Ollama error:', ollamaError);
      const fallback = "I'm having trouble processing your request right now. Please try again in a moment.";
      await pool.execute(
        `INSERT INTO chat_history (session_id, user_message, ai_response, tables_accessed) 
         VALUES (?, ?, ?, ?)`,
        [sessionId, message, fallback, '']
      );
      return sendJsonResponse(res, 200, {
        success: true,
        response: fallback,
        sessionId
      });
    }
    
    // Enhanced SQL extraction and execution
    if (isDataRequest && aiResponse) {
      const sqlPatterns = [
        /<sql>([\s\S]*?)<\/sql>/i,
        /```sql\n([\s\S]*?)\n```/i,
        /```\n(SELECT[\s\S]*?)\n```/i,
        /(SELECT\s+[\s\S]*?FROM[\s\S]*?(?=\n\n|\n[A-Z]|$))/i
      ];
      
      let extractedQuery = null;
      for (const pattern of sqlPatterns) {
        const match = aiResponse.match(pattern);
        if (match) {
          extractedQuery = (match[1] || match[0]).trim();
          break;
        }
      }
      
      if (extractedQuery) {
        try {
          queryResults = await executeSafeQuery(extractedQuery);
          
          // Extract accessed tables
          const tableMatches = extractedQuery.match(/\bfrom\s+`?(\w+)`?|\bjoin\s+`?(\w+)`?/gi);
          if (tableMatches) {
            tableMatches.forEach(match => {
              const tableName = match.split(/\s+/).pop().replace(/`/g, '').toLowerCase();
              if (!tablesAccessed.includes(tableName)) {
                tablesAccessed.push(tableName);
              }
            });
          }
          
          // Summarize results with data
          if (queryResults && queryResults.length > 0) {
            const dataJson = JSON.stringify(queryResults.slice(0, 50), null, 2); // Limit for token size
            try {
              const summarized = await summarizeWithData(message, dataJson, context);
              if (summarized) {
                aiResponse = summarized;
              }
            } catch (summErr) {
              console.error('Summarization error:', summErr);
            }
          } else if (queryResults && queryResults.length === 0) {
            // Empty result set - try fallback query
            const relevantTables = findRelevantTables(message, schemaMap);
            if (relevantTables.length > 0) {
              for (const fallbackTable of relevantTables) {
                try {
                  const fallbackQuery = `SELECT * FROM ${fallbackTable} LIMIT 10`;
                  const rows = await executeSafeQuery(fallbackQuery);
                  if (rows.length > 0) {
                    queryResults = rows;
                    const summarized = await summarizeWithData(
                      message, 
                      JSON.stringify(rows, null, 2),
                      context
                    );
                    if (summarized) {
                      aiResponse = summarized;
                    }
                    if (!tablesAccessed.includes(fallbackTable)) {
                      tablesAccessed.push(fallbackTable);
                    }
                    break;
                  }
                } catch (fbErr) {
                  console.error(`Fallback query error for ${fallbackTable}:`, fbErr);
                }
              }
            }
          }
          
        } catch (queryError) {
          console.error('Query execution error:', queryError);
          // Keep the original AI response if query fails
        }
      } else {
        // No SQL found but is a data request - try to find relevant table
        const relevantTables = findRelevantTables(message, schemaMap);
        if (relevantTables.length > 0) {
          for (const table of relevantTables) {
            try {
              const rows = await executeSafeQuery(`SELECT * FROM ${table} LIMIT 10`);
              if (rows.length > 0) {
                queryResults = rows;
                const summarized = await summarizeWithData(
                  message, 
                  JSON.stringify(rows, null, 2),
                  context
                );
                if (summarized) {
                  aiResponse = summarized;
                }
                if (!tablesAccessed.includes(table)) {
                  tablesAccessed.push(table);
                }
                break;
              }
            } catch (err) {
              console.error(`Error querying ${table}:`, err);
            }
          }
        }
      }
    }
    
    // Clean up response
    aiResponse = stripTechnicalContent(aiResponse);
    
    // Fallback to general answer if needed
    if (!aiResponse || aiResponse.trim() === '') {
      try {
        aiResponse = await callGeneralAnswer(message);
      } catch (genErr) {
        console.error('General answer error:', genErr);
        aiResponse = "I apologize, but I'm having trouble generating a response. Could you please rephrase your question?";
      }
    }
    
    // Save to chat history
    await pool.execute(
      `INSERT INTO chat_history (session_id, user_message, ai_response, tables_accessed) 
       VALUES (?, ?, ?, ?)`,
      [sessionId, message, aiResponse, tablesAccessed.join(',')]
    );
    
    sendJsonResponse(res, 200, {
      success: true,
      response: aiResponse,
      sessionId,
      queryResults: queryResults ? queryResults.slice(0, 100) : null, // Limit results sent to client
      tablesAccessed
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    sendJsonResponse(res, 500, { 
      success: false, 
      error: 'An error occurred while processing your request. Please try again.' 
    });
  }
});

app.get('/api/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const [rows] = await pool.execute(
      `SELECT id, user_message, ai_response, tables_accessed, timestamp 
       FROM chat_history 
       WHERE session_id = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [sessionId, limit]
    );
    sendJsonResponse(res, 200, { success: true, history: rows });
  } catch (error) {
    console.error('History error:', error);
    sendJsonResponse(res, 500, { success: false, error: error.message });
  }
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`Chat backend server running on port ${PORT}`);
      console.log(`Health check available at http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();
