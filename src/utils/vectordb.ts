export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

export interface ScoredItem<T> {
  item: T;
  score: number;
}

export function findTopK<T>(
  queryEmbedding: number[],
  items: T[],
  getEmbedding: (item: T) => number[],
  k: number
): ScoredItem<T>[] {
  const scored: ScoredItem<T>[] = items.map(item => ({
    item,
    score: cosineSimilarity(queryEmbedding, getEmbedding(item))
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored.slice(0, k);
}