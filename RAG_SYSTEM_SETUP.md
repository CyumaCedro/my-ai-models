# RAG Chat System Setup Guide

## Overview
This system has been transformed into a RAG (Retrieval-Augmented Generation) chat system with vector database integration, user context collection, and admin management interface.

## New Features Added

### 1. Vector Database Integration
- **ChromaDB**: Primary vector database for document storage and retrieval
- **OpenAI Embeddings**: For generating text embeddings
- **Fallback Storage**: In-memory storage if vector database is unavailable

### 2. User Context Collection
- **Name/Email Collection**: Users provide personal information for context
- **Persistent Storage**: User context saved in localStorage
- **Personalized Responses**: AI responses enhanced with user context

### 3. Admin Interface
- **Prompt Management**: Create, edit, and delete system prompts
- **Bot Configuration**: Manage AI personality, tone, and response style
- **Knowledge Base**: Add and manage documents for RAG retrieval

### 4. RAG Pipeline
- **Query Enhancement**: User queries enhanced with relevant context
- **Document Retrieval**: Automatic retrieval of relevant documents
- **Context Injection**: Retrieved context injected into AI prompts

## Installation & Setup

### Prerequisites
- Node.js 16+
- MySQL/PostgreSQL/SQLite database
- OpenAI API key (for embeddings)
- ChromaDB (optional, has fallback)

### 1. Install Dependencies
```bash
cd chat-backend
npm install

cd ../chat-frontend
npm install
```

### 2. Environment Configuration
Create `.env` file in `chat-backend/`:

```env
# Database Configuration
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=chatuser
MYSQL_PASSWORD=chatpass
MYSQL_DATABASE=chatdb

# Ollama Configuration
OLLAMA_URL=http://192.168.1.70:11434
OLLAMA_MODEL=deepseek-coder-v2

# Vector Database Configuration
CHROMA_URL=http://localhost:8000
OPENAI_API_KEY=your-openai-api-key-here

# RAG Configuration
ENABLE_RAG=true
MAX_CONTEXT_LENGTH=4000
SIMILARITY_THRESHOLD=0.7

# Server Configuration
PORT=8000
NODE_ENV=development
```

### 3. Database Setup
Run the database initialization scripts:

```bash
cd db/init
mysql -u chatuser -p chatdb < 01-init.sql
mysql -u chatuser -p chatdb < 02-sample-data.sql
```

### 4. Start Services

#### Option A: With ChromaDB
```bash
# Start ChromaDB (in separate terminal)
chroma run --host localhost --port 8000

# Start Backend
cd chat-backend
npm run dev

# Start Frontend
cd chat-frontend
npm start
```

#### Option B: Without ChromaDB (Fallback Mode)
```bash
# Start Backend
cd chat-backend
npm run dev

# Start Frontend
cd chat-frontend
npm start
```

## Usage Guide

### For Users
1. **First Time Setup**: Enter your name and email when prompted
2. **Start Chatting**: Ask questions as usual
3. **Enhanced Responses**: System automatically retrieves relevant context

### For Administrators
1. **Access Admin Panel**: Click "Admin" button in header
2. **Enter Password**: Use default password `admin123` (change in production!)
3. **Manage Prompts**: Create custom system prompts
4. **Configure Bot**: Set AI personality and response style
5. **Add Knowledge**: Upload documents for RAG retrieval

## Key Components

### Backend Files
- `database/VectorDatabase.js` - Vector database management
- `database/RAGEngine.js` - RAG pipeline implementation
- `routes/admin.js` - Admin API endpoints
- `server.js` - Updated with RAG integration

### Frontend Files
- `src/AdminInterface.js` - Admin management UI
- `src/App.js` - Updated with user context and admin integration

## API Endpoints

### New Admin Endpoints
- `GET /api/admin/prompts` - List all prompts
- `POST /api/admin/prompts` - Create new prompt
- `PUT /api/admin/prompts/:id` - Update prompt
- `DELETE /api/admin/prompts/:id` - Delete prompt
- `GET /api/admin/bot-configs` - List bot configurations
- `POST /api/admin/bot-configs` - Create bot config
- `PUT /api/admin/bot-configs/:id` - Update bot config
- `GET /api/admin/knowledge` - List knowledge base
- `POST /api/admin/knowledge` - Add knowledge item

### Enhanced Chat Endpoint
- `POST /api/chat` - Now accepts `userContext` parameter

## Configuration Options

### RAG Settings
- `ENABLE_RAG`: Enable/disable RAG functionality
- `MAX_CONTEXT_LENGTH`: Maximum context length (tokens)
- `SIMILARITY_THRESHOLD`: Minimum similarity for document retrieval

### Vector Database
- `CHROMA_URL`: ChromaDB server URL
- `OPENAI_API_KEY`: OpenAI API key for embeddings

## Security Notes

### Production Deployment
1. **Change Admin Password**: Update password in `App.js`
2. **Use Environment Variables**: Never commit API keys
3. **Enable Authentication**: Implement proper user authentication
4. **Database Security**: Use proper database credentials
5. **HTTPS**: Enable SSL/TLS for production

### Access Control
- Admin panel currently uses simple password protection
- Implement proper role-based access control (RBAC)
- Add user authentication and session management

## Troubleshooting

### Common Issues
1. **Vector Database Connection**: Falls back to in-memory storage
2. **OpenAI API Key**: Required for embeddings, check if valid
3. **User Context**: Stored in localStorage, cleared on browser reset
4. **Admin Access**: Default password is `admin123`

### Debug Mode
Enable debug logging by setting `NODE_ENV=development`.

## Next Steps

### Potential Enhancements
1. **User Authentication**: Implement proper login system
2. **File Upload**: Allow document uploads via admin interface
3. **Multiple Vector Stores**: Support for Pinecone, Weaviate, etc.
4. **Advanced RAG**: Implement query decomposition, reranking
5. **Analytics**: Add usage tracking and performance metrics
6. **API Rate Limiting**: Implement proper rate limiting
7. **Caching**: Add Redis caching for better performance

### Performance Optimization
1. **Embedding Caching**: Cache frequently used embeddings
2. **Batch Processing**: Process multiple documents efficiently
3. **Database Indexing**: Optimize database queries
4. **CDN Integration**: Serve static assets via CDN

## Support

For issues and questions:
1. Check the console logs for error messages
2. Verify environment variables are set correctly
3. Ensure database connectivity
4. Test with sample data first

---

**System Status**: ✅ RAG system implemented and ready for testing