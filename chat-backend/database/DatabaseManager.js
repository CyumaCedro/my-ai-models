const DatabaseAdapter = require('./DatabaseAdapter');
const MySQLAdapter = require('./MySQLAdapter');
const PostgreSQLAdapter = require('./PostgreSQLAdapter');
const SQLiteAdapter = require('./SQLiteAdapter');

/**
 * Database Manager - Handles multiple database connections and operations
 */
class DatabaseManager {
  constructor() {
    this.adapters = new Map();
    this.currentAdapter = null;
    this.settingsCache = {};
    this.cacheTimestamp = 0;
    this.CACHE_DURATION = 60000; // 1 minute
  }

  /**
   * Initialize database connection based on configuration
   */
  async initialize(config) {
    try {
      const adapter = this.createAdapter(config);
      await adapter.connect();
      
      const adapterKey = `${config.type || 'mysql'}_${config.host || 'localhost'}_${config.database || 'chatdb'}`;
      this.adapters.set(adapterKey, adapter);
      this.currentAdapter = adapter;
      
      console.log(`Database initialized: ${adapter.type} - ${config.database}`);
      return true;
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create appropriate adapter based on database type
   */
  createAdapter(config) {
    const dbType = (config.type || 'mysql').toLowerCase();
    
    switch (dbType) {
      case 'mysql':
        return new MySQLAdapter(config);
      case 'postgresql':
      case 'postgres':
        return new PostgreSQLAdapter(config);
      case 'sqlite':
        return new SQLiteAdapter(config);
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  }

  /**
   * Get current database adapter
   */
  getCurrentAdapter() {
    if (!this.currentAdapter) {
      throw new Error('No database adapter initialized');
    }
    return this.currentAdapter;
  }

  /**
   * Get database health status
   */
  async getHealthStatus() {
    try {
      const adapter = this.getCurrentAdapter();
      return await adapter.healthCheck();
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  /**
   * Execute safe query with validation
   */
  async executeSafeQuery(query, settings = {}) {
    const adapter = this.getCurrentAdapter();
    const enabledTables = settings.enabled_tables ? 
      settings.enabled_tables.split(',').map(t => t.trim()) : [];
    const maxResults = parseInt(settings.max_results) || 100;

    try {
      // Validate and sanitize query
      const validatedQuery = adapter.validateSelectQuery(query);
      
      // Extract table names and validate access
      const tablesInQuery = adapter.extractTableNames(validatedQuery);
      const unauthorizedTables = tablesInQuery.filter(
        table => !enabledTables.map(t => t.toLowerCase()).includes(table)
      );

      if (unauthorizedTables.length > 0) {
        throw new Error(`Access denied to tables: ${unauthorizedTables.join(', ')}`);
      }

      // Add LIMIT if not present
      const finalQuery = this.addLimitToQuery(validatedQuery, maxResults);
      
      return await adapter.executeQuery(finalQuery);
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    }
  }

  /**
   * Add LIMIT clause to query if not present
   */
  addLimitToQuery(query, maxResults) {
    const lowerQuery = query.toLowerCase();
    if (!/\blimit\s+\d+/i.test(lowerQuery)) {
      const cleanQuery = query.replace(/;+\s*$/i, '');
      return `${cleanQuery} LIMIT ${Math.min(maxResults, 1000)}`;
    }
    return query;
  }

  /**
   * Get enhanced schema information for all enabled tables
   */
  async getEnhancedSchema(settings = {}) {
    const adapter = this.getCurrentAdapter();
    const enabledTables = settings.enabled_tables ? 
      settings.enabled_tables.split(',').map(t => t.trim()) : [];
    
    if (enabledTables.length === 0) return '';
    
    let schema = 'Database Schema (use this to understand data relationships):\n';
    
    for (const table of enabledTables) {
      try {
        const tableName = table.trim();
        const tableSchema = await adapter.getTableSchema(tableName);
        const sampleData = await adapter.getSampleData(tableName, 3);
        
        schema += `\nTable: ${tableName}\n`;
        schema += `Columns:\n`;
        
        tableSchema.columns.forEach(col => {
          const nullable = col.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL';
          const keyInfo = col.COLUMN_KEY === 'PRI' ? '[PRIMARY KEY]' : 
                         col.COLUMN_KEY === 'UNI' ? '[UNIQUE]' : 
                         col.COLUMN_KEY === 'MUL' ? '[INDEXED]' : '';
          const comment = col.COLUMN_COMMENT ? `// ${col.COLUMN_COMMENT}` : '';
          const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
          schema += `  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}${length} ${nullable} ${keyInfo} ${comment}\n`;
        });
        
        if (tableSchema.foreignKeys.length > 0) {
          schema += `Relationships:\n`;
          tableSchema.foreignKeys.forEach(fk => {
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

  /**
   * Get list of all tables
   */
  async getTableList() {
    const adapter = this.getCurrentAdapter();
    return await adapter.getTableList();
  }

  /**
   * Get table count
   */
  async getTableCount(tableName) {
    const adapter = this.getCurrentAdapter();
    return await adapter.getTableCount(tableName);
  }

  /**
   * Build schema map for AI processing
   */
  async buildSchemaMap(enabledTables) {
    const adapter = this.getCurrentAdapter();
    const map = {};
    
    if (!enabledTables || enabledTables.length === 0) return map;
    
    for (const table of enabledTables) {
      try {
        const tableName = table.trim();
        const schema = await adapter.getTableSchema(tableName);
        
        map[tableName] = {
          columns: schema.columns.map(c => ({
            name: c.COLUMN_NAME.toLowerCase(),
            type: c.DATA_TYPE,
            comment: c.COLUMN_COMMENT
          })),
          foreignKeys: schema.foreignKeys
        };
      } catch (err) {
        console.error(`Error building schema for ${table}:`, err);
      }
    }
    
    return map;
  }

  /**
   * Find relevant tables based on message content
   */
  findRelevantTables(message, schemaMap) {
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

  /**
   * Close all database connections
   */
  async disconnectAll() {
    const disconnectPromises = [];
    
    for (const [key, adapter] of this.adapters) {
      disconnectPromises.push(adapter.disconnect());
    }
    
    await Promise.all(disconnectPromises);
    this.adapters.clear();
    this.currentAdapter = null;
    
    console.log('All database connections closed');
  }

  /**
   * Get database type
   */
  getDatabaseType() {
    const adapter = this.getCurrentAdapter();
    return adapter.getDatabaseType();
  }
}

module.exports = DatabaseManager;
