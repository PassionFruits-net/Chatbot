import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { authMiddleware } from './auth';
import db from '../utils/db';

const router = Router();

const envPath = path.join(process.cwd(), '.env');

router.get('/api-key', authMiddleware, async (req: Request, res: Response) => {
  const apiKey = process.env.OPENAI_API_KEY || '';
  const masked = apiKey ? `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}` : '';
  res.json({ 
    hasKey: !!apiKey && apiKey !== 'YOUR_ACTUAL_API_KEY_HERE' && apiKey !== 'sk-your-openai-api-key',
    masked 
  });
});

router.post('/api-key', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey || !apiKey.startsWith('sk-')) {
      return res.status(400).json({ error: 'Invalid API key format' });
    }
    
    let envContent = await fs.readFile(envPath, 'utf-8').catch(() => '');
    
    if (envContent.includes('OPENAI_API_KEY=')) {
      envContent = envContent.replace(/OPENAI_API_KEY=.*/, `OPENAI_API_KEY=${apiKey}`);
    } else {
      envContent += `\nOPENAI_API_KEY=${apiKey}`;
    }
    
    await fs.writeFile(envPath, envContent);
    
    process.env.OPENAI_API_KEY = apiKey;
    
    res.json({ success: true, message: 'API key updated successfully, server will restart...' });
    
    setTimeout(() => {
      console.log('Restarting server due to API key update...');
      process.exit(0);
    }, 1000);
  } catch (error) {
    console.error('Failed to update API key:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

// Global OpenAI settings
router.get('/openai-settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const settingRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('openai_enabled_globally') as { value: string } | undefined;
    const openaiEnabledGlobally = settingRow ? settingRow.value === 'true' : true;
    
    res.json({ openaiEnabledGlobally });
  } catch (error) {
    console.error('Failed to get OpenAI settings:', error);
    res.status(500).json({ error: 'Failed to get OpenAI settings' });
  }
});

router.post('/openai-settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { openaiEnabledGlobally } = req.body;
    
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)');
    stmt.run('openai_enabled_globally', openaiEnabledGlobally.toString());
    
    res.json({ success: true, message: 'OpenAI settings updated successfully' });
  } catch (error) {
    console.error('Failed to update OpenAI settings:', error);
    res.status(500).json({ error: 'Failed to update OpenAI settings' });
  }
});

// Local RAG settings
router.get('/local-rag-settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const settingRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('local_rag_enabled') as { value: string } | undefined;
    const localRAGEnabled = settingRow ? settingRow.value === 'true' : false;
    
    res.json({ localRAGEnabled });
  } catch (error) {
    console.error('Failed to get Local RAG settings:', error);
    res.status(500).json({ error: 'Failed to get Local RAG settings' });
  }
});

router.post('/local-rag-settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { localRAGEnabled } = req.body;
    
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)');
    stmt.run('local_rag_enabled', localRAGEnabled.toString());
    
    res.json({ success: true, message: 'Local RAG settings updated successfully' });
  } catch (error) {
    console.error('Failed to update Local RAG settings:', error);
    res.status(500).json({ error: 'Failed to update Local RAG settings' });
  }
});

// Customer OpenAI settings
router.get('/customer-openai-settings/:customerId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    
    const customerRow = db.prepare('SELECT openaiEnabled FROM customers WHERE customerId = ?').get(customerId) as { openaiEnabled: number } | undefined;
    const openaiEnabled = customerRow ? customerRow.openaiEnabled === 1 : true;
    
    res.json({ openaiEnabled });
  } catch (error) {
    console.error('Failed to get customer OpenAI settings:', error);
    res.status(500).json({ error: 'Failed to get customer OpenAI settings' });
  }
});

router.post('/customer-openai-settings/:customerId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { openaiEnabled } = req.body;
    
    // Insert or update customer settings
    const stmt = db.prepare(`
      INSERT INTO customers (customerId, openaiEnabled, createdAt, updatedAt) 
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(customerId) DO UPDATE SET 
        openaiEnabled = excluded.openaiEnabled,
        updatedAt = CURRENT_TIMESTAMP
    `);
    stmt.run(customerId, openaiEnabled ? 1 : 0);
    
    res.json({ success: true, message: 'Customer OpenAI settings updated successfully' });
  } catch (error) {
    console.error('Failed to update customer OpenAI settings:', error);
    res.status(500).json({ error: 'Failed to update customer OpenAI settings' });
  }
});

// Ollama model detection
router.get('/ollama-status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const fetch = (await import('node-fetch')).default;
    
    // Check if Ollama is running
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return res.json({ 
        available: false, 
        error: 'Ollama not running',
        activeModel: null, 
        availableModels: [] 
      });
    }
    
    const data = await response.json() as any;
    const models = data.models || [];
    
    // Find the largest model (by size) that could fit in available RAM
    let activeModel = null;
    if (models.length > 0) {
      // Sort by size (largest first) and pick the first one
      const sortedModels = models.sort((a: any, b: any) => (b.size || 0) - (a.size || 0));
      activeModel = sortedModels[0].name;
    }
    
    res.json({
      available: true,
      activeModel,
      availableModels: models.map((m: any) => ({
        name: m.name,
        size: m.size,
        modified: m.modified_at
      }))
    });
  } catch (error) {
    console.error('Ollama status check failed:', error);
    res.json({ 
      available: false, 
      error: 'Connection failed',
      activeModel: null, 
      availableModels: [] 
    });
  }
});

export default router;