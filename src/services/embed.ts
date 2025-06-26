import OpenAI from 'openai';
import dotenv from 'dotenv';
import { encode } from 'gpt-3-encoder';
import { estimateEmbeddingCost, trackUsage } from './cost-tracker';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function embedText(text: string, customerId?: string): Promise<number[]> {
  const inputTokens = encode(text).length;
  const estimatedCost = estimateEmbeddingCost(inputTokens);
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  if (customerId) {
    trackUsage({
      customerId,
      operation: 'embedding',
      model: 'text-embedding-3-small',
      inputTokens,
      outputTokens: 0,
      estimatedCost,
      metadata: 'Single text embedding'
    });
  }

  return response.data[0].embedding;
}

export async function embedTexts(texts: string[], customerId?: string): Promise<number[][]> {
  const inputTokens = texts.reduce((total, text) => total + encode(text).length, 0);
  const estimatedCost = estimateEmbeddingCost(inputTokens);
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });

  if (customerId) {
    trackUsage({
      customerId,
      operation: 'embedding',
      model: 'text-embedding-3-small',
      inputTokens,
      outputTokens: 0,
      estimatedCost,
      metadata: `Batch embedding: ${texts.length} texts`
    });
  }

  return response.data.map(d => d.embedding);
}

export function embeddingToBuffer(embedding: number[]): Buffer {
  const float32Array = new Float32Array(embedding);
  return Buffer.from(float32Array.buffer);
}

export function bufferToEmbedding(buffer: Buffer): number[] {
  const float32Array = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
  return Array.from(float32Array);
}