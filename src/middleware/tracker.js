/**
 * LLM Tracking Middleware
 * 
 * This middleware intercepts all HTTP requests to detect and log
 * LLM company scraper activity. It coordinates between the detector,
 * logger, and IP analyzer services.
 */

const detector = require('../services/detector');
const enhancedDetector = require('../services/enhanced-detector');
const logger = require('../services/logger');
const { shouldTrackPath, isSensitivePath } = require('../config/llm-signatures');

/**
 * Main tracking middleware function
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function trackLLMActivity(req, res, next) {
  const startTime = Date.now();
  
  try {
    // Extract request information
    const requestInfo = extractRequestInfo(req);
    
    // Skip tracking for certain paths
    if (!shouldTrackPath(requestInfo.pageVisited)) {
      return next();
    }

    // Log sensitive path access (even if not LLM)
    if (isSensitivePath(requestInfo.pageVisited)) {
      console.log(`⚠️  Sensitive path accessed: ${requestInfo.pageVisited} from ${requestInfo.clientIP}`);
    }

    // Try enhanced detection first (catches more cases)
    let detection = await enhancedDetector.detectLLMActivity(req);
    
    // Fall back to standard detection if enhanced didn't find anything
    if (!detection) {
      detection = await detector.detectLLMCompany(
        requestInfo.userAgent, 
        requestInfo.clientIP, 
        requestInfo.hostname
      );
    }

    if (detection) {
      // Prepare activity data for logging
      const activityData = prepareActivityData(requestInfo, detection);
      
      // Log the activity (async, non-blocking)
      logger.logLLMActivity(activityData).catch(error => {
        console.error('❌ Failed to log LLM activity:', error.message);
      });

      // Add detection info to request for potential use by other middleware
      req.llmDetection = detection;
      req.llmActivity = activityData;
      
      // Log detection with emoji and details
      const processingTime = Date.now() - startTime;
      console.log(
        `🤖 ${detection.companyName} detected! ` +
        `${requestInfo.pageVisited} via ${detection.method} ` +
        `(${detection.confidence.toFixed(2)} confidence, ${processingTime}ms)`
      );

      // Add custom headers for debugging (in development)
      if (process.env.NODE_ENV === 'development') {
        res.set({
          'X-LLM-Detected': detection.companyName,
          'X-LLM-Method': detection.method,
          'X-LLM-Confidence': detection.confidence.toFixed(2)
        });
      }
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ LLM tracking middleware error (${processingTime}ms):`, error.message);
    
    // Don't break the request flow on tracking errors
    // Log the error for monitoring
    if (process.env.NODE_ENV === 'development') {
      res.set('X-LLM-Error', error.message);
    }
  }

  next();
}

/**
 * Extract relevant information from the request
 * @param {Object} req - Express request object
 * @returns {Object} - Extracted request information
 */
function extractRequestInfo(req) {
  // Get client IP address (considering proxies)
  const clientIP = getClientIP(req);
  
  // Get User-Agent header
  const userAgent = req.get('User-Agent') || '';
  
  // Get referer
  const referer = req.get('Referer') || req.get('Referrer') || '';
  
  // Get hostname
  const hostname = req.hostname || req.get('Host') || '';
  
  // Get the visited page (original URL)
  const pageVisited = req.originalUrl || req.url || '/';
  
  // Get session ID if available
  const sessionId = req.sessionID || req.session?.id || null;
  
  // Get additional headers that might be useful
  const acceptLanguage = req.get('Accept-Language') || '';
  const acceptEncoding = req.get('Accept-Encoding') || '';
  const connection = req.get('Connection') || '';
  
  return {
    clientIP,
    userAgent,
    referer,
    hostname,
    pageVisited,
    sessionId,
    acceptLanguage,
    acceptEncoding,
    connection,
    method: req.method,
    protocol: req.protocol,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get the real client IP address, considering proxies
 * @param {Object} req - Express request object
 * @returns {string} - Client IP address
 */
function getClientIP(req) {
  // Check various headers for the real IP (in order of preference)
  const ipHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'x-client-ip',
    'cf-connecting-ip', // Cloudflare
    'x-cluster-client-ip',
    'x-forwarded',
    'forwarded-for',
    'forwarded'
  ];

  // Check each header
  for (const header of ipHeaders) {
    const headerValue = req.get(header);
    if (headerValue) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      const ip = headerValue.split(',')[0].trim();
      if (ip && isValidIP(ip)) {
        return ip;
      }
    }
  }

  // Fall back to connection remote address
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
         'unknown';
}

