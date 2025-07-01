-- Update demo-dani customer with proper demo page URL
UPDATE customers 
SET demoPageUrl = 'https://chat.passionfruits.net/test-widget.html' 
WHERE customerId = 'demo-dani';

-- If demo-dani doesn't exist, create it
INSERT OR IGNORE INTO customers (
    customerId, 
    name, 
    openaiEnabled, 
    explanationComplexity, 
    allowComplexitySelection, 
    systemPrompt,
    demoPageUrl,
    allowedDomains,
    createdAt, 
    updatedAt
) VALUES (
    'demo-dani',
    'Demo Customer - Dani',
    1, -- Enable OpenAI
    'advanced', -- Default to advanced explanations
    1, -- Allow users to select complexity
    'You are a helpful AI assistant providing general support and answering questions. Be friendly, professional, and provide accurate information.',
    'https://chat.passionfruits.net/test-widget.html',
    '["https://chat.passionfruits.net", "http://localhost:3000"]',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);