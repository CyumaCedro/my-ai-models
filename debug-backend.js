const axios = require('axios');

async function debugAPI() {
  const baseUrl = 'http://localhost:8000';
  
  console.log('--- Testing Health Endpoint ---');
  try {
    const health = await axios.get(`${baseUrl}/health`);
    console.log('Health:', JSON.stringify(health.data, null, 2));
  } catch (e) {
    console.log('Health Failed:', e.message);
  }

  console.log('\n--- Testing Settings Endpoint ---');
  try {
    const settings = await axios.get(`${baseUrl}/api/settings`);
    console.log('Settings:', JSON.stringify(settings.data, null, 2));
  } catch (e) {
    console.log('Settings Failed:', e.message);
  }

  console.log('\n--- Testing Tables Endpoint ---');
  try {
    const tables = await axios.get(`${baseUrl}/api/tables`);
    console.log('Tables:', JSON.stringify(tables.data, null, 2));
  } catch (e) {
    console.log('Tables Failed:', e.message);
  }
}

debugAPI();
