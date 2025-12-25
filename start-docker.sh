#!/bin/bash

echo "🐳 Starting RAG Chat System with Docker..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check for .env file
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your OpenAI API key!"
    echo "📝 File location: .env"
    echo ""
    echo "❗ IMPORTANT: Set OPENAI_API_KEY=your-key-here in .env file"
    echo ""
    read -p "Press Enter to continue or Ctrl+C to stop..."
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p db/init
mkdir -p chat-backend/uploads
mkdir -p logs

# Set proper permissions
chmod 755 chat-backend/uploads
chmod -R 755 db/

echo "🔍 Checking for required services..."

# Check if ports are available
check_port() {
    local port=$1
    local service=$2
    if lsof -i :$port > /dev/null 2>&1; then
        echo "⚠️  Port $port is already in use. Please stop the service using port $port or change the port in docker-compose.yml"
        return 1
    fi
    return 0
}

# Check critical ports
ports_ok=true
check_port 3306 "MySQL" || ports_ok=false
check_port 11434 "Ollama" || ports_ok=false  
check_port 8000 "Backend" || ports_ok=false
check_port 8001 "ChromaDB" || ports_ok=false
check_port 3100 "Frontend" || ports_ok=false

if [ "$ports_ok" = false ]; then
    echo "❌ Some ports are already in use. Please resolve port conflicts before continuing."
    exit 1
fi

echo "✅ All required ports are available"

# Choose Docker Compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

echo "🚀 Building and starting services..."

# Start services
$DOCKER_COMPOSE up --build -d

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 RAG Chat System is starting up!"
    echo ""
    echo "📋 Services:"
    echo "  • Frontend:        http://localhost:3100"
    echo "  • Backend API:     http://localhost:8000"
    echo "  • Admin Panel:      http://localhost:3100 (Admin button in app)"
    echo "  • Ollama:         http://localhost:11434"
    echo "  • Ollama WebUI:   http://localhost:3000"
    echo "  • ChromaDB:       http://localhost:8001"
    echo "  • MySQL:          localhost:3306"
    echo ""
    echo "🔐 Default Credentials:"
    echo "  • Admin Panel:    password: admin123 (CHANGE IN PRODUCTION!)"
    echo "  • MySQL:         root/rootpassword, chatuser/chatpass"
    echo ""
    echo "⏳ Waiting for services to be ready..."
    echo ""
    
    # Wait for backend health check
    echo "🔍 Checking backend health..."
    for i in {1..30}; do
        if curl -f http://localhost:8000/health > /dev/null 2>&1; then
            echo "✅ Backend is ready!"
            break
        fi
        echo "⏳ Waiting for backend... ($i/30)"
        sleep 5
    done
    
    echo ""
    echo "📊 Service Status:"
    $DOCKER_COMPOSE ps
    
    echo ""
    echo "📝 Useful Commands:"
    echo "  • View logs:       $DOCKER_COMPOSE logs -f [service-name]"
    echo "  • Stop services:   $DOCKER_COMPOSE down"
    echo "  • Restart:         $DOCKER_COMPOSE restart [service-name]"
    echo "  • Update images:   $DOCKER_COMPOSE pull && $DOCKER_COMPOSE up --build -d"
    echo ""
    echo "📚 First-time setup:"
    echo "  1. Open http://localhost:3100 in your browser"
    echo "  2. Enter your name and email when prompted"
    echo "  3. Click 'Admin' button and enter password: admin123"
    echo "  4. Upload documents via Document Management tab"
    echo "  5. Configure bot behavior via Bot Configurations tab"
    echo ""
    echo "🎯 Ready to use!"
    
else
    echo "❌ Failed to start services. Check the error messages above."
    echo ""
    echo "🔧 Troubleshooting:"
    echo "  • Make sure Docker is running and has enough resources"
    echo "  • Check that ports 3306, 8000, 8001, 3100 are available"
    echo "  • Verify .env file has correct OPENAI_API_KEY"
    echo "  • Run: $DOCKER_COMPOSE logs to see detailed logs"
fi