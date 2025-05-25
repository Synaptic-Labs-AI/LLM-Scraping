/**
 * Webhook Routes for LLM Scraper Tracker
 * 
 * This file contains webhook endpoints for external tracking integration.
 * These endpoints allow the Synapticlabs.ai website to send tracking data.
 */

const express = require('express');
const detector = require('../services/detector');
const logger = require('../services/logger');

const router = express.Router();

// Middleware to add webhook headers
router.use((req, res, next) => {
  res.set({
    'X-Webhook-Version': '1.0.0',
    'X-Service': 'LLM-Scraper-Tracker'
  });
  next();
});

/**
 * POST /webhook/track
 * Main webhook endpoint for external tracking
 */
router.post('/track', async (req, res) => {
  try {
    const {
      url,
      userAgent,
      referrer,
      timestamp,
      clientIP,
      headers
    } = req.body;

    // Validate required fields
    if (!url || !userAgent) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['url', 'userAgent'],
        received: Object.keys(req.body)
      });
    }

    // Use provided IP or fall back to request IP
    const ipAddress = clientIP || req.ip || 'unknown';

    console.log(`📥 Webhook tracking request: ${userAgent} -> ${url}`);

    // Detect LLM company
    const detection = await detector.detectLLMCompany(userAgent, ipAddress);

    if (detection) {
      // Prepare activity data for logging
      const activityData = {
        company: detection.company,
        userAgent: userAgent,
        ipAddress: ipAddress,
        pageVisited: url,
        referer: referrer,
        detectionMethod: detection.method,
        country: detection.ipInfo?.country,
        asn: detection.ipInfo?.asn,
        organization: detection.ipInfo?.organization,
        isGuidedPath: detector.isGuidedPath(url),
        timestamp: timestamp || new Date().toISOString(),
        sessionId: headers?.['x-session-id'] || null
      };

      // Log the activity
      const logged = await logger.logLLMActivity(activityData);

      console.log(`✅ Webhook: ${detection.companyName} detected and logged`);

      res.json({
        success: true,
        detected: true,
        company: detection.companyName,
        method: detection.method,
        confidence: detection.confidence,
        logged: logged,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`ℹ️  Webhook: No LLM detected for ${userAgent}`);
      
      res.json({
        success: true,
        detected: false,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Webhook tracking error:', error.message);
    res.status(500).json({ 
      error: 'Webhook processing failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /webhook/batch
 * Batch webhook endpoint for multiple tracking events
 */
router.post('/batch', async (req, res) => {
  try {
    const { events } = req.body;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({
        error: 'Missing or invalid events array'
      });
    }

    if (events.length > 100) {
      return res.status(400).json({
        error: 'Too many events in batch (max 100)'
      });
    }

    console.log(`📥 Webhook batch request: ${events.length} events`);

    const results = [];
    let detectedCount = 0;
    let loggedCount = 0;

    for (const event of events) {
      try {
        const { url, userAgent, referrer, timestamp, clientIP } = event;

        if (!url || !userAgent) {
          results.push({
            success: false,
            error: 'Missing required fields',
            event
          });
          continue;
        }

        const ipAddress = clientIP || req.ip || 'unknown';
        const detection = await detector.detectLLMCompany(userAgent, ipAddress);

        if (detection) {
          detectedCount++;

          const activityData = {
            company: detection.company,
            userAgent: userAgent,
            ipAddress: ipAddress,
            pageVisited: url,
            referer: referrer,
            detectionMethod: detection.method,
            country: detection.ipInfo?.country,
            asn: detection.ipInfo?.asn,
            organization: detection.ipInfo?.organization,
            isGuidedPath: detector.isGuidedPath(url),
            timestamp: timestamp || new Date().toISOString()
          };

          const logged = await logger.logLLMActivity(activityData);
          if (logged) loggedCount++;

          results.push({
            success: true,
            detected: true,
            company: detection.companyName,
            method: detection.method,
            logged
          });
        } else {
          results.push({
            success: true,
            detected: false
          });
        }
      } catch (eventError) {
        results.push({
          success: false,
          error: eventError.message,
          event
        });
      }
    }

    console.log(`✅ Webhook batch: ${detectedCount} detected, ${loggedCount} logged`);

    res.json({
      success: true,
      processed: events.length,
      detected: detectedCount,
      logged: loggedCount,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Webhook batch error:', error.message);
    res.status(500).json({
      error: 'Batch processing failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /webhook/test
 * Test endpoint for webhook functionality
 */
router.post('/test', (req, res) => {
  console.log('🧪 Webhook test request received');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);

  res.json({
    message: 'Webhook test successful',
    receivedData: {
      headers: req.headers,
      body: req.body,
      ip: req.ip,
      method: req.method
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /webhook/status
 * Get webhook service status
 */
router.get('/status', (req, res) => {
  res.json({
    service: 'Webhook Service',
    status: 'active',
    endpoints: {
      track: 'POST /webhook/track',
      batch: 'POST /webhook/batch',
      test: 'POST /webhook/test',
      status: 'GET /webhook/status'
    },
    limits: {
      batchSize: 100,
      maxPayload: '10MB'
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
