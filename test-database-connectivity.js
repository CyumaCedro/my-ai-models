// Test script to verify database connectivity and functionality
const DatabaseManager = require('./chat-backend/database/DatabaseManager');

async function testDatabaseConnectivity() {
  console.log('🧪 Testing Database Connectivity\n');
  
  const dbManager = new DatabaseManager();
  
  // Test configurations for different database types
  const testConfigs = [
    {
      name: 'MySQL',
      config: {
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        user: 'chatuser',
        password: 'chatpass',
        database: 'chatdb'
      }
    },
    {
      name: 'PostgreSQL',
      config: {
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        user: 'chatuser',
        password: 'chatpass',
        database: 'chatdb'
      }
    },
    {
      name: 'SQLite',
      config: {
        type: 'sqlite',
        database: './test-chatdb.sqlite'
      }
    }
  ];

  for (const test of testConfigs) {
    console.log(`\n📊 Testing ${test.name}...`);
    
    try {
      // Initialize database connection
      await dbManager.initialize(test.config);
      console.log(`✅ ${test.name} connection established`);
      
      // Test health check
      const health = await dbManager.getHealthStatus();
      console.log(`✅ ${test.name} health check: ${health.status}`);
      
      // Test table listing
      try {
        const tables = await dbManager.getTableList();
        console.log(`✅ ${test.name} tables found: ${tables.length}`);
        
        if (tables.length > 0) {
          console.log(`   Available tables: ${tables.map(t => t.name).join(', ')}`);
        }
      } catch (tableErr) {
        console.log(`⚠️  ${test.name} table listing failed: ${tableErr.message}`);
      }
      
      // Test basic query
      try {
        const result = await dbManager.getCurrentAdapter().executeQuery('SELECT 1 as test');
        console.log(`✅ ${test.name} basic query successful`);
      } catch (queryErr) {
        console.log(`❌ ${test.name} basic query failed: ${queryErr.message}`);
      }
      
      // Test safe query execution
      try {
        const safeResult = await dbManager.executeSafeQuery('SELECT 1 as test', {
          enabled_tables: 'chat_settings',
          max_results: 10
        });
        console.log(`✅ ${test.name} safe query execution successful`);
      } catch (safeErr) {
        console.log(`⚠️  ${test.name} safe query failed: ${safeErr.message}`);
      }
      
    } catch (error) {
      console.log(`❌ ${test.name} connection failed: ${error.message}`);
    } finally {
      // Always try to disconnect
      try {
        await dbManager.disconnectAll();
        console.log(`✅ ${test.name} disconnected cleanly`);
      } catch (disconnectErr) {
        console.log(`⚠️  ${test.name} disconnect error: ${disconnectErr.message}`);
      }
    }
  }
  
  console.log('\n🎯 Database Connectivity Test Complete!');
  console.log('\n💡 To use a specific database, set DB_TYPE in your .env file:');
  console.log('   DB_TYPE=mysql    # For MySQL');
  console.log('   DB_TYPE=postgresql # For PostgreSQL');
  console.log('   DB_TYPE=sqlite     # For SQLite');
}

// Run the test
testDatabaseConnectivity().catch(console.error);
