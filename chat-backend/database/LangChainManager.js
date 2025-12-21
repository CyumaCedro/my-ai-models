const { ChatOllama } = require("@langchain/ollama");
const { SqlDatabase } = require("langchain/sql_db");
const { createSqlAgent, SqlToolkit } = require("langchain/agents/toolkits/sql");
const { DataSource } = require("typeorm");

/**
 * LangChain Manager - Handles intelligent data querying using LangChain
 */
class LangChainManager {
  constructor(dbManager) {
    this.dbManager = dbManager;
    this.llm = null;
    this.db = null;
    this.executor = null;
    this.initialized = false;
  }

  /**
   * Initialize LangChain with database connection and LLM
   */
  async initialize(settings = {}) {
    try {
      const config = this.dbManager.getConfig();
      if (!config) {
        throw new Error("Database configuration not available in DB Manager");
      }

      // 1. Initialize LLM (Ollama)
      const ollamaUrl = settings.ollama_url || 'http://192.168.1.70:11434';
      const model = settings.ollama_model || 'deepseek-coder-v2';
      
      this.llm = new ChatOllama({
        baseUrl: ollamaUrl,
        model: model,
        temperature: 0,
      });

      // 2. Initialize Database connection for LangChain (TypeORM)
      const dbType = (config.type || 'mysql').toLowerCase();
      const dataSourceOptions = {
        type: dbType === 'postgresql' ? 'postgres' : dbType,
        host: config.host || 'localhost',
        port: config.port || (dbType === 'postgresql' ? 5432 : 3306),
        username: config.user || 'chatuser',
        password: config.password || 'chatpass',
        database: config.database || 'chatdb',
      };

      if (dbType === 'sqlite') {
        dataSourceOptions.database = config.database || './chatdb.sqlite';
      }

      const datasource = new DataSource(dataSourceOptions);
      await datasource.initialize();

      this.db = await SqlDatabase.fromDataSourceParams({
        appDataSource: datasource,
        includesTables: settings.enabled_tables ? 
          settings.enabled_tables.split(',').map(t => t.trim()) : undefined,
      });

      // 3. Initialize SQL Agent
      const toolkit = new SqlToolkit(this.db, this.llm);
      this.executor = createSqlAgent(this.llm, toolkit);

      this.initialized = true;
      console.log("LangChain initialized successfully with " + dbType + " database");
      return true;
    } catch (error) {
      console.error("LangChain initialization failed:", error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Ask a question using LangChain's SQL agent
   */
  async ask(question, settings = {}) {
    if (!this.initialized) {
      const success = await this.initialize(settings);
      if (!success) return null;
    }

    try {
      const result = await this.executor.invoke({ input: question });
      return {
        output: result.output,
        intermediateSteps: result.intermediateSteps
      };
    } catch (error) {
      console.error("LangChain execution error:", error);
      return null;
    }
  }

  /**
   * Check if LangChain is initialized
   */
  isInitialized() {
    return this.initialized;
  }
}

module.exports = LangChainManager;
