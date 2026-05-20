#!/bin/bash

# Backend API Test Script
# Tests if the backend server is running and responding correctly

echo "🔍 Testing Backend API Connection..."
echo ""

BASE_URL="http://localhost:8002"

# Test 1: Health check
echo "1️⃣  Testing health endpoint..."
if curl -f -s "${BASE_URL}/health" > /dev/null 2>&1; then
    echo "   ✅ Health endpoint OK"
else
    echo "   ❌ Health endpoint failed"
    echo "   💡 The backend server may not be running"
fi
echo ""

# Test 2: API models endpoint
echo "2️⃣  Testing /api/models endpoint..."
RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/models")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "   ✅ HTTP Status: $HTTP_CODE"
    echo "   📦 Response body:"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
    echo "   ❌ HTTP Status: $HTTP_CODE"
    echo "   📦 Response: $BODY"
fi
echo ""

# Test 3: Search endpoint
echo "3️⃣  Testing search with query 'A'..."
SEARCH_RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/models?search=A")
SEARCH_HTTP_CODE=$(echo "$SEARCH_RESPONSE" | tail -n 1)
SEARCH_BODY=$(echo "$SEARCH_RESPONSE" | sed '$d')

if [ "$SEARCH_HTTP_CODE" -eq 200 ]; then
    echo "   ✅ HTTP Status: $SEARCH_HTTP_CODE"
    echo "   📦 Response body:"
    echo "$SEARCH_BODY" | python3 -m json.tool 2>/dev/null || echo "$SEARCH_BODY"
else
    echo "   ❌ HTTP Status: $SEARCH_HTTP_CODE"
    echo "   📦 Response: $SEARCH_BODY"
fi
echo ""

# Test 4: Check if response is empty
if [ -z "$SEARCH_BODY" ]; then
    echo "⚠️  WARNING: Search response body is EMPTY"
    echo "   This is likely causing 'data couldn't be read because it is missing' error"
    echo ""
    echo "🔧 Troubleshooting steps:"
    echo "   1. Check if your backend database has any assets"
    echo "   2. Verify the backend is returning proper JSON"
    echo "   3. Check backend server logs for errors"
else
    echo "✅ Response body is not empty"
fi
echo ""

# Summary
echo "📊 Summary:"
echo "   Backend URL: $BASE_URL"
echo "   To start Asset API backend server:"
echo "   cd Server && python3 asset_api.py"
echo ""
echo "   View interactive API docs at: http://localhost:w/docs"
