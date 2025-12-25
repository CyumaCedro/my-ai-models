#!/bin/bash

echo "🚀 Setting up RAG Chat System..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd chat-backend
if npm install; then
    echo "✅ Backend dependencies installed"
else
    echo "❌ Failed to install backend dependencies"
    exit 1
fi

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../chat-frontend
if npm install; then
    echo "✅ Frontend dependencies installed"
else
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi

# Create .env file if it doesn't exist
cd ../chat-backend
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration:"
    echo "   - OpenAI API key (required for embeddings)"
    echo "   - Database credentials"
    echo "   - Ollama configuration"
    echo ""
    echo "📝 File location: chat-backend/.env"
else
    echo "✅ .env file already exists"
fi

# Check if ChromaDB is available
if command -v chroma &> /dev/null; then
    echo "✅ ChromaDB is available"
    echo "💡 To start ChromaDB: chroma run --host localhost --port 8000"
else
    echo "⚠️  ChromaDB not found. System will use fallback in-memory storage."
    echo "💡 To install ChromaDB: pip install chromadb"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Edit chat-backend/.env with your configuration"
echo "2. Start your database (MySQL/PostgreSQL/SQLite)"
echo "3. Optional: Start ChromaDB for vector storage"
echo "4. Run the application:"
echo "   cd chat-backend && npm run dev"
echo "   cd chat-frontend && npm start"
echo ""
echo "🔐 Admin Panel Access:"
echo "   - Click 'Admin' button in the application"
echo "   - Default password: admin123 (change in production!)"
echo ""
echo "📚 For detailed setup instructions, see: RAG_SYSTEM_SETUP.md"