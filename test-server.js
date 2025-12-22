const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 8001; // Different port for testing

app.use(cors());
app.use(express.json());

// Test endpoint to simulate the chat response
app.post('/api/chat', async (req, res) => {
  console.log('Received request:', req.body);
  
  const { message } = req.body;
  
  // Simulate the logic for handling general questions
  const dataKeywords = [
    'show', 'list', 'get', 'find', 'search', 'count', 'how many', 'how much',
    'what', 'when', 'where', 'who', 'which', 'display', 'give me', 'tell me',
    'average', 'total', 'sum', 'maximum', 'minimum', 'latest', 'recent',
    'customers', 'products', 'orders', 'order_items', 'table', 'database'
  ];
  
  const tableNames = ['customers', 'products', 'orders', 'order_items', 'chat_history', 'chat_settings'];
  const hasTableReference = tableNames.some(table => 
    message.toLowerCase().includes(table)
  );
  
  const isDataRequest = dataKeywords.some(keyword => 
    message.toLowerCase().includes(keyword)
  ) || hasTableReference;
  
  console.log('Is data request:', isDataRequest, 'Has table reference:', hasTableReference);
  
  let response;
  
  if (isDataRequest) {
    response = "I can help you with database queries. However, I'm not connected to a database in this test mode.";
  } else {
    // Simulate general AI response for chemistry question
    if (message.toLowerCase().includes('chemistry')) {
      response = "Chemistry is the scientific study of matter and the changes it undergoes. It explores the properties, composition, and behavior of atoms and molecules. Chemistry is fundamental to understanding the world around us, from the air we breathe to the materials we use every day. Is there a specific aspect of chemistry you'd like to know more about?";
    } else {
      response = "I'm here to help! You can ask me about database topics or general questions. For database queries, try asking about customers, products, or orders. For general questions, feel free to ask about any topic!";
    }
  }
  
  // Always return a successful response with proper structure
  res.json({
    success: true,
    response: response,
    sessionId: req.body.sessionId || 'test_session',
    queryResults: null,
    tablesAccessed: []
  });
});

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
  console.log('Test with: curl -X POST http://localhost:${PORT}/api/chat -H "Content-Type: application/json" -d \'{"message":"chemistry","sessionId":"test"}\'');
});