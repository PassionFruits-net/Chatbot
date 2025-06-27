import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import resourcesRoutes from './routes/resources';
import configRoutes from './routes/config';
import analyticsRoutes from './routes/analytics';
import customersRoutes from './routes/customers';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Allow requests from whitelisted domains for the customer
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api', chatRoutes);
app.use('/api/resources', resourcesRoutes);
app.use('/api/config', configRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/customers', customersRoutes);

app.get('/', (req, res) => {
  res.redirect('/admin/login.html');
});

app.get('/admin', (req, res) => {
  res.redirect('/admin/login.html');
});

app.listen(PORT, () => {
  console.log(`🫐 Chatbot running on http://localhost:${PORT}`);
  console.log(`📊 Admin UI: http://localhost:${PORT}/admin`);
  console.log(`💬 Widget script: <script src="http://localhost:${PORT}/widget.js" data-customer="your-customer-id"></script>`);
});