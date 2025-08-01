#!/bin/bash

# Deploy script for Chatbot to Digital Ocean server

echo "Deploying Chatbot to Digital Ocean server..."

# Server details
SERVER="pfadmin@159.65.204.97"
SSH_KEY="~/.ssh/pf-do"
REMOTE_BUILD_DIR="/home/pfadmin/chatbot"
REMOTE_DEPLOY_DIR="/var/www/chatbot"

# Files to copy
echo "Copying updated files..."

# Copy TypeScript source files
scp -i $SSH_KEY src/utils/db.ts $SERVER:$REMOTE_BUILD_DIR/src/utils/
scp -i $SSH_KEY src/routes/customers.ts $SERVER:$REMOTE_BUILD_DIR/src/routes/

# Copy public files
scp -i $SSH_KEY public/admin/dashboard.html $SERVER:$REMOTE_BUILD_DIR/public/admin/
scp -i $SSH_KEY public/lifepower.html $SERVER:$REMOTE_BUILD_DIR/public/
scp -i $SSH_KEY public/widget.js $SERVER:$REMOTE_BUILD_DIR/public/
scp -i $SSH_KEY public/lifepower-logo.svg $SERVER:$REMOTE_BUILD_DIR/public/

# Copy SQL scripts
scp -i $SSH_KEY create_lifepower_customer.sql $SERVER:$REMOTE_BUILD_DIR/
scp -i $SSH_KEY update_demo_dani.sql $SERVER:$REMOTE_BUILD_DIR/
scp -i $SSH_KEY upload_lifepower_pdfs.py $SERVER:$REMOTE_BUILD_DIR/

# Build and restart on remote server
echo "Building and restarting application on remote server..."
ssh -i $SSH_KEY $SERVER << 'EOF'
cd /home/pfadmin/chatbot
echo "Building TypeScript..."
npm run build

echo "Copying built files to deployment directory..."
sudo cp -r dist/* /var/www/chatbot/dist/
sudo cp -r public/* /var/www/chatbot/public/

echo "Running database updates..."
cd /var/www/chatbot/data
sudo sqlite3 data.db < /home/pfadmin/chatbot/create_lifepower_customer.sql
sudo sqlite3 data.db < /home/pfadmin/chatbot/update_demo_dani.sql

echo "Restarting chatbot service..."
sudo systemctl restart chatbot
sudo systemctl status chatbot

echo "Deployment complete!"
EOF

echo "Deployment finished!"