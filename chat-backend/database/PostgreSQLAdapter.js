const { Pool } = require('pg');
const DatabaseAdapter = require('./DatabaseAdapter');

/**
 * PostgreSQL database adapter
 */
class PostgreSQLAdapter extends DatabaseAdapter {
  constructor(config) {
    super(config);
    this.type = 'postgresql';
  }

  getDatabaseType() {
    return 'postgresql';
  }

  async connect() {
    try {
      this.pool = new Pool({
        host: this.config.host || 'localhost',
        port: this.config.port || 5432,
        user: this.config.user || 'chatuser',
        password: this.config.password || 'chatpass',
        database: this.config.database || 'chatdb',
        max: this.config.connectionLimit || 10,
        idleTimeoutMillis: this.config.idleTimeout || 30000,
        connectionTimeoutMillis: this.config.connectionTimeout || 2000,
        statement_timeout: this.config.statementTimeout || 30000,
        query_timeout: this.config.queryTimeout || 30000,
      });
      
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      console.log(`Connected to PostgreSQL database: ${this.config.database}`);
      return true;
    } catch (error) {
      console.error('PostgreSQL connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      console.log('PostgreSQL connection pool closed');
    }
  }

  async executeQuery(query, params = []) {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    try {
      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('PostgreSQL query error:', error);
      throw new Error(`Query failed: ${error.message}`);
    }
  }

  async getTableSchema(tableName) {
    const sanitizedTable = this.sanitizeIdentifier(tableName);
    
    // Get column information
    const columns = await this.executeQuery(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default, 
        character_maximum_length,
        col_description(pgc.oid, a.attnum) as column_comment
      FROM information_schema.columns
      LEFT JOIN pg_class pgc ON pgc.relname = table_name
      LEFT JOIN pg_attribute a ON a.attrelid = pgc.oid AND a.attname = column_name
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [sanitizedTable]);
    
    // Get foreign key relationships
    const foreignKeys = await this.executeQuery(`
      SELECT
        kcu.column_name,
        ccu.table_name AS referenced_table_name,
        ccu.column_name AS referenced_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema = 'public'
        AND tc.table_name = $1
    `, [sanitizedTable]);
    
    return {
      tableName: sanitizedTable,
      columns: columns,
      foreignKeys: foreignKeys
    };
  }

  async getTableList() {
    const tables = await this.executeQuery(`
      SELECT 
        t.table_name,
        obj_description(c.oid) as table_comment,
        COALESCE(s.n_tup_ins - s.n_tup_del, 0) as estimated_rows
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name
      LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
      WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `);
    
    return tables.map(table => ({
      name: table.table_name,
      description: table.table_comment || '',
      estimatedRows: table.estimated_rows || 0
    }));
  }

  async getTableCount(tableName) {
    const sanitizedTable = this.sanitizeIdentifier(tableName);
    const result = await this.executeQuery(`SELECT COUNT(*) as count FROM "${sanitizedTable}"`);
    return result[0].count;
  }

  async getForeignKeyRelations(tableName) {
    const sanitizedTable = this.sanitizeIdentifier(tableName);
    return await this.executeQuery(`
      SELECT
        kcu.column_name,
        ccu.table_name AS referenced_table_name,
        ccu.column_name AS referenced_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema = 'public'
        AND tc.table_name = $1
    `, [sanitizedTable]);
  }

  getSampleDataQuery(tableName, limit = 3) {
    const sanitizedTable = this.sanitizeIdentifier(tableName);
    return `SELECT * FROM "${sanitizedTable}" LIMIT ${limit}`;
  }

  // PostgreSQL-specific query sanitization
  sanitizeQuery(query) {
    // Remove dangerous SQL patterns
    const dangerousPatterns = [
      /\b(drop|delete|update|insert|alter|create|truncate|replace|grant|revoke)\b/i,
      /\bexec(ute)?\s*\(/i,
      /\bcopy\s+.*\b(to|from)\b/i,
      /\b\.\.\./i,
      /\bsleep\s*\(/i,
      /\bpg_sleep\s*\(/i,
      /--/,
      /\/\*/,
      /\*\/$/,
      /\bunion\b.*\bselect\b/i,
      /;.*\b(select|drop|delete|update|insert)\b/i,
      /\b(pg_catalog|information_schema)\b/i,
      /\b(concat|string_agg|substring|ascii|chr|ord|length)\s*\(/i,
      /\band\s+1\s*=\s*1\b/i,
      /\bor\s+1\s*=\s*1\b/i,
      /\bcase\s+when\b/i,
      /\bpg_\w+\s*\(/i
    ];

    const cleanQuery = query.trim();
    const lowerQuery = cleanQuery.toLowerCase().replace(/\s+/g, ' ').trim();

    for (const pattern of dangerousPatterns) {
      if (pattern.test(lowerQuery)) {
        throw new Error(`Potentially dangerous SQL pattern detected: ${pattern.source}`);
      }
    }

    return cleanQuery;
  }

  // Extract table names from query
  extractTableNames(query) {
    const tableRegex = /\bfrom\s+"?(\w+)"?|\bjoin\s+"?(\w+)"?|\binto\s+"?(\w+)"?/gi;
    const tables = new Set();
    let match;

    while ((match = tableRegex.exec(query)) !== null) {
      const tableName = (match[1] || match[2] || match[3]).toLowerCase();
      if (tableName && this.validateTableName(tableName)) {
        tables.add(tableName);
      }
    }

    return Array.from(tables);
  }

  // Validate query is SELECT only
  validateSelectQuery(query) {
    const cleanQuery = this.sanitizeQuery(query);
    const lowerQuery = cleanQuery.toLowerCase().replace(/\s+/g, ' ').trim();

    if (!/^select\s+/i.test(lowerQuery)) {
      throw new Error('Only SELECT queries are allowed');
    }

    return cleanQuery;
  }
}

module.exports = PostgreSQLAdapter;
