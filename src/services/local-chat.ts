// Local chat service using Ollama
import { spawn } from 'child_process';

export interface LocalChatMessage {
  customerId: string;
  message: string;
  chunks: Array<{ text: string; fileName: string }>;
  includeGeneralAI?: boolean;
  explanationComplexity?: string;
}

export interface LocalChatResponse {
  content?: string;
  error?: string;
  done?: boolean;
}

class LocalChatService {
  private ollamaEndpoint: string;
  private modelName: string;

  constructor(modelName: string = 'tinyllama', ollamaEndpoint: string = 'http://localhost:11434') {
    this.modelName = modelName;
    this.ollamaEndpoint = ollamaEndpoint;
  }

  private buildPrompt(chatMessage: LocalChatMessage): string {
    const { customerId, message, chunks, includeGeneralAI, explanationComplexity } = chatMessage;
    
    let prompt = '';
    
    // Get customer's custom system prompt
    const db = require('../utils/db').db;
    const customerRow = db.prepare('SELECT systemPrompt FROM customers WHERE customerId = ?').get(customerId) as { systemPrompt: string | null } | undefined;
    const customSystemPrompt = customerRow?.systemPrompt;
    
    // Add complexity and formatting instructions
    const complexityInstructions = explanationComplexity === 'simple' 
      ? " Use simple language suitable for a 14-year-old reading level. Break your response into short paragraphs. Use **bold text** for key points and include relevant emojis. Explain technical terms simply."
      : " Structure your response with clear paragraphs. Use **bold text** for important concepts and include relevant emojis for readability.";

    if (chunks && chunks.length > 0) {
      // Use custom system prompt if available, otherwise default
      if (customSystemPrompt) {
        prompt += customSystemPrompt + " Use the following context from documents to answer the user's question.";
      } else {
        prompt += "You are a helpful AI assistant. Use the following context from documents to answer the user's question.";
      }
      prompt += complexityInstructions;
      prompt += " ";
      
      if (!includeGeneralAI) {
        prompt += "Only use information from the provided context. If the context doesn't contain relevant information, say so.";
      } else {
        prompt += "You can also use your general knowledge to provide a comprehensive answer, but prioritize information from the context.";
      }
      
      prompt += "\n\nContext from documents:\n";
      chunks.forEach((chunk, index) => {
        prompt += `\n[Document ${index + 1} - ${chunk.fileName}]:\n${chunk.text}\n`;
      });
      
      prompt += `\nUser question: ${message}\n\nAnswer:`;
    } else {
      if (includeGeneralAI) {
        prompt = `You are a helpful AI assistant. Answer the following question using your knowledge:\n\nQuestion: ${message}\n\nAnswer:`;
      } else {
        prompt = `I don't have any relevant documents to answer your question: "${message}". Please upload some documents or enable general AI mode.`;
        return prompt;
      }
    }
    
    return prompt;
  }

  async *streamChat(chatMessage: LocalChatMessage): AsyncGenerator<string, void, unknown> {
    const prompt = this.buildPrompt(chatMessage);
    
    // If no documents and general AI is disabled, return early
    if (!chatMessage.chunks?.length && !chatMessage.includeGeneralAI) {
      yield prompt;
      return;
    }

    try {
      // For now, let's implement a simple non-streaming version that works
      // We can optimize streaming later
      const curlArgs = [
        '-X', 'POST',
        `${this.ollamaEndpoint}/api/generate`,
        '-H', 'Content-Type: application/json',
        '-d', JSON.stringify({
          model: this.modelName,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 1000
          }
        })
      ];

      const curl = spawn('curl', curlArgs);
      
      let output = '';
      let errorOutput = '';
      
      curl.stdout.on('data', (data) => {
        output += data.toString();
      });

      curl.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      await new Promise<void>((resolve, reject) => {
        curl.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Curl process exited with code ${code}: ${errorOutput}`));
          }
        });

        curl.on('error', (error) => {
          reject(error);
        });
      });

      if (output) {
        try {
          const response = JSON.parse(output);
          if (response.response) {
            // Split response into words for streaming effect
            const words = response.response.split(' ');
            for (let i = 0; i < words.length; i++) {
              const word = words[i] + (i < words.length - 1 ? ' ' : '');
              yield word;
              // Small delay for streaming effect
              await new Promise(resolve => setTimeout(resolve, 30));
            }
          } else if (response.error) {
            yield `Local AI error: ${response.error}`;
          }
        } catch (parseError) {
          yield `Error parsing AI response: ${parseError}`;
        }
      } else {
        yield 'No response from local AI';
      }

    } catch (error) {
      console.error('Local chat error:', error);
      yield `Error communicating with local AI: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const curl = spawn('curl', ['-s', `${this.ollamaEndpoint}/api/tags`]);
      
      return new Promise((resolve) => {
        let output = '';
        
        curl.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        curl.on('close', (code) => {
          if (code === 0) {
            try {
              const response = JSON.parse(output);
              const hasModel = response.models?.some((model: any) => 
                model.name === this.modelName
              );
              resolve(hasModel);
            } catch {
              resolve(false);
            }
          } else {
            resolve(false);
          }
        });
        
        curl.on('error', () => {
          resolve(false);
        });
      });
    } catch {
      return false;
    }
  }
}

// Singleton instance
const localChatService = new LocalChatService();

export { localChatService };
export default LocalChatService;