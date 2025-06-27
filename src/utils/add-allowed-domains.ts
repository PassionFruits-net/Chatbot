import db from './db';

// Add allowedDomains column to customers table
try {
  db.exec(`
    ALTER TABLE customers 
    ADD COLUMN allowedDomains TEXT DEFAULT '[]'
  `);
  console.log('Successfully added allowedDomains column');
} catch (error: any) {
  if (error.message.includes('duplicate column name')) {
    console.log('allowedDomains column already exists');
  } else {
    console.error('Error adding column:', error);
  }
}

// Update demo-dani to allow localhost for testing
const stmt = db.prepare(`
  UPDATE customers 
  SET allowedDomains = ? 
  WHERE customerId = ?
`);
stmt.run(JSON.stringify(['http://localhost:*', 'https://localhost:*']), 'demo-dani');

console.log('Updated demo-dani with localhost domains');