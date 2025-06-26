#!/bin/bash

echo "Starting RAG-Lite server with auto-restart..."

while true; do
    echo "$(date): Starting server..."
    npx tsx src/index.ts
    
    exit_code=$?
    echo "$(date): Server exited with code $exit_code"
    
    if [ $exit_code -eq 0 ]; then
        echo "$(date): Server requested restart, restarting in 2 seconds..."
        sleep 2
    else
        echo "$(date): Server crashed, restarting in 5 seconds..."
        sleep 5
    fi
done