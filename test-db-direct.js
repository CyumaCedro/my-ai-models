#!/usr/bin/env node

// Test script to check database and tables
const mysql = require('mysql2/promise');

async function testDatabase() {
  let connection;
  try {
    // Connect to database using same credentials as backend
    connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'chatuser',
      password: 'chatpass',
      database: 'chatdb'
    });

    console.log('✅ Connected to MySQL database');

    // Check what tables exist
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME, TABLE_COMMENT 
       FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = 'chatdb' 
       AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`
    );

    console.log('\n📋 Tables found:', tables.length);
    tables.forEach(table => {
      console.log(`  - ${table.TABLE_NAME} (${table.TABLE_COMMENT || 'no comment'})`);
    });

    // Check chat_settings
    const [settings] = await connection.execute('SELECT * FROM chat_settings');
    console.log('\n⚙️ Settings found:', settings.length);
    settings.forEach(setting => {
      console.log(`  - ${setting.setting_name}: ${setting.setting_value}`);
    });

    // Check products table specifically
    try {
      const [products] = await connection.execute('SELECT COUNT(*) as count FROM products');
      console.log(`\n🛍️ Products table: ${products[0].count} rows`);
    } catch (error) {
      console.log('\n❌ Products table not accessible:', error.message);
    }

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testDatabase();