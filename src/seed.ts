import fs from 'fs/promises';
import path from 'path';
import db from './utils/db';
import { extractText } from './services/extractor';
import { chunkText } from './services/chunker';
import { embedTexts, embeddingToBuffer } from './services/embed';
import { retrieveChunks } from './services/retriever';

const SAMPLE_PDF_1 = `Insurance Policy Coverage Guide

This document outlines the comprehensive coverage provided by our insurance policies.

Property Coverage:
Our property insurance covers damage to your home and personal belongings from various perils including fire, theft, vandalism, and weather-related events. The coverage limit is up to $500,000 for the dwelling and $250,000 for personal property.

Liability Protection:
We provide liability coverage up to $1,000,000 for bodily injury or property damage you accidentally cause to others. This includes legal defense costs.

Additional Living Expenses:
If your home becomes uninhabitable due to a covered loss, we cover additional living expenses up to $100,000 for temporary housing and related costs.

Deductibles:
Standard deductible is $1,000 for most claims. Hurricane and earthquake deductibles are 2% of the insured value.`;

const SAMPLE_PDF_2 = `Claims Process Guide

Filing a Claim:
1. Report the claim immediately by calling 1-800-CLAIMS or through our mobile app
2. Document all damage with photos and videos
3. Keep receipts for emergency repairs and temporary expenses
4. Meet with our adjuster for inspection

Claim Timeline:
- Initial response within 24 hours
- Adjuster visit within 3-5 business days
- Settlement decision within 30 days for most claims
- Payment issued within 5 business days of approval

Required Documentation:
- Police report (for theft/vandalism)
- Receipts and proof of ownership
- Contractor estimates for repairs
- Medical records (for liability claims)

Appeals Process:
If you disagree with the claim decision, you can appeal within 60 days. Submit additional documentation to support your appeal.`;

async function createSampleFile(content: string, fileName: string): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'data', 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });
  
  const filePath = path.join(uploadDir, fileName);
  await fs.writeFile(filePath, content);
  
  return filePath;
}

async function seedDatabase() {
  console.log('Starting database seed...');
  
  const customerId = 'demo-insco';
  
  const files = [
    { content: SAMPLE_PDF_1, name: 'coverage-guide.txt', mime: 'text/plain' },
    { content: SAMPLE_PDF_2, name: 'claims-process.txt', mime: 'text/plain' }
  ];
  
  for (const file of files) {
    console.log(`Processing ${file.name}...`);
    
    const filePath = await createSampleFile(file.content, file.name);
    
    const resourceStmt = db.prepare(`
      INSERT INTO resources (customerId, fileName, filePath, mime)
      VALUES (?, ?, ?, ?)
    `);
    
    const resourceResult = resourceStmt.run(customerId, file.name, filePath, file.mime);
    const resourceId = resourceResult.lastInsertRowid;
    
    const text = await extractText(filePath, file.mime);
    const chunks = chunkText(text);
    const embeddings = await embedTexts(chunks.map(c => c.text));
    
    const chunkStmt = db.prepare(`
      INSERT INTO chunks (resourceId, customerId, chunkText, embedding)
      VALUES (?, ?, ?, ?)
    `);
    
    const insertChunks = db.transaction(() => {
      for (let i = 0; i < chunks.length; i++) {
        chunkStmt.run(
          resourceId,
          customerId,
          chunks[i].text,
          embeddingToBuffer(embeddings[i])
        );
      }
    });
    
    insertChunks();
    console.log(`Added ${chunks.length} chunks for ${file.name}`);
  }
  
  console.log('\nRunning test queries...');
  
  const testQueries = [
    'What is the property coverage limit?',
    'How long does it take to get a claim decision?',
    'What is the deductible for hurricane damage?'
  ];
  
  for (const query of testQueries) {
    console.log(`\nQuery: "${query}"`);
    const results = await retrieveChunks(customerId, query, 3);
    console.log('Top results:');
    results.forEach((r, i) => {
      console.log(`  ${i + 1}. [${r.fileName}] Score: ${r.score.toFixed(3)}`);
      console.log(`     "${r.text.substring(0, 100)}..."`);
    });
  }
  
  console.log('\nSeed completed successfully!');
}

seedDatabase().catch(console.error).finally(() => process.exit());