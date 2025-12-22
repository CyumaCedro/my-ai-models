const DatabaseManager = require('./database/DatabaseManager');
const MySQLAdapter = require('./database/MySQLAdapter');

/**
 * Schema Analyzer - Detects implicit foreign keys and relationships
 */
class SchemaAnalyzer {
  constructor(dbManager) {
    this.dbManager = dbManager;
    this.schemaCache = new Map();
    this.implicitRelationships = new Map();
  }

  /**
   * Analyze all tables to detect implicit foreign key relationships
   */
  async analyzeSchema() {
    try {
      const adapter = this.dbManager.getCurrentAdapter();
      const tables = await adapter.getTableList();
      
      console.log(`Analyzing schema for ${tables.length} tables...`);
      
      // Get detailed schema for all tables
      const tableSchemas = new Map();
      for (const table of tables) {
        const schema = await adapter.getTableSchema(table.name);
        tableSchemas.set(table.name, schema);
      }

      // Detect implicit relationships
      const relationships = this.detectImplicitRelationships(tableSchemas);
      
      // Cache the results
      this.schemaCache = tableSchemas;
      this.implicitRelationships = relationships;

      console.log(`Detected ${relationships.length} implicit relationships`);
      return relationships;
    } catch (error) {
      console.error('Schema analysis failed:', error);
      throw error;
    }
  }

