import { Router, Request, Response } from 'express';
import { authMiddleware } from './auth';
import { getUsageStats, getDailyCosts, getTotalCost } from '../services/cost-tracker';

const router = Router();

router.get('/usage/:customerId?', authMiddleware, (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const days = parseInt(req.query.days as string) || 30;
    
    const stats = getUsageStats(customerId, days);
    const dailyCosts = getDailyCosts(customerId, days);
    const totalCost = getTotalCost(customerId);
    
    res.json({
      stats,
      dailyCosts,
      totalCost,
      period: days
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get usage analytics' });
  }
});

router.get('/customers', authMiddleware, (req: Request, res: Response) => {
  try {
    const db = require('../utils/db').default;
    const customerStats = db.prepare(`
      SELECT 
        customerId,
        COUNT(*) as totalRequests,
        SUM(inputTokens) as totalInputTokens,
        SUM(outputTokens) as totalOutputTokens,
        SUM(estimatedCost) as totalCost,
        MAX(timestamp) as lastActivity
      FROM usage_tracking 
      GROUP BY customerId 
      ORDER BY totalCost DESC
    `).all();
    
    res.json(customerStats);
  } catch (error) {
    console.error('Customer analytics error:', error);
    res.status(500).json({ error: 'Failed to get customer analytics' });
  }
});

export default router;