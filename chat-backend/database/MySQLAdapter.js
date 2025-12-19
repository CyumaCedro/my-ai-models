const mysql = require('mysql2/promise');
const DatabaseAdapter = require('./DatabaseAdapter');

/**
 * MySQL database adapter
 */
class MySQLAdapter extends DatabaseAdapter {
  constructor(config) {
    super(config);
    this.type = 'mysql';
  }

  getDatabaseType() {
    return 'mysql';
  }

  async connect() {
    try {
      this.pool = mysql.createPool({
        host: this.config.host || 'localhost',
        port: this.config.port || 3306,
        user: this.config.user || 'chatuser',
        password: this.config.password || 'chatpass',
        database: this.config.database || 'chatdb',
        namedPlaceholders: true,
        waitForConnections: true,
        connectionLimit: this.config.connectionLimit || 10,
        queueLimit: 0,
        acquireTimeout: this.config.acquireTimeout || 60000,
        timeout: this.config.timeout || 60000,
        reconnect: true,
        multipleStatements: false
      });
      
      // Test connection
      const connection = await this.pool.getConnection();
      connection.release();
      
      console.log(`Connected to MySQL database: ${this.config.database}`);
      return true;
    } catch (error) {
      console.error('MySQL connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      console.log('MySQL connection pool closed');
    }
  }

  async executeQuery(query, params = []) {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    try {
      const [rows] = await this.pool.execute(query, params);
      return rows;
    } catch (error) {
      console.error('MySQL query error:', error);
      throw new Error(`Query failed: ${error.message}`);
    }
  }

  async getTableSchema(tableName) {
    const sanitizedTable = this.sanitizeIdentifier(tableName);
    
    // Get column information
    const [columns] = await this.executeQuery(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, 
             COLUMN_DEFAULT, COLUMN_COMMENT, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [sanitizedTable]);
    
    // Get foreign key relationships
    const [foreignKeys] = await this.executeQuery(`
      SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [sanitizedTable]);
    
    return {
      tableName: sanitizedTable,
      columns: columns,
      foreignKeys: foreignKeys
    };
  }

  async getTableList() {
    const [tables] = await this.executeQuery(`
      SELECT TABLE_NAME, TABLE_COMMENT, TABLE_ROWS
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    
    return tables.map(table => ({
      name: table.TABLE_NAME,
      description: table.TABLE_COMMENT || '',
      estimatedRows: table.TABLE_ROWS || 0
    }));
  }

  async getTableCount(tableName) {
    const sanitizedTable = this.sanitizeIdentifier(tableName);
    const [result] = await this.executeQuery(`SELECT COUNT(*) as count FROM \`${sanitizedTable}\``);
    return result[0].count;
  }

  async getForeignKeyRelations(tableName) {
    const sanitizedTable = this.sanitizeIdentifier(tableName);
    return await this.executeQuery(`
      SELECT 
        COLUMN_NAME, 
        REFERENCED_TABLE_NAME, 
        REFERENCED_COLUMN_NAME,
        CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [sanitizedTable]);
  }

  getSampleDataQuery(tableName, limit = 3) {
    const sanitizedTable = this.sanitizeIdentifier(tableName);
    return `SELECT * FROM \`${sanitizedTable}\` LIMIT ${limit}`;
  }

  // MySQL-specific query sanitization
  sanitizeQuery(query) {
    // Remove dangerous SQL patterns
    const dangerousPatterns = [
      /\b(drop|delete|update|insert|alter|create|truncate|replace|grant|revoke)\b/i,
      /\bexec(ute)?\s*\(/i,
      /\binto\s+(outfile|dumpfile)\b/i,
      /\bload_file\s*\(/i,
      /\bsleep\s*\(/i,
      /\bbenchmark\s*\(/i,
      /--/,
      /\/\*/,
      /\*\/$/,
      /\bunion\b.*\bselect\b/i,
      /;.*\b(select|drop|delete|update|insert)\b/i,
      /\b(information_schema|sys|mysql|performance_schema)\b/i,
      /\b(concat|group_concat|substring|ascii|char|ord|length)\s*\(/i,
      /\band\s+1\s*=\s*1\b/i,
      /\bor\s+1\s*=\s*1\b/i,
      /\bif\s*\(/i,
      /\bcase\s+when\b/i
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
    const tableRegex = /\bfrom\s+`?(\w+)`?|\bjoin\s+`?(\w+)`?|\binto\s+`?(\w+)`?/gi;
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

module.exports = MySQLAdapter;
