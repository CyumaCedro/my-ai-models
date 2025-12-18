# AI Database Chat

A comprehensive chat UI that integrates Ollama LLM with MySQL database for intelligent data analysis and conversation.

## Features

- 🤖 **AI-Powered Chat**: Interface with Ollama LLM for natural language database queries
- 🗄️ **MySQL Integration**: Connect to existing MySQL databases and extract rich information
- ⚙️ **Configurable Settings**: Tune which tables the AI can focus on and customize behavior
- 🎨 **Modern UI**: Clean, responsive React-based interface with Tailwind CSS
- 🔒 **Secure**: SQL injection protection and controlled table access
- 📊 **Real-time Results**: Execute SQL queries safely and display results in real-time
- 💬 **Chat History**: Persistent conversation history with session management

## Architecture

The system consists of several microservices:

- **ollama**: LLM service running DeepSeek Coder model
- **mysql**: Database service with sample data
- **chat-backend**: Node.js API server handling chat logic and database queries
- **chat-frontend**: React-based web interface
- **ollama-webui**: Existing Open WebUI interface

## Quick Start

1. **Start all services**:
   ```bash
   docker-compose up -d
   ```

2. **Wait for services to initialize** (2-3 minutes for first run):
   ```bash
   docker-compose logs -f ollama-init
   ```

3. **Access the applications**:
   - **AI Database Chat**: http://localhost:3100
   - **Ollama WebUI**: http://localhost:3000
   - **API Health Check**: http://localhost:8000/health

## Usage

### Basic Chat

1. Open http://localhost:3100 in your browser
2. Start asking questions about your database, for example:
   - "Show me all customers"
   - "How many orders are pending?"
   - "What products do we have in stock?"
   - "Find all orders for customer John Doe"

### Settings Configuration

Click the Settings button to configure:

- **Enabled Tables**: Choose which tables the AI can access
- **Max Results**: Limit the number of query results
- **Response Style**: Professional, Casual, or Technical
- **Schema Info**: Include table structure in AI context
- **Cache Duration**: How long to cache query results

### Sample Database Tables

The system includes sample tables:
- `customers`: Customer information
- `orders`: Order data with customer relationships
- `products`: Product catalog
- `chat_settings`: Configuration storage
- `chat_history`: Conversation logs

## API Endpoints

### Chat API
- `POST /api/chat` - Send a message to the AI
- `GET /api/history/:sessionId` - Get chat history

### Settings API
- `GET /api/settings` - Get current settings
- `PUT /api/settings` - Update settings

### Database API
- `GET /api/tables` - Get available tables and row counts
- `GET /health` - Health check

## Security Features

- **SQL Injection Protection**: Blocks dangerous SQL keywords
- **Table Access Control**: Only allows access to configured tables
- **Query Limiting**: Automatic LIMIT clauses to prevent large result sets
- **Input Validation**: Comprehensive request validation

## Development

### Backend Development
```bash
cd chat-backend
npm install
npm run dev
```

### Frontend Development
```bash
cd chat-frontend
npm install
npm start
```

### Database Management
```bash
# Connect to MySQL
docker exec -it mysql-db mysql -u chatuser -p chatdb

# View logs
docker-compose logs -f mysql
```

## Configuration

### Environment Variables

**Backend (chat-backend)**:
- `MYSQL_HOST`: MySQL server host (default: mysql)
- `MYSQL_PORT`: MySQL port (default: 3306)
- `MYSQL_DATABASE`: Database name (default: chatdb)
- `MYSQL_USER`: MySQL user (default: chatuser)
- `MYSQL_PASSWORD`: MySQL password (default: chatpass)
- `OLLAMA_URL`: Ollama API URL (default: http://ollama:11434)
- `OLLAMA_MODEL`: Model name (default: deepseek-coder-v2:16b-lite-instruct-q4_K_M)

**Frontend (chat-frontend)**:
- `REACT_APP_API_URL`: Backend API URL (default: http://localhost:8000)

### Custom Database Integration

To connect to your existing MySQL database:

1. Update the `mysql` service in `docker-compose.yml`:
   ```yaml
   environment:
     - MYSQL_ROOT_PASSWORD=your_password
     - MYSQL_DATABASE=your_database
     - MYSQL_USER=your_user
     - MYSQL_PASSWORD=your_password
   ```

2. Create initialization scripts in `db/init/`:
   ```sql
   -- Your table creation scripts
   CREATE TABLE your_table (...);
   ```

3. Update the default settings in the database to include your table names:
   ```sql
   INSERT INTO chat_settings (setting_name, setting_value, description) 
   VALUES ('enabled_tables', 'your_table1,your_table2', 'Tables AI can access');
   ```

## Troubleshooting

### Common Issues

1. **Ollama model not found**:
   - Wait for `ollama-init` container to complete
   - Check logs: `docker-compose logs ollama-init`

2. **Database connection errors**:
   - Verify MySQL container is running: `docker-compose ps mysql`
   - Check database logs: `docker-compose logs mysql`

3. **Frontend not loading**:
   - Check backend health: `curl http://localhost:8000/health`
   - Verify nginx logs: `docker-compose logs chat-frontend`

4. **Query execution fails**:
   - Check if tables are enabled in settings
   - Verify table names are spelled correctly
   - Check backend logs for detailed errors

### Logs

Monitor service logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f chat-backend
docker-compose logs -f chat-frontend
docker-compose logs -f mysql
docker-compose logs -f ollama
```

## Scaling and Performance

- **Horizontal Scaling**: The backend is stateless and can be scaled horizontally
- **Database Optimization**: Consider adding indexes for frequently queried columns
- **Caching**: The application includes configurable caching for query results
- **Resource Limits**: Adjust memory/CPU limits in docker-compose.yml as needed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
