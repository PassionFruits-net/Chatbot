import { Router, Request, Response } from 'express';
import { authMiddleware } from './auth';
import db from '../utils/db';

const router = Router();

router.get('/overview', authMiddleware, (req: Request, res: Response) => {
  try {
    // Get all customers with their resource counts and costs
    const customers = db.prepare(`
      SELECT 
        cust.customerId,
        cust.name,
        COALESCE(COUNT(DISTINCT r.id), 0) as resourceCount,
        COALESCE(COUNT(DISTINCT c.id), 0) as chunkCount,
        MIN(r.uploadedAt) as firstUpload,
        MAX(r.uploadedAt) as lastUpload,
        COALESCE(u.totalCost, 0) as totalCost,
        COALESCE(u.totalRequests, 0) as totalRequests,
        COALESCE(cust.openaiEnabled, 1) as openaiEnabled,
        COALESCE(cust.explanationComplexity, 'advanced') as explanationComplexity,
        COALESCE(cust.allowComplexitySelection, 0) as allowComplexitySelection,
        cust.systemPrompt as systemPrompt
      FROM customers cust
      LEFT JOIN resources r ON cust.customerId = r.customerId
      LEFT JOIN chunks c ON r.id = c.resourceId
      LEFT JOIN (
        SELECT 
          customerId,
          SUM(estimatedCost) as totalCost,
          COUNT(*) as totalRequests
        FROM usage_tracking 
        GROUP BY customerId
      ) u ON cust.customerId = u.customerId
      GROUP BY cust.customerId, cust.name, cust.openaiEnabled, cust.explanationComplexity, cust.allowComplexitySelection, cust.systemPrompt
      ORDER BY cust.customerId
    `).all();

    // Get resources for each customer
    const customersWithResources = customers.map((customer: any) => {
      const resources = db.prepare(`
        SELECT 
          r.id,
          r.fileName,
          r.mime,
          r.uploadedAt,
          COUNT(c.id) as chunkCount
        FROM resources r
        LEFT JOIN chunks c ON r.id = c.resourceId
        WHERE r.customerId = ?
        GROUP BY r.id
        ORDER BY r.uploadedAt DESC
      `).all(customer.customerId);

      return {
        ...customer,
        resources
      };
    });

    // Calculate totals
    const totals = {
      totalCustomers: customers.length,
      totalResources: customers.reduce((sum, c: any) => sum + c.resourceCount, 0),
      totalChunks: customers.reduce((sum, c: any) => sum + c.chunkCount, 0),
      totalCost: customers.reduce((sum, c: any) => sum + c.totalCost, 0)
    };

    res.json({
      customers: customersWithResources,
      totals
    });
  } catch (error) {
    console.error('Customer overview error:', error);
    res.status(500).json({ error: 'Failed to get customer overview' });
  }
});

router.get('/:customerId/settings', (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    
    const customer = db.prepare(`
      SELECT 
        explanationComplexity, 
        allowComplexitySelection 
      FROM customers 
      WHERE customerId = ?
    `).get(customerId) as { 
      explanationComplexity: string; 
      allowComplexitySelection: number; 
    } | undefined;
    
    if (!customer) {
      // Return default settings for new customers
      return res.json({ 
        explanationComplexity: 'advanced',
        allowComplexitySelection: false
      });
    }
    
    res.json({
      explanationComplexity: customer.explanationComplexity || 'advanced',
      allowComplexitySelection: customer.allowComplexitySelection === 1
    });
  } catch (error) {
    console.error('Failed to get customer settings:', error);
    res.status(500).json({ error: 'Failed to get customer settings' });
  }
});

router.get('/:customerId/domains', authMiddleware, (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    
    const customer = db.prepare('SELECT allowedDomains FROM customers WHERE customerId = ?').get(customerId) as { allowedDomains: string } | undefined;
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const domains = JSON.parse(customer.allowedDomains || '[]');
    res.json({ domains });
  } catch (error) {
    console.error('Failed to get domains:', error);
    res.status(500).json({ error: 'Failed to get domains' });
  }
});

router.post('/:customerId/domains', authMiddleware, (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { domains } = req.body;
    
    if (!Array.isArray(domains)) {
      return res.status(400).json({ error: 'Domains must be an array' });
    }
    
    // Validate domain format
    const validDomains = domains.filter(d => {
      try {
        // Allow wildcards for ports
        const testUrl = d.replace(':*', ':3000');
        new URL(testUrl);
        return true;
      } catch {
        return false;
      }
    });
    
    const stmt = db.prepare('UPDATE customers SET allowedDomains = ? WHERE customerId = ?');
    stmt.run(JSON.stringify(validDomains), customerId);
    
    res.json({ success: true, domains: validDomains });
  } catch (error) {
    console.error('Failed to update domains:', error);
    res.status(500).json({ error: 'Failed to update domains' });
  }
});

router.post('/:customerId/explanation-settings', authMiddleware, (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { explanationComplexity, allowComplexitySelection, systemPrompt } = req.body;
    
    // Validate explanationComplexity
    if (explanationComplexity && !['simple', 'advanced'].includes(explanationComplexity)) {
      return res.status(400).json({ error: 'Explanation complexity must be "simple" or "advanced"' });
    }
    
    // Validate allowComplexitySelection
    if (allowComplexitySelection !== undefined && typeof allowComplexitySelection !== 'boolean') {
      return res.status(400).json({ error: 'Allow complexity selection must be a boolean' });
    }
    
    // Validate systemPrompt
    if (systemPrompt !== undefined && typeof systemPrompt !== 'string') {
      return res.status(400).json({ error: 'System prompt must be a string' });
    }
    
    const updateFields = [];
    const params = [];
    
    if (explanationComplexity) {
      updateFields.push('explanationComplexity = ?');
      params.push(explanationComplexity);
    }
    
    if (allowComplexitySelection !== undefined) {
      updateFields.push('allowComplexitySelection = ?');
      // Convert boolean to integer for SQLite
      params.push(allowComplexitySelection ? 1 : 0);
    }
    
    if (systemPrompt !== undefined) {
      updateFields.push('systemPrompt = ?');
      params.push(systemPrompt || null);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    params.push(customerId);
    
    const stmt = db.prepare(`UPDATE customers SET ${updateFields.join(', ')} WHERE customerId = ?`);
    stmt.run(...params);
    
    res.json({ success: true, message: 'Explanation settings updated successfully' });
  } catch (error) {
    console.error('Failed to update explanation settings:', error);
    res.status(500).json({ error: 'Failed to update explanation settings' });
  }
});

router.delete('/:customerId', authMiddleware, (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    
    // Delete all resources and chunks for this customer
    const deleteChunks = db.prepare('DELETE FROM chunks WHERE customerId = ?');
    const deleteResources = db.prepare('DELETE FROM resources WHERE customerId = ?');
    const deleteUsage = db.prepare('DELETE FROM usage_tracking WHERE customerId = ?');
    
    const transaction = db.transaction(() => {
      deleteChunks.run(customerId);
      deleteResources.run(customerId);
      deleteUsage.run(customerId);
    });
    
    transaction();
    
    res.json({ success: true, message: `Deleted all data for customer: ${customerId}` });
  } catch (error) {
    console.error('Customer deletion error:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

export default router;