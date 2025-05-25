/**
 * LLM Scraper Tracker - Main Express Application
 * 
 * This is the main entry point for the LLM scraper tracking system.
 * It sets up the Express server with all middleware, routes, and error handling.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Import our custom middleware and routes
const { trackLLMActivity, addTrackingHeaders } = require('./middleware/tracker');
const apiRoutes = require('./routes/api');
const dashboardRoutes = require('./routes/dashboard');
const webhookRoutes = require('./routes/webhook');

// Import database for health checks
const { testConnection, getHealthStatus } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting LLM Scraper Tracker...');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost and synapticlabs.ai
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:8080',
      'https://synapticlabs.ai',
      'https://www.synapticlabs.ai'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`🚫 CORS blocked origin: ${origin}`);
      callback(null, true); // Allow for now, but log
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    skip: (req, res) => {
      // Skip logging for health checks and static assets
      return req.url === '/health' || req.url.startsWith('/static/');
    }
  }));
}

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy for accurate IP addresses (important for Railway/Heroku)
app.set('trust proxy', true);

// Add tracking headers for debugging
app.use(addTrackingHeaders);

// Serve static files for dashboard
app.use('/static', express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true
}));

// Health check endpoint (before tracking middleware to avoid logging)
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await getHealthStatus();
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'LLM Scraper Tracker',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: dbHealth
    };
    
    if (dbHealth.status !== 'healthy') {
      health.status = 'degraded';
      return res.status(503).json(health);
    }
    
    res.json(health);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Apply LLM tracking middleware to all routes (except health and static)
app.use((req, res, next) => {
  // Skip tracking for health checks and static assets
  if (req.url === '/health' || req.url.startsWith('/static/')) {
    return next();
  }
  return trackLLMActivity(req, res, next);
});

// API Routes
app.use('/api', apiRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/webhook', webhookRoutes);

// Root route with service information
app.get('/', (req, res) => {
  res.json({
    service: 'LLM Scraper Tracker',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    description: 'Tracks LLM company scrapers accessing Synapticlabs.ai',
    endpoints: {
      health: '/health',
      api: '/api',
      dashboard: '/dashboard',
      webhook: '/webhook',
      documentation: 'https://github.com/synapticlabs/llm-scraper-tracker'
    },
    detectedLLM: req.llmDetection ? {
      company: req.llmDetection.companyName,
      method: req.llmDetection.method,
      confidence: req.llmDetection.confidence
    } : null
  });
});

// Robots.txt for web crawlers
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /

# LLM Scrapers - Welcome!
# This service tracks LLM company scrapers
# For more info: /api/stats

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

Sitemap: ${req.protocol}://${req.get('host')}/sitemap.xml
`);
});

// Simple sitemap for LLM crawlers
app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/api/stats</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/dashboard</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>`);
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`❓ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    suggestion: 'Try /api/stats for analytics or /dashboard for the web interface'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('💥 Application error:', err);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({ 
    error: 'Internal server error',
    message: isDevelopment ? err.message : 'Something went wrong',
    stack: isDevelopment ? err.stack : undefined,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 LLM Scraper Tracker running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`🔌 API: http://localhost:${PORT}/api`);
  console.log(`🩺 Health: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Test database connection on startup
  if (process.env.NODE_ENV !== 'test') {
    testConnection().then(success => {
      if (success) {
        console.log('✅ Database connection verified');
      } else {
        console.error('❌ Database connection failed - check your Supabase configuration');
      }
    });
  }
});

// Handle server startup errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});

module.exports = app;
