import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { authMiddleware } from './auth';

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

export default router;