  /**
   * Detect implicit foreign key relationships based on naming conventions and data types
   */
  detectImplicitRelationships(tableSchemas) {
    const relationships = [];
    const tables = Array.from(tableSchemas.keys());

    for (const sourceTable of tables) {
      const sourceSchema = tableSchemas.get(sourceTable);
      
      for (const column of sourceSchema.columns) {
        // Check for potential foreign key columns
        const potentialTargets = this.findPotentialTargets(column, sourceTable, tables, tableSchemas);
        
        for (const target of potentialTargets) {
          relationships.push({
            sourceTable,
            sourceColumn: column.COLUMN_NAME,
            targetTable: target.table,
            targetColumn: target.column,
            confidence: target.confidence,
            type: 'implicit',
            detectionMethod: target.method
          });
        }
      }
    }

    return relationships.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Find potential target tables/columns for a given source column
   */
  findPotentialTargets(column, sourceTable, allTables, tableSchemas) {
    const targets = [];
    const columnName = column.COLUMN_NAME.toLowerCase();
    const columnType = column.DATA_TYPE;

    // Method 1: ID column matching (user_id -> users.id)
    if (columnName.endsWith('_id')) {
      const baseName = columnName.slice(0, -3); // Remove '_id'
      const potentialTable = this.findTableByNameVariation(baseName, allTables);
      
      if (potentialTable && tableSchemas.has(potentialTable)) {
        const targetSchema = tableSchemas.get(potentialTable);
        const idColumn = targetSchema.columns.find(col => 
          col.COLUMN_NAME.toLowerCase() === 'id'
        );
        
        if (idColumn && this.isCompatibleType(columnType, idColumn.DATA_TYPE)) {
          targets.push({
            table: potentialTable,
            column: 'id',
            confidence: 0.9,
            method: 'id_suffix_matching'
          });
        }
      }
    }

    // Method 2: Table name prefix matching (order_customer_id -> customers.id)
    for (const targetTable of allTables) {
      if (targetTable === sourceTable) continue;
      
      const targetSchema = tableSchemas.get(targetTable);
      const targetTableLower = targetTable.toLowerCase();
      
      // Check if column starts with table name
      if (columnName.startsWith(targetTableLower + '_')) {
        const suffix = columnName.slice(targetTableLower.length + 1);
        
        // Look for primary key in target table
        const pkColumn = targetSchema.columns.find(col => 
          col.COLUMN_KEY === 'PRI' || col.COLUMN_NAME.toLowerCase() === 'id'
        );
        
        if (pkColumn && this.isCompatibleType(columnType, pkColumn.DATA_TYPE)) {
          targets.push({
            table: targetTable,
            column: pkColumn.COLUMN_NAME,
            confidence: 0.8,
            method: 'table_prefix_matching'
          });
        }
      }
    }

    // Method 3: Semantic matching based on column names
    const semanticMatches = this.findSemanticMatches(column, sourceTable, allTables, tableSchemas);
    targets.push(...semanticMatches);

    return targets;
  }

  /**
   * Find table by name variations (user, users, customer, customers, etc.)
   */
  findTableByNameVariation(baseName, allTables) {
    const variations = [
      baseName,
      baseName + 's',
      baseName.slice(0, -1), // Remove trailing 's'
      baseName.replace(/y$/, 'ie'), // category -> categories
      baseName.replace(/ie$/, 'y'), // categories -> category
    ];

    for (const variation of variations) {
      const found = allTables.find(table => 
        table.toLowerCase() === variation.toLowerCase()
      );
      if (found) return found;
    }

    return null;
  }

  /**
   * Check if two column types are compatible for foreign key relationships
   */
  isCompatibleType(type1, type2) {
    const compatibleTypes = {
      'int': ['int', 'tinyint', 'smallint', 'mediumint', 'bigint'],
      'varchar': ['varchar', 'char', 'text'],
      'bigint': ['bigint', 'int'],
      'smallint': ['smallint', 'int', 'tinyint']
    };

    const t1 = type1.toLowerCase();
    const t2 = type2.toLowerCase();

    // Direct match
    if (t1 === t2) return true;

    // Check compatibility groups
    for (const [base, compatible] of Object.entries(compatibleTypes)) {
      if (compatible.includes(t1) && compatible.includes(t2)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Find semantic matches based on common naming patterns
   */
  findSemanticMatches(column, sourceTable, allTables, tableSchemas) {
    const matches = [];
    const columnName = column.COLUMN_NAME.toLowerCase();
    
    // Common semantic patterns
    const semanticPatterns = {
      'created_by': ['users', 'employees', 'staff'],
      'updated_by': ['users', 'employees', 'staff'],
      'customer_id': ['customers', 'clients'],
      'user_id': ['users', 'accounts'],
      'product_id': ['products', 'items'],
      'order_id': ['orders', 'purchases'],
      'category_id': ['categories', 'types'],
      'status_id': ['statuses', 'status_types']
    };

    const patterns = semanticPatterns[columnName];
    if (patterns) {
      for (const targetTable of allTables) {
        if (patterns.includes(targetTable.toLowerCase())) {
          const targetSchema = tableSchemas.get(targetTable);
          const pkColumn = targetSchema.columns.find(col => 
            col.COLUMN_KEY === 'PRI' || col.COLUMN_NAME.toLowerCase() === 'id'
          );
          
          if (pkColumn && this.isCompatibleType(column.DATA_TYPE, pkColumn.DATA_TYPE)) {
            matches.push({
              table: targetTable,
              column: pkColumn.COLUMN_NAME,
              confidence: 0.7,
              method: 'semantic_pattern_matching'
            });
          }
        }
      }
    }

    return matches;
  }

  /**
   * Get enhanced schema including implicit relationships
   */
  async getEnhancedSchema(tableName) {
    if (this.schemaCache.size === 0) {
      await this.analyzeSchema();
    }

    const adapter = this.dbManager.getCurrentAdapter();
    const schema = await adapter.getTableSchema(tableName);
    
    // Add explicit foreign keys
    const explicitFKs = schema.foreignKeys || [];
    
    // Add implicit foreign keys
    const implicitFKs = this.implicitRelationships.filter(
      rel => rel.sourceTable === tableName
    );

    return {
      ...schema,
      explicitForeignKeys: explicitFKs,
      implicitForeignKeys: implicitFKs,
      totalRelationships: explicitFKs.length + implicitFKs.length
    };
  }

  /**
   * Get relationship suggestions for query optimization
   */
  getRelationshipSuggestions(tables) {
    const suggestions = [];
    
    // Find relationships between the specified tables
    for (const relationship of this.implicitRelationships) {
      if (tables.includes(relationship.sourceTable) && 
          tables.includes(relationship.targetTable)) {
        suggestions.push({
          type: 'implicit_join',
          sourceTable: relationship.sourceTable,
          sourceColumn: relationship.sourceColumn,
          targetTable: relationship.targetTable,
          targetColumn: relationship.targetColumn,
          confidence: relationship.confidence,
          suggestion: `Consider JOIN ${relationship.targetTable} ON ${relationship.sourceTable}.${relationship.sourceColumn} = ${relationship.targetTable}.${relationship.targetColumn}`
        });
      }
    }

    return suggestions;
  }

  /**
   * Clear schema cache
   */
  clearCache() {
    this.schemaCache.clear();
    this.implicitRelationships.clear();
  }
}

module.exports = SchemaAnalyzer;