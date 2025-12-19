const { v4: uuidv4 } = require('uuid');

/**
 * Abstract base class for database adapters
 */
class DatabaseAdapter {
  constructor(config) {
    this.config = config;
    this.pool = null;
    this.type = this.getDatabaseType();
  }

  getDatabaseType() {
    throw new Error('getDatabaseType() must be implemented by subclass');
  }

  async connect() {
    throw new Error('connect() must be implemented by subclass');
  }

  async disconnect() {
    throw new Error('disconnect() must be implemented by subclass');
  }

  async executeQuery(query, params = []) {
    throw new Error('executeQuery() must be implemented by subclass');
  }

  async getTableSchema(tableName) {
    throw new Error('getTableSchema() must be implemented by subclass');
  }

  async getTableList() {
    throw new Error('getTableList() must be implemented by subclass');
  }

  async getTableCount(tableName) {
    throw new Error('getTableCount() must be implemented by subclass');
  }

  async getForeignKeyRelations(tableName) {
    throw new Error('getForeignKeyRelations() must be implemented by subclass');
  }

  async getSampleData(tableName, limit = 3) {
    const query = this.getSampleDataQuery(tableName, limit);
    return await this.executeQuery(query);
  }

  getSampleDataQuery(tableName, limit) {
    throw new Error('getSampleDataQuery() must be implemented by subclass');
  }

  sanitizeIdentifier(identifier) {
    // Basic identifier sanitization
    return identifier.replace(/[^a-zA-Z0-9_]/g, '');
  }

  validateTableName(tableName) {
    const sanitized = this.sanitizeIdentifier(tableName);
    const dangerousNames = ['information_schema', 'sys', 'mysql', 'performance_schema', 'pg_catalog', 'sqlite_master'];
    return !dangerousNames.includes(sanitized.toLowerCase());
  }

  async healthCheck() {
    try {
      await this.executeQuery('SELECT 1');
      return { status: 'healthy', type: this.type };
    } catch (error) {
      return { status: 'unhealthy', type: this.type, error: error.message };
    }
  }
}

module.exports = DatabaseAdapter;
