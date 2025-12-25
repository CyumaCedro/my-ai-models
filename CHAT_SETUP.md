# Chat Application Setup Instructions

## Issues Found and Fixed

### Backend Issues
1. **Missing userContext in validation schema**: The `server-enhanced.js` file was missing `userContext` in the Joi validation schema, causing the frontend requests to be rejected.
2. **Missing destructuring**: The userContext wasn't being extracted from the request body.

### Frontend Issues  
1. **Missing API URL configuration**: The frontend was using an empty string for `REACT_APP_API_URL`, causing it to make requests to the same domain instead of the backend server.

## Fixes Applied

### 1. Backend Fixes
- Updated `chat-backend/server-enhanced.js` to include `userContext` in the validation schema
- Fixed the destructuring to extract `userContext` from the request body
- The backend will now properly accept and process userContext data

### 2. Frontend Fixes
- Created `chat-frontend/.env` file with `REACT_APP_API_URL=http://localhost:8000`
- This ensures the frontend properly connects to the backend server

### 3. Startup Scripts
- Created `start-backend.bat` and `start-backend.ps1` for starting the backend server
- Created `start-frontend.bat` for starting the frontend development server

## Requirements

### Prerequisites
1. **Node.js** (v14 or higher) - Must be installed and in PATH
2. **npm** (comes with Node.js)
3. **MySQL** database server (or configure for PostgreSQL/SQLite in `.env`)
4. **Git** (optional, for version control)

### Database Setup
1. Create a MySQL database named `chatdb`
2. Create a user with access to the database:
   ```sql
   CREATE USER 'chatuser'@'localhost' IDENTIFIED BY 'chatpass';
   GRANT ALL PRIVILEGES ON chatdb.* TO 'chatuser'@'localhost';
   FLUSH PRIVILEGES;
   ```

## Installation and Setup

### 1. Install Dependencies

#### Backend
```bash
cd chat-backend
npm install
```

#### Frontend
```bash
cd chat-frontend
npm install
```

### 2. Environment Configuration

#### Backend (.env)
Copy `chat-backend/.env.example` to `chat-backend/.env` and configure:
- Database connection settings
- Ollama URL and model
- Performance settings

#### Frontend (.env)
The `.env` file has already been created with:
```
REACT_APP_API_URL=http://localhost:8000
```

### 3. Start the Applications

#### Method 1: Using the provided scripts
1. Start backend:
   ```bash
   # On Windows
   start-backend.bat
   
   # Or using PowerShell
   start-backend.ps1
   ```

2. Start frontend (in a separate terminal):
   ```bash
   start-frontend.bat
   ```

#### Method 2: Manual startup
1. Start backend:
   ```bash
   cd chat-backend
   node server-enhanced.js
   ```

2. Start frontend (in separate terminal):
   ```bash
   cd chat-frontend
   npm start
   ```

## Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Health Check**: http://localhost:8000/api/health

## Troubleshooting

### Common Issues

1. **"node is not recognized" error**
   - Install Node.js from https://nodejs.org
   - Ensure Node.js is added to your system PATH

2. **Database connection failed**
   - Verify MySQL is running
   - Check database credentials in `.env` file
   - Ensure the database exists

3. **Frontend can't connect to backend**
   - Verify backend is running on port 8000
   - Check the `REACT_APP_API_URL` in `chat-frontend/.env`
   - Ensure no firewall is blocking the connection

4. **"userContext is not allowed" error**
   - This has been fixed in the latest backend changes
   - Restart the backend server to apply changes

### Port Conflicts
- If port 8000 is in use, change the `PORT` in backend `.env` file
- If port 3000 is in use, React will automatically try the next available port (3001, 3002, etc.)

### Debug Mode
For additional debugging, you can:
1. Open browser developer tools (F12)
2. Check the Console tab for JavaScript errors
3. Check the Network tab for failed API requests
4. Set `NODE_ENV=development` in backend `.env` for detailed logging

## Testing the Chat

Once both servers are running:
1. Open http://localhost:3000 in your browser
2. You'll be prompted to enter your name and email
3. Enter a test message like "Hello, how are you?"
4. The AI should respond with a greeting

## File Structure

```
my-ai-models/
├── chat-backend/
│   ├── server-enhanced.js      # Main backend server (fixed)
│   ├── server.js              # Alternative backend server
│   ├── .env.example           # Environment template
│   └── package.json           # Backend dependencies
├── chat-frontend/
│   ├── src/App.js            # Main React component
│   ├── .env                  # Frontend environment (created)
│   └── package.json          # Frontend dependencies
├── start-backend.bat         # Backend startup script
├── start-frontend.bat        # Frontend startup script
└── CHAT_SETUP.md            # This file
```

## Next Steps

1. Install Node.js if not already installed
2. Install dependencies for both backend and frontend
3. Configure your database connection
4. Start both servers using the provided scripts
5. Access the application at http://localhost:3000

If you encounter any issues, check the troubleshooting section or review the browser console for specific error messages.