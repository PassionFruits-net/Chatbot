-- SQL commands to fix NorskForsikring customer settings

-- Enable complexity selection for NorskForsikring
UPDATE customers 
SET allowComplexitySelection = 1 
WHERE customerId = 'NorskForsikring';

-- Verify the settings
SELECT customerId, systemPrompt, explanationComplexity, allowComplexitySelection 
FROM customers 
WHERE customerId = 'NorskForsikring';