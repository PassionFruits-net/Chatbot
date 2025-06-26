import db from '../utils/db';

// OpenAI pricing as of June 2025 (USD per 1K tokens)
const PRICING = {
  'text-embedding-3-small': { input: 0.00002 }, // $0.02 per 1M tokens
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 } // $0.15/$0.60 per 1M tokens
};

interface UsageRecord {
  id?: number;
  timestamp: string;
  customerId: string;
  operation: 'embedding' | 'chat' | 'upload';
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  metadata?: string;
}

// Initialize usage tracking table
db.exec(`
  CREATE TABLE IF NOT EXISTS usage_tracking (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    customerId TEXT NOT NULL,
    operation TEXT NOT NULL,
    model TEXT NOT NULL,
    inputTokens INTEGER NOT NULL,
    outputTokens INTEGER DEFAULT 0,
    estimatedCost REAL NOT NULL,
    metadata TEXT
  );
  
  CREATE INDEX IF NOT EXISTS idx_usage_customer ON usage_tracking(customerId);
  CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_tracking(timestamp);
`);

export function estimateEmbeddingCost(inputTokens: number): number {
  return (inputTokens / 1000) * PRICING['text-embedding-3-small'].input;
}

export function estimateChatCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000) * PRICING['gpt-4o-mini'].input;
  const outputCost = (outputTokens / 1000) * PRICING['gpt-4o-mini'].output;
  return inputCost + outputCost;
}

export function trackUsage(record: Omit<UsageRecord, 'id' | 'timestamp'>): void {
  const stmt = db.prepare(`
    INSERT INTO usage_tracking (customerId, operation, model, inputTokens, outputTokens, estimatedCost, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    record.customerId,
    record.operation,
    record.model,
    record.inputTokens,
    record.outputTokens,
    record.estimatedCost,
    record.metadata || null
  );
}

export function getUsageStats(customerId?: string, days: number = 30) {
  const baseQuery = `
    SELECT 
      operation,
      model,
      COUNT(*) as requests,
      SUM(inputTokens) as totalInputTokens,
      SUM(outputTokens) as totalOutputTokens,
      SUM(estimatedCost) as totalCost
    FROM usage_tracking 
    WHERE timestamp >= datetime('now', '-${days} days')
  `;
  
  const params = [];
  let query = baseQuery;
  
  if (customerId) {
    query += ' AND customerId = ?';
    params.push(customerId);
  }
  
  query += ' GROUP BY operation, model ORDER BY totalCost DESC';
  
  return db.prepare(query).all(...params);
}

export function getDailyCosts(customerId?: string, days: number = 30) {
  const baseQuery = `
    SELECT 
      DATE(timestamp) as date,
      SUM(estimatedCost) as dailyCost,
      COUNT(*) as requests
    FROM usage_tracking 
    WHERE timestamp >= datetime('now', '-${days} days')
  `;
  
  const params = [];
  let query = baseQuery;
  
  if (customerId) {
    query += ' AND customerId = ?';
    params.push(customerId);
  }
  
  query += ' GROUP BY DATE(timestamp) ORDER BY date DESC';
  
  return db.prepare(query).all(...params);
}

export function getTotalCost(customerId?: string): number {
  const query = customerId 
    ? 'SELECT SUM(estimatedCost) as total FROM usage_tracking WHERE customerId = ?'
    : 'SELECT SUM(estimatedCost) as total FROM usage_tracking';
  
  const params = customerId ? [customerId] : [];
  const result = db.prepare(query).get(...params) as any;
  return result?.total || 0;
}