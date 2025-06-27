import { Router, Request, Response } from 'express';
import { retrieveChunks } from '../services/retriever';
import { streamChat } from '../services/openai';
import { performDuckDuckGoSearch, performWebSearch } from '../services/web-search';
import { localChatService } from '../services/local-chat';
import { validateOrigin } from '../middleware/cors-validation';
import db from '../utils/db';

const router = Router();

router.post('/chat', validateOrigin, async (req: Request, res: Response) => {
  try {
    const { customerId, message, includeGeneralAI } = req.body;

    if (!customerId || !message) {
      return res.status(400).json({ error: 'customerId and message are required' });
    }

    // Check backend availability settings
    const globalOpenAIRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('openai_enabled_globally') as { value: string } | undefined;
    const openaiEnabledGlobally = globalOpenAIRow ? globalOpenAIRow.value === 'true' : true;
    
    const localRAGRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('local_rag_enabled') as { value: string } | undefined;
    const localRAGEnabled = localRAGRow ? localRAGRow.value === 'true' : false;
    
    const customerRow = db.prepare('SELECT openaiEnabled FROM customers WHERE customerId = ?').get(customerId) as { openaiEnabled: number } | undefined;
    const openaiEnabledForCustomer = customerRow ? customerRow.openaiEnabled === 1 : true;
    
    const canUseOpenAI = openaiEnabledGlobally && openaiEnabledForCustomer;
    
    // Determine which backend to use (priority: Local RAG > OpenAI > Web Search > Documents Only)
    let backendMode = 'documents_only';
    if (localRAGEnabled) {
      backendMode = 'local_rag';
    } else if (canUseOpenAI) {
      backendMode = 'openai';
    } else if (includeGeneralAI) {
      backendMode = 'web_search';
    }
    
    console.log(`Backend mode: ${backendMode}`);
    console.log(`OpenAI availability - Global: ${openaiEnabledGlobally}, Customer: ${openaiEnabledForCustomer}, Can use: ${canUseOpenAI}`);
    console.log(`Local RAG enabled: ${localRAGEnabled}`);
    console.log(`General AI mode: ${includeGeneralAI ? 'enabled' : 'disabled'}`);

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

    let allSources = chunks.map(c => ({ 
      type: 'document',
      fileName: c.fileName, 
      text: c.text 
    }));

    // Route to appropriate backend
    if (backendMode === 'local_rag') {
      // Use local RAG with Ollama
      for await (const chunk of localChatService.streamChat({ customerId, message, chunks, includeGeneralAI })) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
    } else if (backendMode === 'openai') {
      // Use OpenAI
      for await (const chunk of streamChat({ customerId, message, chunks, includeGeneralAI })) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
    } else {
      // Use web search fallback for general AI mode, or just document retrieval
      if (includeGeneralAI) {
        console.log('Using web search fallback for general AI mode');
        
        // Perform web search
        const searchResults = await performDuckDuckGoSearch(message);
        
        if (searchResults.results.length > 0) {
          // Add web sources
          allSources = [
            ...allSources,
            ...searchResults.results.map(result => ({
              type: 'web',
              fileName: result.title,
              text: result.snippet,
              url: result.url
            }))
          ];
          
          // Stream a response based on available information
          const responseText = generateResponseFromSources(message, chunks, searchResults.results);
          
          // Stream the response word by word
          const words = responseText.split(' ');
          for (let i = 0; i < words.length; i++) {
            const word = words[i] + (i < words.length - 1 ? ' ' : '');
            res.write(`data: ${JSON.stringify({ content: word })}\n\n`);
            await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for streaming effect
          }
        } else {
          // No web results, use document-only response
          const responseText = generateResponseFromDocuments(message, chunks);
          const words = responseText.split(' ');
          for (let i = 0; i < words.length; i++) {
            const word = words[i] + (i < words.length - 1 ? ' ' : '');
            res.write(`data: ${JSON.stringify({ content: word })}\n\n`);
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      } else {
        // Document-only mode (no general AI)
        const responseText = generateResponseFromDocuments(message, chunks);
        const words = responseText.split(' ');
        for (let i = 0; i < words.length; i++) {
          const word = words[i] + (i < words.length - 1 ? ' ' : '');
          res.write(`data: ${JSON.stringify({ content: word })}\n\n`);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }

    res.write(`data: ${JSON.stringify({ 
      done: true, 
      sources: allSources,
      backend: backendMode
    })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to generate response from documents only
function generateResponseFromDocuments(message: string, chunks: any[]): string {
  if (chunks.length === 0) {
    return "I don't have any relevant information in the uploaded documents to answer your question.";
  }
  
  const relevantChunks = chunks.slice(0, 3); // Use top 3 chunks
  const sources = relevantChunks.map(chunk => `From ${chunk.fileName}: ${chunk.text}`).join('\n\n');
  
  return `Based on the uploaded documents, here's what I found:\n\n${sources}`;
}

// Helper function to generate response from documents and web search
function generateResponseFromSources(message: string, chunks: any[], webResults: any[]): string {
  let response = '';
  
  if (chunks.length > 0) {
    const relevantChunks = chunks.slice(0, 2);
    const docSources = relevantChunks.map(chunk => chunk.text).join(' ');
    response += `From your uploaded documents: ${docSources}\n\n`;
  }
  
  if (webResults.length > 0) {
    const webSources = webResults.slice(0, 3).map(result => result.snippet).join(' ');
    response += `Additional information from web search: ${webSources}`;
  }
  
  if (!response) {
    response = "I couldn't find relevant information in your documents or from web search.";
  }
  
  return response;
}

export default router;