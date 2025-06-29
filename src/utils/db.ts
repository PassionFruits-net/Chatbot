import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db: Database.Database = new Database(path.join(dataDir, 'data.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customerId TEXT NOT NULL,
    fileName TEXT NOT NULL,
    filePath TEXT NOT NULL,
    mime TEXT NOT NULL,
    uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resourceId INTEGER NOT NULL,
    customerId TEXT NOT NULL,
    chunkText TEXT NOT NULL,
    embedding BLOB NOT NULL,
    FOREIGN KEY (resourceId) REFERENCES resources(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_chunks_customer ON chunks(customerId);
  CREATE INDEX IF NOT EXISTS idx_resources_customer ON resources(customerId);

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customerId TEXT UNIQUE NOT NULL,
    name TEXT,
    openaiEnabled BOOLEAN DEFAULT TRUE,
    explanationComplexity TEXT DEFAULT 'advanced' CHECK (explanationComplexity IN ('simple', 'advanced')),
    allowComplexitySelection BOOLEAN DEFAULT FALSE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_customers_id ON customers(customerId);

  -- Insert default settings if they don't exist
  INSERT OR IGNORE INTO settings (key, value) VALUES ('openai_enabled_globally', 'true');
`);

// Add new columns if they don't exist (migration)
try {
  db.exec(`ALTER TABLE customers ADD COLUMN explanationComplexity TEXT DEFAULT 'advanced' CHECK (explanationComplexity IN ('simple', 'advanced'))`);
} catch (e) {
  // Column already exists
}

try {
  db.exec(`ALTER TABLE customers ADD COLUMN allowComplexitySelection BOOLEAN DEFAULT FALSE`);
} catch (e) {
  // Column already exists
}

export default db;