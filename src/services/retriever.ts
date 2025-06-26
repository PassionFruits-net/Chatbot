import db from '../utils/db';
import { bufferToEmbedding, embedText } from './embed';
import { findTopK } from '../utils/vectordb';

interface ChunkRow {
  id: number;
  resourceId: number;
  customerId: string;
  chunkText: string;
  embedding: Buffer;
  fileName: string;
}

export async function retrieveChunks(
  customerId: string,
  query: string,
  k: number = 8
): Promise<Array<{ text: string; fileName: string; score: number }>> {
  const queryEmbedding = await embedText(query, customerId);
  
  const chunks = db.prepare(`
    SELECT c.*, r.fileName 
    FROM chunks c 
    JOIN resources r ON c.resourceId = r.id 
    WHERE c.customerId = ?
  `).all(customerId) as ChunkRow[];
  
  const scored = findTopK(
    queryEmbedding,
    chunks,
    (chunk) => bufferToEmbedding(chunk.embedding),
    k
  );
  
  return scored.map(({ item, score }) => ({
    text: item.chunkText,
    fileName: item.fileName,
    score
  }));
}