// Simple test script to check API endpoints
const testEndpoints = async () => {
    const baseUrl = 'http://localhost:8000';
    const endpoints = ['/api/health', '/api/settings', '/api/tables', '/api/databases'];
    
    for (const endpoint of endpoints) {
        try {
            console.log(`Testing ${endpoint}...`);
            const response = await fetch(baseUrl + endpoint);
            const data = await response.json();
            console.log(`${endpoint} - Status: ${response.status}`);
            console.log(`${endpoint} - Data:`, data);
            console.log('---');
        } catch (error) {
            console.error(`${endpoint} - Error:`, error.message);
            console.log('---');
        }
    }
};

testEndpoints();