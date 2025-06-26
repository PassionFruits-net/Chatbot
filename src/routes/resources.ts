import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import db from '../utils/db';
import { authMiddleware } from './auth';
import { extractText } from '../services/extractor';
import { chunkText } from '../services/chunker';
import { embedTexts, embeddingToBuffer } from '../services/embed';

const router = Router();

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'data', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'text/url'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

router.post('/upload', authMiddleware, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { customerId } = req.body;
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const text = await extractText(req.file.path, req.file.mimetype);
    
    const resourceStmt = db.prepare(`
      INSERT INTO resources (customerId, fileName, filePath, mime)
      VALUES (?, ?, ?, ?)
    `);
    
    const resourceResult = resourceStmt.run(
      customerId,
      req.file.originalname,
      req.file.path,
      req.file.mimetype
    );
    
    const resourceId = resourceResult.lastInsertRowid;
    
    const chunks = chunkText(text);
    const chunkTexts = chunks.map(c => c.text);
    const embeddings = await embedTexts(chunkTexts, customerId);
    
    const chunkStmt = db.prepare(`
      INSERT INTO chunks (resourceId, customerId, chunkText, embedding)
      VALUES (?, ?, ?, ?)
    `);
    
    const insertChunks = db.transaction(() => {
      for (let i = 0; i < chunks.length; i++) {
        chunkStmt.run(
          resourceId,
          customerId,
          chunks[i].text,
          embeddingToBuffer(embeddings[i])
        );
      }
    });
    
    insertChunks();
    
    res.json({ 
      success: true, 
      resourceId,
      fileName: req.file.originalname,
      chunks: chunks.length
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

router.get('/list/:customerId', authMiddleware, (req: Request, res: Response) => {
  const { customerId } = req.params;
  
  const resources = db.prepare(`
    SELECT id, fileName, uploadedAt,
           (SELECT COUNT(*) FROM chunks WHERE resourceId = resources.id) as chunkCount
    FROM resources 
    WHERE customerId = ?
    ORDER BY uploadedAt DESC
  `).all(customerId);
  
  res.json(resources);
});

router.post('/upload-url', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { customerId, url } = req.body;
    
    if (!customerId || !url) {
      return res.status(400).json({ error: 'customerId and url are required' });
    }
    
    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    
    // Create a temporary file with the URL content
    const uploadDir = path.join(process.cwd(), 'data', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    
    const fileName = `url-${Date.now()}.txt`;
    const filePath = path.join(uploadDir, fileName);
    
    // Write URL to file (the extractor will handle fetching the content)
    await fs.writeFile(filePath, url);
    
    // Extract text from URL
    const text = await extractText(filePath, 'text/url');
    
    // Get a readable name from URL
    const urlObj = new URL(url);
    const displayName = `${urlObj.hostname}${urlObj.pathname}`.replace(/\//g, '_');
    
    const resourceStmt = db.prepare(`
      INSERT INTO resources (customerId, fileName, filePath, mime)
      VALUES (?, ?, ?, ?)
    `);
    
    const resourceResult = resourceStmt.run(
      customerId,
      displayName,
      filePath,
      'text/url'
    );
    
    const resourceId = resourceResult.lastInsertRowid;
    
    const chunks = chunkText(text);
    const chunkTexts = chunks.map(c => c.text);
    const embeddings = await embedTexts(chunkTexts, customerId);
    
    const chunkStmt = db.prepare(`
      INSERT INTO chunks (resourceId, customerId, chunkText, embedding)
      VALUES (?, ?, ?, ?)
    `);
    
    const insertChunks = db.transaction(() => {
      for (let i = 0; i < chunks.length; i++) {
        chunkStmt.run(
          resourceId,
          customerId,
          chunks[i].text,
          embeddingToBuffer(embeddings[i])
        );
      }
    });
    
    insertChunks();
    
    res.json({ 
      success: true, 
      resourceId,
      fileName: displayName,
      url,
      chunks: chunks.length
    });
  } catch (error) {
    console.error('URL upload error:', error);
    res.status(500).json({ error: 'Failed to process URL' });
  }
});

router.delete('/:resourceId', authMiddleware, async (req: Request, res: Response) => {
  const { resourceId } = req.params;
  
  const resource = db.prepare('SELECT filePath FROM resources WHERE id = ?').get(resourceId) as any;
  
  if (!resource) {
    return res.status(404).json({ error: 'Resource not found' });
  }
  
  try {
    await fs.unlink(resource.filePath);
  } catch (error) {
    console.error('Failed to delete file:', error);
  }
  
  db.prepare('DELETE FROM resources WHERE id = ?').run(resourceId);
  
  res.json({ success: true });
});

export default router;