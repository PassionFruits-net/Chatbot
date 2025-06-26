import { encode } from 'gpt-3-encoder';

export interface Chunk {
  text: string;
  startIdx: number;
  endIdx: number;
}

export function chunkText(text: string, maxTokens: number = 350, overlap: number = 40): Chunk[] {
  const chunks: Chunk[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  let currentChunk = '';
  let currentTokens = 0;
  let chunkStart = 0;
  let position = 0;
  
  for (const sentence of sentences) {
    const sentenceTokens = encode(sentence).length;
    
    if (currentTokens + sentenceTokens > maxTokens && currentChunk) {
      chunks.push({
        text: currentChunk.trim(),
        startIdx: chunkStart,
        endIdx: position
      });
      
      const overlapText = getOverlapText(currentChunk, overlap);
      currentChunk = overlapText + sentence;
      currentTokens = encode(currentChunk).length;
      chunkStart = position - overlapText.length;
    } else {
      currentChunk += sentence;
      currentTokens += sentenceTokens;
    }
    
    position += sentence.length;
  }
  
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      startIdx: chunkStart,
      endIdx: position
    });
  }
  
  return chunks;
}

function getOverlapText(text: string, overlapTokens: number): string {
  const tokens = encode(text);
  const startIdx = Math.max(0, tokens.length - overlapTokens);
  const overlapTokenIds = tokens.slice(startIdx);
  
  const words = text.split(/\s+/);
  let reconstructed = '';
  let tokenCount = 0;
  
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    tokenCount += encode(word).length;
    
    if (tokenCount >= overlapTokens) {
      reconstructed = words.slice(i).join(' ');
      break;
    }
  }
  
  return reconstructed ? reconstructed + ' ' : '';
}