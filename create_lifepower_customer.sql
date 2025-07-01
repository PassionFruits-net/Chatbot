-- Create LifePower customer with proper settings
INSERT OR IGNORE INTO customers (
    customerId, 
    name, 
    openaiEnabled, 
    explanationComplexity, 
    allowComplexitySelection, 
    systemPrompt,
    demoPageUrl,
    createdAt, 
    updatedAt
) VALUES (
    'LifePower',
    'LifePower Personal Development',
    1, -- Enable OpenAI
    'advanced', -- Default to advanced explanations
    1, -- Allow users to select complexity
    'You are a personal development coach and expert on the LifePower methodology. You help users understand concepts from our books about achieving personal power, self-mastery, executive freedom, creative consciousness, and study techniques. Provide practical, actionable advice while being encouraging and supportive. Reference specific books and concepts when relevant.',
    'https://chat.passionfruits.net/lifepower.html',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Add allowed domains for LifePower
UPDATE customers 
SET allowedDomains = '["https://chat.passionfruits.net", "https://life-pwr.com", "http://localhost:3000"]'
WHERE customerId = 'LifePower';