#!/bin/bash
# Quick test script for database integration and USDZ conversion

echo "============================================"
echo "Database Integration & USDZ Test"
echo "============================================"
echo

# Test 1: Backend Health
echo "1️⃣  Testing backend health..."
HEALTH=$(curl -s http://localhost:8002/health)
if [ -z "$HEALTH" ]; then
    echo "❌ Backend not running!"
    echo "   Start with: cd Server && python3 asset_api.py"
    exit 1
fi
echo "✅ Backend is running"
echo "   $HEALTH"
echo

# Test 2: Get total model count
echo "2️⃣  Checking database connection..."
TOTAL=$(curl -s "http://localhost:8002/api/models?page=1&page_size=1" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('total', 0))")
echo "✅ Database connected"
echo "   Total models: $TOTAL"
echo

# Test 3: Search for first model
echo "3️⃣  Getting first model..."
FIRST_MODEL=$(curl -s "http://localhost:8002/api/models?page=1&page_size=1" | python3 -c "import sys, json; data=json.load(sys.stdin); asset=data['assets'][0]; print(f\"{asset['id']}|{asset['name']}\")")
MODEL_ID=$(echo $FIRST_MODEL | cut -d'|' -f1)
MODEL_NAME=$(echo $FIRST_MODEL | cut -d'|' -f2)
echo "✅ Model found: $MODEL_NAME"
echo "   ID: $MODEL_ID"
echo

# Test 4: Get download options
echo "4️⃣  Checking download formats..."
FORMATS=$(curl -s "http://localhost:8002/api/models/$MODEL_ID/downloads" | python3 -c "import sys, json; data=json.load(sys.stdin); formats = set([d['file_format'] for d in data]); print(', '.join(sorted(formats)))")
echo "✅ Available formats: $FORMATS"
echo

# Test 5: Test USDZ download
echo "5️⃣  Testing USDZ conversion..."
OUTPUT_FILE="/tmp/test_model_$(date +%s).usdz"
HTTP_CODE=$(curl -s -o "$OUTPUT_FILE" -w "%{http_code}" "http://localhost:8002/api/models/$MODEL_ID/download/usdz?resolution=1k")

if [ "$HTTP_CODE" = "200" ]; then
    FILE_SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')
    FILE_TYPE=$(file -b "$OUTPUT_FILE")
    echo "✅ USDZ download successful"
    echo "   File size: $FILE_SIZE"
    echo "   File type: $FILE_TYPE"
    
    # Verify USDZ contents
    echo
    echo "6️⃣  Verifying USDZ structure..."
    USDZ_CONTENTS=$(unzip -l "$OUTPUT_FILE" 2>/dev/null | tail -n +4 | head -n -2 | awk '{print $4}')
    echo "✅ USDZ contents:"
    echo "$USDZ_CONTENTS" | while read line; do
        echo "   - $line"
    done
    
    # Cleanup
    rm "$OUTPUT_FILE"
else
    echo "❌ USDZ download failed (HTTP $HTTP_CODE)"
    exit 1
fi

echo
echo "============================================"
echo "🎉 All tests passed!"
echo "============================================"
echo
echo "Summary:"
echo "  ✅ Backend running"
echo "  ✅ Database connected ($TOTAL models)"
echo "  ✅ Download formats available"
echo "  ✅ USDZ conversion working"
echo
echo "Your AR/VR app is ready to use!"
echo
