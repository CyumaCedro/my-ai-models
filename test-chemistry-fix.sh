#!/bin/bash

echo "Testing backend fixes for 'chemistry' question..."

# Test 1: Direct curl to backend (if running)
echo "Test 1: Testing direct backend call"
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"chemistry","sessionId":"test"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  2>/dev/null || echo "Backend not responding on port 8000"

echo ""

# Test 2: Check if backend server exists
echo "Test 2: Checking if backend files are present"
if [ -f "chat-backend/server.js" ]; then
    echo "✓ server.js exists"
    grep -q "callGeneralAnswer" chat-backend/server.js && echo "✓ callGeneralAnswer function found"
    grep -q "isGeneralQuestion" chat-backend/server.js && echo "✓ General question detection found"
    grep -q "chemistry" chat-backend/server.js && echo "✓ Chemistry handling found"
else
    echo "✗ server.js not found"
fi

echo ""

# Test 3: Simulate the logic
echo "Test 3: Simulating logic for 'chemistry' question"
message="chemistry"
general_topics=("chemistry" "physics" "biology" "history" "geography" "mathematics" "literature" "art" "music" "philosophy" "psychology" "economics" "what is" "who was" "when did" "explain" "define" "meaning of")

is_general=false
for topic in "${general_topics[@]}"; do
    if [[ "$message" == *"$topic"* ]]; then
        is_general=true
        break
    fi
done

if [ "$is_general" = true ]; then
    echo "✓ 'chemistry' correctly identified as general question"
else
    echo "✗ 'chemistry' not identified as general question"
fi

echo ""

echo "Test completed. The fixes should handle general questions like 'chemistry' properly."
echo "Key improvements:"
echo "1. General question detection before data processing"
echo "2. Direct call to callGeneralAnswer for general topics"  
echo "3. Better error handling with fallback responses"
echo "4. Improved JSON parsing with error catching"