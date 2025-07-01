#!/bin/bash
# Script to deploy NorskForsikring fixes to production

echo "Deploying NorskForsikring fixes to production..."

# Copy updated files
echo "1. Copying updated TypeScript files..."
scp -i ~/.ssh/pf-do /home/geir/Claude/PassionFruits/Chatbot/src/services/openai.ts pfadmin@159.65.204.97:/var/www/chatbot/src/services/

# Build on production
echo "2. Building project on production..."
ssh -i ~/.ssh/pf-do pfadmin@159.65.204.97 "cd /var/www/chatbot && npm run build"

# Update database
echo "3. Updating database..."
ssh -i ~/.ssh/pf-do pfadmin@159.65.204.97 "sqlite3 /var/www/chatbot/data/data.db 'UPDATE customers SET allowComplexitySelection = 1 WHERE customerId = \"NorskForsikring\";'"

# Verify settings
echo "4. Verifying settings..."
ssh -i ~/.ssh/pf-do pfadmin@159.65.204.97 "sqlite3 /var/www/chatbot/data/data.db 'SELECT customerId, allowComplexitySelection FROM customers WHERE customerId = \"NorskForsikring\";'"

# Restart service
echo "5. Restarting chatbot service..."
ssh -i ~/.ssh/pf-do pfadmin@159.65.204.97 "sudo systemctl restart chatbot"

echo "Deployment complete!"