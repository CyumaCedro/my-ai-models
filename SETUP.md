# Chat Application Setup Guide

## Prerequisites

Before running the chat application, you need to install the following:

### 1. Node.js and npm
Download and install Node.js from https://nodejs.org/ (LTS version recommended)
This will automatically install npm (Node Package Manager)

### 2. Database Setup
Choose one of the following database options:

#### Option A: MySQL (Recommended)
- Install MySQL Server
- Create a database named `chatdb`
- Create a user with permissions:
```sql
CREATE USER 'chatuser'@'localhost' IDENTIFIED BY 'chatpass';
GRANT ALL PRIVILEGES ON chatdb.* TO 'chatuser'@'localhost';
FLUSH PRIVILEGES;
```

#### Option B: PostgreSQL
- Install PostgreSQL
- Create a database named `chatdb`
- Create a user with permissions

#### Option C: SQLite (No installation required)
- SQLite is included as a fallback option

## Installation Steps

### 1. Install Backend Dependencies
```bash
cd chat-backend
npm install
```

### 2. Install Frontend Dependencies
```bash
cd chat-frontend
npm install
```

### 3. Environment Configuration
Create a `.env` file in the `chat-backend` directory:

```env
# Database Configuration
DB_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=chatuser
MYSQL_PASSWORD=chatpass
MYSQL_DATABASE=chatdb

# Ollama Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-coder-v2

# Server Configuration
PORT=8000
CONNECTION_LIMIT=10
```

### 4. Database Initialization
The application will automatically create necessary tables on first run.

## Running the Application

### Start Backend Server
```bash
cd chat-backend
npm start
```
The backend will start on http://localhost:8000

### Start Frontend Development Server
```bash
cd chat-frontend
npm start
```
The frontend will start on http://localhost:3000

## Docker Setup (Alternative)

If you prefer using Docker, use the provided docker-compose.yml:

```bash
docker-compose up -d
```

## Troubleshooting

### Common Issues

1. **"npm: command not found"**
   - Install Node.js from https://nodejs.org/

2. **Database connection failed**
   - Check database service is running
   - Verify database credentials in .env file
   - Ensure database user has proper permissions

3. **Frontend cannot connect to backend**
   - Ensure backend is running on port 8000
   - Check CORS configuration

4. **SQLite dependencies missing**
   - Run `npm install sqlite3 sqlite` in backend directory

5. **Ollama connection failed**
   - Install Ollama from https://ollama.ai/
   - Pull a model: `ollama pull deepseek-coder-v2`
   - Update OLLAMA_URL in .env if needed

### Health Checks
- Backend health: http://localhost:8000/health
- Frontend: http://localhost:3000

## Features

- AI-powered chat interface
- Database query capabilities
- Multiple database support (MySQL, PostgreSQL, SQLite)
- Real-time conversation history
- Settings management
- Table schema information
- Query result visualization

## Security Notes

- Only SELECT queries are allowed for database security
- SQL injection protection is implemented
- User input validation and sanitization
- Secure database connection pooling