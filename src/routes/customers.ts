import { Router, Request, Response } from 'express';
import { authMiddleware } from './auth';
import db from '../utils/db';

const router = Router();

router.get('/overview', authMiddleware, (req: Request, res: Response) => {
  try {
    // Get all customers with their resource counts and costs
    const customers = db.prepare(`
      SELECT 
        r.customerId,
        COUNT(DISTINCT r.id) as resourceCount,
        COUNT(DISTINCT c.id) as chunkCount,
        MIN(r.uploadedAt) as firstUpload,
        MAX(r.uploadedAt) as lastUpload,
        COALESCE(u.totalCost, 0) as totalCost,
        COALESCE(u.totalRequests, 0) as totalRequests
      FROM resources r
      LEFT JOIN chunks c ON r.id = c.resourceId
      LEFT JOIN (
        SELECT 
          customerId,
          SUM(estimatedCost) as totalCost,
          COUNT(*) as totalRequests
        FROM usage_tracking 
        GROUP BY customerId
      ) u ON r.customerId = u.customerId
      GROUP BY r.customerId
      ORDER BY r.customerId
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