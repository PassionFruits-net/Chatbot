import { Router, Request, Response } from 'express';
import { retrieveChunks } from '../services/retriever';
import { streamChat } from '../services/openai';

const router = Router();

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { customerId, message } = req.body;

    if (!customerId || !message) {
      return res.status(400).json({ error: 'customerId and message are required' });
    }

    const chunks = await retrieveChunks(customerId, message);
    
    // Debug logging
    console.log(`\n=== RETRIEVAL DEBUG for "${message}" ===`);
    console.log(`Retrieved ${chunks.length} chunks:`);
    chunks.forEach((chunk, i) => {
      console.log(`\nChunk ${i + 1} (${chunk.fileName}):`, 
        chunk.text.substring(0, 200) + (chunk.text.length > 200 ? '...' : ''));
      console.log(`Score: ${chunk.score}`);
    });
    console.log('=== END RETRIEVAL DEBUG ===\n');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of streamChat({ customerId, message, chunks })) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ 
      done: true, 
      sources: chunks.map(c => ({ 
        fileName: c.fileName, 
        text: c.text 
      })) 
    })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;