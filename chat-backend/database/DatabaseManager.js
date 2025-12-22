const DatabaseAdapter = require('./DatabaseAdapter');
const MySQLAdapter = require('./MySQLAdapter');
const PostgreSQLAdapter = require('./PostgreSQLAdapter');
const SQLiteAdapter = require('./SQLiteAdapter');
const SchemaAnalyzer = require('./SchemaAnalyzer');
const InsightEngine = require('./InsightEngine');
const QueryPerformanceMonitor = require('./QueryPerformanceMonitor');

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
    this.config = null;
    this.schemaAnalyzer = null;
    this.insightEngine = null;
    this.performanceMonitor = null;
    this.queryCache = new Map();
    this.queryMetrics = new Map();
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
      this.config = config;
      
      // Initialize schema analyzer, insight engine, and performance monitor
      this.schemaAnalyzer = new SchemaAnalyzer(this);
      this.insightEngine = new InsightEngine(this);
      this.performanceMonitor = new QueryPerformanceMonitor(this);

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
   * Execute safe query with validation and caching
   */
  async executeSafeQuery(query, settings = {}) {
    const adapter = this.getCurrentAdapter();
    const enabledTables = settings.enabled_tables ?
      settings.enabled_tables.split(',').map(t => t.trim()) : [];
    const maxResults = parseInt(settings.max_results) || 100;

    try {
      // Check query cache first
      const cacheKey = this.generateQueryCacheKey(query, settings);
      const cachedResult = this.getQueryFromCache(cacheKey);
      if (cachedResult) {
        console.log('Query cache hit');
        
        // Record cache hit performance
        if (this.performanceMonitor) {
          this.performanceMonitor.recordQueryPerformance(query, 0, cachedResult.data.length, true);
        }
        
        return {
          data: cachedResult.data,
          insights: cachedResult.insights || [],
          executionTime: 0,
          cached: true
        };
      }

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

      // Optimize query with implicit relationships
      const optimizedQuery = await this.optimizeQuery(validatedQuery, tablesInQuery);

      // Add LIMIT if not present
      const finalQuery = this.addLimitToQuery(optimizedQuery, maxResults);

      // Execute query with performance tracking
      const startTime = Date.now();
      const result = await adapter.executeQuery(finalQuery);
      const executionTime = Date.now() - startTime;

      // Record performance metrics
      if (this.performanceMonitor) {
        this.performanceMonitor.recordQueryPerformance(query, executionTime, result.length, false);
      }

      // Cache the result
      this.cacheQueryResult(cacheKey, result, executionTime);

      // Log performance metrics (legacy)
      this.logQueryMetrics(query, executionTime, result.length);

      // Generate insights for the result
      const insights = await this.generateInsights(query, result);

      // Return result with insights
      return {
        data: result,
        insights: insights,
        executionTime: executionTime,
        cached: false
      };
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
      settings.enabled_tables.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];

    if (enabledTables.length === 0) return '';

    // Initialize schema analyzer if not done
    if (!this.schemaAnalyzer) {
      this.schemaAnalyzer = new SchemaAnalyzer(this);
    }

    let schema = 'Database Schema (use this to understand data relationships):\n';

    for (const table of enabledTables) {
      try {
        const tableName = table.trim();
        
        // Get enhanced schema with implicit relationships
        const enhancedSchema = await this.schemaAnalyzer.getEnhancedSchema(tableName);
        const sampleData = await adapter.getSampleData(tableName, 3);

        schema += `\nTable: ${tableName}\n`;
        schema += `Columns:\n`;

        enhancedSchema.columns.forEach(col => {
          const nullable = col.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL';
          const keyInfo = col.COLUMN_KEY === 'PRI' ? '[PRIMARY KEY]' :
            col.COLUMN_KEY === 'UNI' ? '[UNIQUE]' :
              col.COLUMN_KEY === 'MUL' ? '[INDEXED]' : '';
          const comment = col.COLUMN_COMMENT ? `// ${col.COLUMN_COMMENT}` : '';
          const length = col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : '';
          schema += `  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}${length} ${nullable} ${keyInfo} ${comment}\n`;
        });

        // Add explicit foreign keys
        if (enhancedSchema.explicitForeignKeys && enhancedSchema.explicitForeignKeys.length > 0) {
          schema += `Explicit Relationships:\n`;
          enhancedSchema.explicitForeignKeys.forEach(fk => {
            schema += `  - ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}\n`;
          });
        }

        // Add implicit foreign keys
        if (enhancedSchema.implicitForeignKeys && enhancedSchema.implicitForeignKeys.length > 0) {
          schema += `Implicit Relationships (detected):\n`;
          enhancedSchema.implicitForeignKeys.forEach(fk => {
            schema += `  - ${fk.sourceColumn} -> ${fk.targetTable}.${fk.targetColumn} [confidence: ${fk.confidence}]\n`;
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

        if (schema && schema.columns && Array.isArray(schema.columns)) {
          map[tableName] = {
            columns: schema.columns.map(c => ({
              name: c.COLUMN_NAME.toLowerCase(),
              type: c.DATA_TYPE,
              comment: c.COLUMN_COMMENT
            })),
            foreignKeys: schema.foreignKeys || []
          };
        } else {
          console.warn(`Invalid schema for table ${tableName}`);
        }
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

  /**
   * Get list of all databases
   */
  async getDatabaseList() {
    try {
      const adapter = this.getCurrentAdapter();
      if (typeof adapter.getDatabaseList === 'function') {
        return await adapter.getDatabaseList();
      }
      return [];
    } catch (error) {
      console.error('Error getting database list:', error);
      return [];
    }
  }

/**
   * Get database configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Optimize query using implicit relationships
   */
  async optimizeQuery(query, tablesInQuery) {
    if (!this.schemaAnalyzer || tablesInQuery.length < 2) {
      return query;
    }

    try {
      const suggestions = this.schemaAnalyzer.getRelationshipSuggestions(tablesInQuery);
      let optimizedQuery = query;

      // Add implicit join suggestions if no explicit joins found
      if (suggestions.length > 0 && !/\bjoin\b/i.test(query.toLowerCase())) {
        console.log('Query optimization suggestions available:', suggestions.length);
        // For now, just log suggestions. In future versions, we could automatically rewrite queries
      }

      return optimizedQuery;
    } catch (error) {
      console.warn('Query optimization failed:', error);
      return query;
    }
  }

  /**
   * Generate cache key for query
   */
  generateQueryCacheKey(query, settings) {
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ').trim();
    const settingsKey = JSON.stringify(settings);
    return `${normalizedQuery}_${settingsKey}`;
  }

  /**
   * Get query from cache
   */
  getQueryFromCache(cacheKey) {
    const cached = this.queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.result;
    }
    return null;
  }

  /**
   * Cache query result
   */
  cacheQueryResult(cacheKey, result, executionTime) {
    this.queryCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      executionTime
    });

    // Clean old cache entries periodically
    if (this.queryCache.size > 100) {
      this.cleanQueryCache();
    }
  }

  /**
   * Clean old query cache entries
   */
  cleanQueryCache() {
    const now = Date.now();
    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > this.CACHE_DURATION) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Log query performance metrics
   */
  logQueryMetrics(query, executionTime, resultCount) {
    const queryHash = this.generateQueryHash(query);
    
    if (!this.queryMetrics.has(queryHash)) {
      this.queryMetrics.set(queryHash, {
        query,
        count: 0,
        totalTime: 0,
        avgTime: 0,
        maxTime: 0,
        minTime: Infinity,
        totalResults: 0
      });
    }

    const metrics = this.queryMetrics.get(queryHash);
    metrics.count++;
    metrics.totalTime += executionTime;
    metrics.avgTime = metrics.totalTime / metrics.count;
    metrics.maxTime = Math.max(metrics.maxTime, executionTime);
    metrics.minTime = Math.min(metrics.minTime, executionTime);
    metrics.totalResults += resultCount;

    // Log slow queries
    if (executionTime > 1000) {
      console.warn(`Slow query detected (${executionTime}ms):`, query.substring(0, 100) + '...');
    }
  }

  /**
   * Generate query hash for metrics
   */
  generateQueryHash(query) {
    // Simple hash function for query patterns
    let hash = 0;
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ').trim();
    for (let i = 0; i < normalizedQuery.length; i++) {
      const char = normalizedQuery.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Get query performance report
   */
  getQueryPerformanceReport() {
    const report = {
      totalQueries: 0,
      avgExecutionTime: 0,
      slowQueries: [],
      cacheHitRate: 0,
      topQueries: []
    };

    let totalTime = 0;
    let totalQueries = 0;
    const slowQueries = [];

    for (const [hash, metrics] of this.queryMetrics.entries()) {
      totalQueries += metrics.count;
      totalTime += metrics.totalTime;

      if (metrics.avgTime > 500) {
        slowQueries.push({
          query: metrics.query.substring(0, 100) + '...',
          avgTime: metrics.avgTime,
          count: metrics.count
        });
      }
    }

    report.totalQueries = totalQueries;
    report.avgExecutionTime = totalQueries > 0 ? totalTime / totalQueries : 0;
    report.slowQueries = slowQueries.sort((a, b) => b.avgTime - a.avgTime).slice(0, 5);
    report.cacheHitRate = this.queryCache.size > 0 ? (this.queryCache.size / (this.queryCache.size + totalQueries)) : 0;

    return report;
  }

  /**
   * Get schema analyzer instance
   */
  getSchemaAnalyzer() {
    return this.schemaAnalyzer;
  }

  /**
   * Generate insights for query results
   */
  async generateInsights(query, results) {
    if (!this.insightEngine || !results || results.length === 0) {
      return [];
    }

    try {
      // Get schema for context
      const tablesInQuery = this.getCurrentAdapter().extractTableNames(query);
      let schema = null;
      
      if (tablesInQuery.length > 0) {
        schema = await this.getEnhancedSchema({ enabled_tables: tablesInQuery.join(',') });
      }

      return await this.insightEngine.generateInsights(query, results, schema);
    } catch (error) {
      console.warn('Insight generation failed:', error);
      return [];
    }
  }

  /**
   * Get insight engine instance
   */
  getInsightEngine() {
    return this.insightEngine;
  }

  /**
   * Get performance monitor instance
   */
  getPerformanceMonitor() {
    return this.performanceMonitor;
  }

  /**
   * Get comprehensive performance report
   */
  async getPerformanceReport() {
    if (!this.performanceMonitor) {
      return { error: 'Performance monitor not initialized' };
    }

    try {
      return this.performanceMonitor.getPerformanceReport();
    } catch (error) {
      console.error('Failed to generate performance report:', error);
      return { error: error.message };
    }
  }

  /**
   * Get optimization suggestions for a specific query
   */
  getOptimizationSuggestions(query) {
    if (!this.performanceMonitor) {
      return [];
    }

    const queryHash = this.performanceMonitor.generateQueryHash(query);
    return this.performanceMonitor.optimizationSuggestions.get(queryHash) || [];
  }
}

module.exports = DatabaseManager;
