// Local embeddings service using sentence-transformers via Python
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export interface LocalEmbeddingResponse {
  embeddings: number[][];
  error?: string;
}

// Python script to generate embeddings using sentence-transformers
const PYTHON_SCRIPT = `
import sys
import json
from sentence_transformers import SentenceTransformer
import numpy as np

def generate_embeddings(texts, model_name='all-MiniLM-L6-v2'):
    try:
        # Load the model (downloads automatically on first use)
        model = SentenceTransformer(model_name)
        
        # Generate embeddings
        embeddings = model.encode(texts)
        
        # Convert to list for JSON serialization
        embeddings_list = embeddings.tolist()
        
        return {
            'embeddings': embeddings_list,
            'model': model_name,
            'dimension': len(embeddings_list[0]) if embeddings_list else 0
        }
    except Exception as e:
        return {
            'error': str(e)
        }

if __name__ == '__main__':
    # Read input from stdin
    input_data = json.loads(sys.stdin.read())
    texts = input_data.get('texts', [])
    model_name = input_data.get('model', 'all-MiniLM-L6-v2')
    
    result = generate_embeddings(texts, model_name)
    print(json.dumps(result))
`;

class LocalEmbeddingsService {
  private pythonScriptPath: string;
  private modelName: string;

  constructor(modelName: string = 'all-MiniLM-L6-v2') {
    this.modelName = modelName;
    this.pythonScriptPath = path.join(process.cwd(), 'local_embeddings.py');
  }

  async initialize(): Promise<void> {
    // Write the Python script to disk
    await fs.writeFile(this.pythonScriptPath, PYTHON_SCRIPT);
    console.log('✅ Local embeddings service initialized');
  }

  async generateEmbeddings(texts: string[]): Promise<LocalEmbeddingResponse> {
    if (!texts || texts.length === 0) {
      return { embeddings: [] };
    }

    return new Promise((resolve, reject) => {
      const python = spawn('python3', [this.pythonScriptPath]);
      
      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          console.error('Python script error:', stderr);
          resolve({ 
            embeddings: [], 
            error: `Python script failed with code ${code}: ${stderr}` 
          });
          return;
        }

        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            resolve({ embeddings: [], error: result.error });
          } else {
            resolve({ embeddings: result.embeddings });
          }
        } catch (parseError) {
          resolve({ 
            embeddings: [], 
            error: `Failed to parse Python output: ${parseError}` 
          });
        }
      });

      python.on('error', (error) => {
        resolve({ 
          embeddings: [], 
          error: `Failed to spawn Python process: ${error.message}` 
        });
      });

      // Send input to Python script
      const input = JSON.stringify({
        texts,
        model: this.modelName
      });
      
      python.stdin.write(input);
      python.stdin.end();
    });
  }

  async cleanup(): Promise<void> {
    try {
      await fs.unlink(this.pythonScriptPath);
    } catch (error) {
      // File might not exist, ignore error
    }
  }
}

// Singleton instance
const localEmbeddingsService = new LocalEmbeddingsService();

export { localEmbeddingsService };
export default LocalEmbeddingsService;