-- Update demo page URLs for existing customers
UPDATE customers 
SET demoPageUrl = 'https://chat.passionfruits.net/NorskForsikring.html' 
WHERE customerId = 'NorskForsikring';

-- You can also add demo pages for other customers if they exist
-- Example:
-- UPDATE customers SET demoPageUrl = 'https://chat.passionfruits.net/test-widget.html' WHERE customerId = 'demo-dani';