/**
 * Basic IP address validation
 * @param {string} ip - IP address to validate
 * @returns {boolean} - Whether the IP is valid
 */
function isValidIP(ip) {
  if (!ip || typeof ip !== 'string') return false;
  
  // Remove any port numbers
  ip = ip.split(':')[0];
  
  // Basic IPv4 validation
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // Basic IPv6 validation (simplified)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Prepare activity data for logging
 * @param {Object} requestInfo - Extracted request information
 * @param {Object} detection - Detection result
 * @returns {Object} - Activity data ready for logging
 */
function prepareActivityData(requestInfo, detection) {
  return {
    timestamp: requestInfo.timestamp,
    company: detection.company,
    userAgent: requestInfo.userAgent,
    ipAddress: requestInfo.clientIP,
    pageVisited: requestInfo.pageVisited,
    referer: requestInfo.referer,
    detectionMethod: detection.method,
    country: detection.ipInfo?.country,
    asn: detection.ipInfo?.asn,
    organization: detection.ipInfo?.organization,
    isGuidedPath: detector.isGuidedPath(requestInfo.pageVisited),
    sessionId: requestInfo.sessionId,
    // Additional metadata
    confidence: detection.confidence,
    details: detection.details,
    hostname: requestInfo.hostname,
    method: requestInfo.method,
    protocol: requestInfo.protocol
  };
}

/**
 * Middleware to add tracking headers for debugging
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function addTrackingHeaders(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
    res.set({
      'X-LLM-Tracker': 'active',
      'X-LLM-Version': '1.0.0',
      'X-LLM-Timestamp': new Date().toISOString()
    });
  }
  next();
}

/**
 * Middleware to log all requests (for debugging)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function logAllRequests(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
    const requestInfo = extractRequestInfo(req);
    console.log(
      `📥 ${requestInfo.method} ${requestInfo.pageVisited} ` +
      `from ${requestInfo.clientIP} ` +
      `(${requestInfo.userAgent.substring(0, 50)}...)`
    );
  }
  next();
}

/**
 * Get tracking statistics
 * @returns {Object} - Tracking statistics
 */
function getTrackingStats() {
  return {
    detector: detector.getStats(),
    logger: logger.getLoggerStats(),
    timestamp: new Date().toISOString()
  };
}

/**
 * Test the tracking middleware with sample data
 * @returns {Promise<Object>} - Test results
 */
async function testTracking() {
  console.log('🧪 Testing tracking middleware...');
  
  const testCases = [
    {
      name: 'OpenAI GPTBot',
      userAgent: 'GPTBot/1.0 (+https://openai.com/gptbot)',
      ip: '23.102.140.115',
      path: '/case-studies/ai-implementation'
    },
    {
      name: 'Regular Browser',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ip: '192.168.1.100',
      path: '/about'
    },
    {
      name: 'Anthropic ClaudeBot',
      userAgent: 'ClaudeBot/1.0 (+https://www.anthropic.com/claude-bot)',
      ip: '160.79.104.50',
      path: '/research/llm-benchmarks'
    }
  ];

  const results = [];
  
  for (const testCase of testCases) {
    try {
      // Create mock request object
      const mockReq = {
        get: (header) => {
          if (header === 'User-Agent') return testCase.userAgent;
          if (header === 'Host') return 'synapticlabs.ai';
          return '';
        },
        ip: testCase.ip,
        originalUrl: testCase.path,
        method: 'GET',
        protocol: 'https',
        hostname: 'synapticlabs.ai'
      };

      const requestInfo = extractRequestInfo(mockReq);
      const detection = await detector.detectLLMCompany(
        requestInfo.userAgent,
        requestInfo.clientIP
      );

      results.push({
        testCase: testCase.name,
        detected: !!detection,
        company: detection?.companyName || 'None',
        method: detection?.method || 'None',
        confidence: detection?.confidence || 0,
        path: testCase.path
      });
    } catch (error) {
      results.push({
        testCase: testCase.name,
        detected: false,
        error: error.message
      });
    }
  }

  console.log('✅ Tracking middleware tests completed');
  return results;
}

module.exports = {
  trackLLMActivity,
  addTrackingHeaders,
  logAllRequests,
  getTrackingStats,
  testTracking,
  extractRequestInfo,
  getClientIP
};
