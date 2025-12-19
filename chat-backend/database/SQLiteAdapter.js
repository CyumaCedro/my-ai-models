const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const DatabaseAdapter = require('./DatabaseAdapter');

/**
 * SQLite database adapter
 */
class SQLiteAdapter extends DatabaseAdapter {
  constructor(config) {
    super(config);
    this.type = 'sqlite';
    this.db = null;
  }

  getDatabaseType() {
    return 'sqlite';
  }

  async connect() {
    try {
      this.db = await open({
        filename: this.config.database || './chatdb.sqlite',
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
      });
      
      // Test connection
      await this.db.get('SELECT 1');
      
      console.log(`Connected to SQLite database: ${this.config.database || './chatdb.sqlite'}`);
      return true;
    } catch (error) {
      console.error('SQLite connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.db) {
      await this.db.close();
      console.log('SQLite connection closed');
    }
  }

  async executeQuery(query, params = []) {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      // For SELECT queries
      if (query.trim().toLowerCase().startsWith('select')) {
        const rows = await this.db.all(query, params);
        return rows;
      } else {
        // For other queries (shouldn't happen with our safety checks)
        await this.db.run(query, params);
        return [];
      }
    } catch (error) {
      console.error('SQLite query error:', error);
      throw new Error(`Query failed: ${error.message}`);
    }
  }

  async getTableSchema(tableName) {
    const sanitizedTable = this.sanitizeIdentifier(tableName);
    
    // Get column information
    const columns = await this.executeQuery(`PRAGMA table_info("${sanitizedTable}")`);
    
    // Get foreign key information
    const foreignKeys = await this.executeQuery(`PRAGMA foreign_key_list("${sanitizedTable}")`);
    
    // Format columns to match other adapters
    const formattedColumns = columns.map(col => ({
      COLUMN_NAME: col.name,
      DATA_TYPE: col.type,
      IS_NULLABLE: col.notnull ? 'NO' : 'YES',
      COLUMN_KEY: col.pk ? 'PRI' : '',
      COLUMN_DEFAULT: col.dflt_value,
      COLUMN_COMMENT: '',
      CHARACTER_MAXIMUM_LENGTH: null
    }));
    
    // Format foreign keys to match other adapters
    const formattedForeignKeys = foreignKeys.map(fk => ({
      COLUMN_NAME: fk.from,
      REFERENCED_TABLE_NAME: fk.table,
      REFERENCED_COLUMN_NAME: fk.to
    }));
    
    return {
      tableName: sanitizedTable,
      columns: formattedColumns,
      foreignKeys: formattedForeignKeys
    };
  }

  async getTableList() {
    const tables = await this.executeQuery(`
      SELECT name as table_name 
      FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    
    const tableList = [];
    for (const table of tables) {
      const count = await this.getTableCount(table.table_name);
      tableList.push({
        name: table.table_name,
        description: '',
        estimatedRows: count
      });
    }
    
    return tableList;
  }

  async getTableCount(tableName) {
    const sanitizedTable = this.sanitizeIdentifier(tableName);
    const result = await this.executeQuery(`SELECT COUNT(*) as count FROM "${sanitizedTable}"`);
    return result[0].count;
  }

  async getForeignKeyRelations(tableName) {
    const sanitizedTable = this.sanitizeIdentifier(tableName);
    const foreignKeys = await this.executeQuery(`PRAGMA foreign_key_list("${sanitizedTable}")`);
    
    return foreignKeys.map(fk => ({
      COLUMN_NAME: fk.from,
      REFERENCED_TABLE_NAME: fk.table,
      REFERENCED_COLUMN_NAME: fk.to,
      CONSTRAINT_NAME: `fk_${fk.from}_${fk.table}`
    }));
  }

  getSampleDataQuery(tableName, limit = 3) {
    const sanitizedTable = this.sanitizeIdentifier(tableName);
    return `SELECT * FROM "${sanitizedTable}" LIMIT ${limit}`;
  }

  // SQLite-specific query sanitization
  sanitizeQuery(query) {
    // Remove dangerous SQL patterns
    const dangerousPatterns = [
      /\b(drop|delete|update|insert|alter|create|truncate|replace|grant|revoke)\b/i,
      /\bexec(ute)?\s*\(/i,
      /\battach\s+database\b/i,
      /\bdetach\s+database\b/i,
      /\bvacuum\b/i,
      /\bpragma\b/i,
      /--/,
      /\/\*/,
      /\*\/$/,
      /\bunion\b.*\bselect\b/i,
      /;.*\b(select|drop|delete|update|insert)\b/i,
      /\b(sqlite_master|sqlite_temp_master|sqlite_sequence)\b/i,
      /\b(substr|substring|ascii|char|length)\s*\(/i,
      /\band\s+1\s*=\s*1\b/i,
      /\bor\s+1\s*=\s*1\b/i,
      /\bcase\s+when\b/i,
      /\bload_extension\s*\(/i
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

  // Override validateTableName for SQLite
  validateTableName(tableName) {
    const sanitized = this.sanitizeIdentifier(tableName);
    const dangerousNames = ['sqlite_master', 'sqlite_temp_master', 'sqlite_sequence'];
    return !dangerousNames.includes(sanitized.toLowerCase());
  }
}

module.exports = SQLiteAdapter;
