import { Request, Response, NextFunction } from 'express';
import db from '../utils/db';

export function validateOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin || req.headers.referer;
  const customerId = req.body.customerId || req.query.customerId;
  
  console.log(`Origin validation - Origin: "${origin}", Customer: ${customerId}`);
  
  // Allow requests from admin panel
  if (origin && origin.includes('/admin')) {
    return next();
  }
  
  // For local file:// requests, the origin might be null, "null", or missing
  // We'll validate based on the allowed domains including 'file://'
  let effectiveOrigin = origin;
  if (!origin || origin === 'null' || origin === null) {
    effectiveOrigin = 'file://';
    console.log(`Treating null/missing origin as file://`);
  }
  
  if (!customerId) {
    return res.status(400).json({ error: 'Customer ID is required' });
  }
  
  try {
    // Get allowed domains for this customer
    const customer = db.prepare('SELECT allowedDomains FROM customers WHERE customerId = ?')
      .get(customerId) as { allowedDomains: string } | undefined;
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const allowedDomains = JSON.parse(customer.allowedDomains || '[]');
    
    // Check if origin matches any allowed domain
    const isAllowed = allowedDomains.some((domain: string) => {
      // Handle wildcard ports (e.g., http://localhost:*)
      const domainPattern = domain.replace(/:\*$/, ':\\d+');
      const regex = new RegExp(`^${domainPattern}$`);
      return regex.test(effectiveOrigin || '');
    });
    
    if (!isAllowed && allowedDomains.length > 0) {
      console.log(`Blocked request from ${effectiveOrigin} for customer ${customerId}`);
      return res.status(403).json({ 
        error: 'Origin not allowed',
        origin: effectiveOrigin,
        allowedDomains 
      });
    }
    
    next();
  } catch (error) {
    console.error('Origin validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}