const express = require('express');
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

// Import database manager
const DatabaseManager = require('./database/DatabaseManager');
const systemDb = require('./database/SystemDatabase');

// Try to import LangChainManager, but don't fail if it has issues
let LangChainManager = null;
let langChainManager = null;
try {
  LangChainManager = require('./database/LangChainManager');
  const dbManager = new DatabaseManager();
  langChainManager = new LangChainManager(dbManager);
  console.log('LangChainManager loaded successfully');
} catch (error) {
  console.warn('LangChainManager could not be loaded:', error.message);
  console.warn('Smart chat features will be disabled');
}

const app = express();
const PORT = process.env.PORT || 8000;

// Initialize managers
const dbManager = new DatabaseManager();

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
    return sendJsonResponse(res, 400, {
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

// Enhanced settings management with SQLite system database
let settingsCache = {};
let cacheTimestamp = 0;
const CACHE_DURATION = 60000; // 1 minute

async function getSettings() {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_DURATION && Object.keys(settingsCache).length > 0) {
    return settingsCache;
  }

  try {
    settingsCache = await systemDb.getSettings();
    cacheTimestamp = now;
    return settingsCache;
  } catch (error) {
    console.error('Error fetching settings:', error);
    return settingsCache;
  }
}

// Enhanced AI integration with better error handling and fallbacks
async function callOllama(prompt, context = '', conversationHistory = []) {
  const settings = await getSettings();
  const ollamaUrl = settings.ollama_url || 'http://192.168.1.70:11434';
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
  const ollamaUrl = settings.ollama_url || 'http://192.168.1.70:11434';
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
  const ollamaUrl = settings.ollama_url || 'http://192.168.1.70:11434';
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

// Enhanced conversation history retrieval using system database
async function getConversationHistory(sessionId, limit = 3) {
  try {
    return await systemDb.getConversationHistoryForAI(sessionId, limit);
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
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await dbManager.getHealthStatus();
    sendJsonResponse(res, 200, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbHealth,
      databaseType: dbManager.getDatabaseType()
    });
  } catch (error) {
    sendJsonResponse(res, 500, {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Add /api/health as an alias for frontend access through nginx proxy
app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await dbManager.getHealthStatus();
    sendJsonResponse(res, 200, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbHealth,
      databaseType: dbManager.getDatabaseType()
    });
  } catch (error) {
    sendJsonResponse(res, 500, {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Add /api/databases endpoint for frontend
app.get('/api/databases', async (req, res) => {
  try {
    const databases = await dbManager.getDatabaseList();
    sendJsonResponse(res, 200, { success: true, databases });
  } catch (error) {
    console.error('Error fetching databases:', error);
    sendJsonResponse(res, 500, { success: false, error: error.message });
  }
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
      await systemDb.updateSetting(key, val);
    }

    // Clear cache and reset LangChain
    settingsCache = {};
    cacheTimestamp = 0;
    if (langChainManager) {
      await langChainManager.reset();
    }

    sendJsonResponse(res, 200, { success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Settings update error:', error);
    sendJsonResponse(res, 500, { success: false, error: error.message });
  }
});

app.get('/api/tables', async (req, res) => {
  try {
    const settings = await getSettings();
    const enabledTables = settings.enabled_tables ? settings.enabled_tables.split(',').map(t => t.trim().toLowerCase()) : [];

    console.log('Fetching all tables from database...');
    const allTables = await dbManager.getTableList();
    console.log(`Found ${allTables.length} tables in total`);

    const tables = [];
    for (const table of allTables) {
      try {
        const count = await dbManager.getTableCount(table.name);
        tables.push({
          ...table,
          count: count,
          enabled: enabledTables.includes(table.name.toLowerCase())
        });
      } catch (countErr) {
        console.warn(`Could not get count for table ${table.name}:`, countErr.message);
        tables.push({
          ...table,
          count: 0,
          enabled: enabledTables.includes(table.name.toLowerCase())
        });
      }
    }

    sendJsonResponse(res, 200, { success: true, tables });
  } catch (error) {
    console.error('Error in /api/tables:', error);
    sendJsonResponse(res, 500, { success: false, error: 'Failed to retrieve table list: ' + error.message });
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
      context = await dbManager.getEnhancedSchema(settings);
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

    // Try LangChain for smart data requests first if enabled
    const useSmartChat = settings.use_smart_chat === 'true';
    if (useSmartChat && isDataRequest && langChainManager) {
      try {
        const langChainResult = await langChainManager.ask(message, settings);
        if (langChainResult && langChainResult.output) {
          // Extract tables from intermediate steps if possible
          let tables = [];
          if (langChainResult.intermediateSteps) {
            // Simple extraction logic for demonstration
            const stepsStr = JSON.stringify(langChainResult.intermediateSteps);
            const tableMatches = stepsStr.match(/\bfrom\s+`?(\w+)`?|\bjoin\s+`?(\w+)`?/gi);
            if (tableMatches) {
              tables = [...new Set(tableMatches.map(m => m.split(/\s+/).pop().replace(/`/g, '').toLowerCase()))];
            }
          }

          // SAVE SMART CHAT HISTORY
          await systemDb.saveChat(sessionId, message, langChainResult.output, tables.join(','));

          return sendJsonResponse(res, 200, {
            success: true,
            response: langChainResult.output,
            sessionId,
            tablesAccessed: tables,
            smartResponse: true
          });
        }
      } catch (lcError) {
        console.error('LangChain error, falling back to basic logic:', lcError);
      }
    }

    let aiResponse;
    let queryResults = null;
    const enabledTables = settings.enabled_tables ?
      settings.enabled_tables.split(',').map(t => t.trim()) : [];
    const schemaMap = await dbManager.buildSchemaMap(enabledTables);

    try {
      aiResponse = await callOllama(message, context, conversationHistory);
    } catch (ollamaError) {
      console.error('Ollama error:', ollamaError);
      const fallback = "I'm having trouble processing your request right now. Please try again in a moment.";
      await systemDb.saveChat(sessionId, message, fallback, '');
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
          queryResults = await dbManager.executeSafeQuery(extractedQuery, settings);

          // Extract accessed tables
          const adapter = dbManager.getCurrentAdapter();
          const tablesInQuery = adapter.extractTableNames(extractedQuery);
          tablesAccessed = [...new Set([...tablesAccessed, ...tablesInQuery])];

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
            const relevantTables = dbManager.findRelevantTables(message, schemaMap);
            if (relevantTables.length > 0) {
              for (const fallbackTable of relevantTables) {
                try {
                  const fallbackQuery = `SELECT * FROM ${fallbackTable} LIMIT 10`;
                  const rows = await dbManager.executeSafeQuery(fallbackQuery, settings);
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
        const relevantTables = dbManager.findRelevantTables(message, schemaMap);
        if (relevantTables.length > 0) {
          for (const table of relevantTables) {
            try {
              const rows = await dbManager.executeSafeQuery(`SELECT * FROM ${table} LIMIT 10`, settings);
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

    // Save to system chat history
    await systemDb.saveChat(sessionId, message, aiResponse, tablesAccessed.join(','));

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

    const rows = await systemDb.getHistory(sessionId, limit);
    sendJsonResponse(res, 200, { success: true, history: rows });
  } catch (error) {
    console.error('History error:', error);
    sendJsonResponse(res, 500, { success: false, error: error.message });
  }
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await dbManager.disconnectAll();
  await systemDb.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await dbManager.disconnectAll();
  await systemDb.close();
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Initialize database based on environment configuration
    const dbConfig = {
      type: process.env.DB_TYPE || 'mysql',
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT || (process.env.DB_TYPE === 'postgresql' ? 5432 : 3306),
      user: process.env.MYSQL_USER || 'chatuser',
      password: process.env.MYSQL_PASSWORD || 'chatpass',
      database: process.env.MYSQL_DATABASE || 'chatdb',
      connectionLimit: parseInt(process.env.CONNECTION_LIMIT) || 10
    };

    // Special handling for SQLite
    if (process.env.DB_TYPE === 'sqlite') {
      dbConfig.database = process.env.SQLITE_DB_PATH || './chatdb.sqlite';
    }

    await systemDb.initialize();
    await dbManager.initialize(dbConfig);

    app.listen(PORT, () => {
      console.log(`Chat backend server running on port ${PORT}`);
      console.log(`Health check available at http://localhost:${PORT}/health`);
      console.log(`Database type: ${dbManager.getDatabaseType()}`);
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
