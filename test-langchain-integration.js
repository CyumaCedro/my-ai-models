const DatabaseManager = require('./chat-backend/database/DatabaseManager');
const LangChainManager = require('./chat-backend/database/LangChainManager');
require('dotenv').config({ path: './chat-backend/.env' });

async function testLangChain() {
  console.log('🧪 Testing LangChain Integration\n');

  const dbManager = new DatabaseManager();
  const langChainManager = new LangChainManager(dbManager);

  const config = {
    type: process.env.DB_TYPE || 'mysql',
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'chatuser',
    password: process.env.MYSQL_PASSWORD || 'chatpass',
    database: process.env.MYSQL_DATABASE || 'chatdb'
  };

  try {
    console.log('1. Initializing Database Manager...');
    await dbManager.initialize(config);
    console.log('✅ DB Manager initialized\n');

    console.log('2. Initializing LangChain Manager...');
    const settings = {
      ollama_url: process.env.OLLAMA_URL || 'http://localhost:11434',
      ollama_model: process.env.OLLAMA_MODEL || 'deepseek-coder-v2',
      enabled_tables: 'products,chat_settings'
    };
    
    const lcInit = await langChainManager.initialize(settings);
    if (!lcInit) {
      console.log('❌ LangChain initialization failed (Ollama might not be running or reachable)');
      process.exit(1);
    }
    console.log('✅ LangChain Manager initialized\n');

    console.log('3. Testing simple question...');
    const question = 'How many products are in the database?';
    console.log(`Question: "${question}"`);
    
    const result = await langChainManager.ask(question, settings);
    if (result) {
      console.log('\nResponse:', result.output);
      if (result.intermediateSteps) {
        console.log('\nIntermediate Steps detected.');
      }
    } else {
      console.log('❌ No response from LangChain');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await dbManager.disconnectAll();
    process.exit(0);
  }
}

testLangChain();
