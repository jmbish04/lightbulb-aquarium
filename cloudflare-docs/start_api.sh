#!/bin/bash

# Start API Server Script for Cloudflare Docs Question Tracker & Task Management
# This script sets up the environment and starts the FastAPI server

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Cloudflare Docs API Server...${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
cd "$SCRIPT_DIR"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is required but not installed.${NC}"
    exit 1
fi

# Check if we're in a virtual environment, if not, try to activate one
if [[ -z "${VIRTUAL_ENV}" ]]; then
    if [[ -d "venv" ]]; then
        echo -e "${YELLOW}📦 Activating virtual environment...${NC}"
        source venv/bin/activate
    elif [[ -d "../venv" ]]; then
        echo -e "${YELLOW}📦 Activating virtual environment...${NC}"
        source ../venv/bin/activate
    else
        echo -e "${YELLOW}⚠️  No virtual environment found. Consider creating one with:${NC}"
        echo -e "${YELLOW}   python3 -m venv venv${NC}"
        echo -e "${YELLOW}   source venv/bin/activate${NC}"
    fi
fi

# Install dependencies if requirements.txt exists
if [[ -f "requirements.txt" ]]; then
    echo -e "${YELLOW}📋 Installing dependencies...${NC}"
    pip install -r requirements.txt
else
    echo -e "${RED}❌ requirements.txt not found!${NC}"
    exit 1
fi

# Check if the main API file exists
if [[ ! -f "api_server_sqlite.py" ]]; then
    echo -e "${RED}❌ api_server_sqlite.py not found!${NC}"
    exit 1
fi

# Function to check if a port is in use
is_port_in_use() {
    # -l = listening, -n = numeric, -t = tcp
    ss -lnt | grep -q ":$1"
}

# Check if port 8001 is already in use
PORT=8001
if is_port_in_use $PORT; then
    echo -e "${YELLOW}⚠️  Port $PORT is already in use.${NC}"
    echo -e "${BLUE}🔧 Using Python port clearing utility...${NC}"
    
    # Use our Python port utility to clear the port
    python3 port_utils.py $PORT --force
    
    # Wait a moment for cleanup
    sleep 1
    
    # Verify port is now clear
    if is_port_in_use $PORT; then
        echo -e "${RED}❌ Port $PORT is still in use after clearing attempt.${NC}"
        echo -e "${BLUE}🔍 Checking what's running on port $PORT...${NC}"
        
        # Show what's using the port - fallback to lsof for process details
        if command -v lsof &> /dev/null; then
            PROCESS_INFO=$(lsof -Pi :$PORT -sTCP:LISTEN 2>/dev/null || echo "Could not get process details")
            echo "$PROCESS_INFO"
        else
            echo "Port $PORT is in use (install lsof for process details)"
        fi
        
        # Ask user what to do
        echo ""
        echo -e "${YELLOW}Choose an option:${NC}"
        echo -e "${BLUE}1)${NC} Try to kill the process manually and continue"
        echo -e "${BLUE}2)${NC} Use a different port (8002)"
        echo -e "${BLUE}3)${NC} Exit and handle manually"
        echo ""
        read -p "Enter your choice (1-3): " choice
        
        case $choice in
            1)
                echo -e "${YELLOW}🔄 Attempting manual kill on port $PORT...${NC}"
                if command -v lsof &> /dev/null; then
                    PID=$(lsof -Pi :$PORT -sTCP:LISTEN -t 2>/dev/null)
                    if [[ ! -z "$PID" ]]; then
                        kill -9 $PID
                        sleep 2
                        echo -e "${GREEN}✅ Process killed.${NC}"
                    else
                        echo -e "${RED}❌ Could not find process to kill.${NC}"
                    fi
                else
                    echo -e "${RED}❌ lsof not available. Please kill the process manually.${NC}"
                    exit 1
                fi
                ;;
            2)
                PORT=8002
                echo -e "${YELLOW}🔄 Using port $PORT instead...${NC}"
                ;;
            3)
                echo -e "${BLUE}👋 Exiting. Please handle the port conflict manually.${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}❌ Invalid choice. Exiting.${NC}"
                exit 1
                ;;
        esac
    else
        echo -e "${GREEN}✅ Port $PORT is now available${NC}"
    fi
else
    echo -e "${GREEN}✅ Port $PORT is available${NC}"
fi

# Initialize database (the app does this on startup, but we can check)
echo -e "${YELLOW}🗄️  Database will be initialized on startup...${NC}"
echo -e "${BLUE}🔧 Port clearing will also happen automatically in FastAPI startup...${NC}"

# Start the server
echo -e "${GREEN}✅ Starting FastAPI server on http://0.0.0.0:$PORT${NC}"
echo -e "${BLUE}📖 API Documentation available at: http://localhost:$PORT/docs${NC}"
echo -e "${BLUE}🔍 Alternative docs at: http://localhost:$PORT/redoc${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

# Run the FastAPI application with the selected port
if [[ $PORT == "8001" ]]; then
    python3 api_server_sqlite.py
else
    python3 -c "
import uvicorn
from api_server_sqlite import app
uvicorn.run(app, host='0.0.0.0', port=$PORT)
"
fi
