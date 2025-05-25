/**
 * LLM Detection Engine
 * 
 * This service detects LLM company scrapers using multiple methods:
 * - User-Agent string analysis
 * - IP range checking
 * - ASN (Autonomous System Number) verification
 * - Reverse DNS lookup for Google verification
 */

const { LLM_SIGNATURES, isGuidedPath } = require('../config/llm-signatures');
const { analyzeIP } = require('./ipAnalyzer');
const ipRangeCheck = require('ip-range-check');
const dns = require('dns').promises;

class LLMDetector {
  constructor() {
    this.detectionStats = {
      totalDetections: 0,
      methodCounts: {
        user_agent: 0,
        ip_range: 0,
        asn: 0,
        reverse_dns: 0
      },
      companyCounts: {}
    };
  }

  /**
   * Main detection method - analyzes request to identify LLM companies
   * @param {string} userAgent - The User-Agent header
   * @param {string} ipAddress - The client IP address
   * @param {string} hostname - The hostname (optional)
   * @returns {Promise<Object|null>} - Detection result or null if no match
   */
  async detectLLMCompany(userAgent, ipAddress, hostname = null) {
    const detectionResults = [];

    try {
      // Method 1: Check User-Agent patterns
      const userAgentDetection = this.checkUserAgent(userAgent);
      if (userAgentDetection) {
        detectionResults.push(userAgentDetection);
        console.log(`🔍 User-Agent detection: ${userAgentDetection.companyName} (${userAgentDetection.confidence})`);
      }

      // Method 2: Check IP ranges and ASN
      if (ipAddress) {
        const ipDetection = await this.checkIPAddress(ipAddress, hostname);
        if (ipDetection) {
          detectionResults.push(ipDetection);
          console.log(`🌐 IP detection: ${ipDetection.companyName} (${ipDetection.confidence})`);
        }
      }

      // Select the best detection result
      const bestDetection = this.selectBestDetection(detectionResults);
      
      if (bestDetection) {
        this.updateStats(bestDetection);
        console.log(`✅ LLM detected: ${bestDetection.companyName} via ${bestDetection.method}`);
      }

      return bestDetection;
    } catch (error) {
      console.error('❌ Detection error:', error.message);
      return null;
    }
  }

  /**
   * Check User-Agent string against known LLM patterns
   * @param {string} userAgent - The User-Agent header
   * @returns {Object|null} - Detection result or null
   */
  checkUserAgent(userAgent) {
    if (!userAgent || typeof userAgent !== 'string') {
      return null;
    }

    const lowerUserAgent = userAgent.toLowerCase();

    // Check each company's User-Agent patterns
    for (const [companyKey, config] of Object.entries(LLM_SIGNATURES)) {
      for (const signature of config.userAgents) {
        const lowerSignature = signature.toLowerCase();
        
        // Check for exact match or contains
        if (lowerUserAgent.includes(lowerSignature)) {
          return {
            company: companyKey,
            companyName: config.name,
            method: 'user_agent',
            confidence: this.calculateUserAgentConfidence(userAgent, signature),
            details: `Matched User-Agent pattern: "${signature}"`,
            matchedPattern: signature,
            fullUserAgent: userAgent
          };
        }
      }
    }

    return null;
  }

  /**
   * Check IP address against known ranges and ASN
   * @param {string} ipAddress - The IP address to check
   * @param {string} hostname - The hostname (optional)
   * @returns {Promise<Object|null>} - Detection result or null
   */
  async checkIPAddress(ipAddress, hostname = null) {
    if (!ipAddress) return null;

    try {
      // Get IP information
      const ipInfo = await analyzeIP(ipAddress);
      
      // Check against known IP ranges first (highest confidence)
      for (const [companyKey, config] of Object.entries(LLM_SIGNATURES)) {
        if (config.ipRanges && config.ipRanges.length > 0) {
          for (const range of config.ipRanges) {
            if (ipRangeCheck(ipAddress, range)) {
              return {
                company: companyKey,
                companyName: config.name,
                method: 'ip_range',
                confidence: 0.9,
                details: `IP ${ipAddress} matches known range ${range}`,
                ipInfo,
                matchedRange: range
              };
            }
          }
        }
      }

      // Check ASN matches (medium confidence)
      if (ipInfo.asn) {
        for (const [companyKey, config] of Object.entries(LLM_SIGNATURES)) {
          if (config.asn && ipInfo.asn === config.asn) {
            // Special handling for Google - requires reverse DNS verification
            if (companyKey === 'google') {
              const isValidGoogle = await this.verifyGooglebot(ipAddress);
              if (isValidGoogle) {
                return {
                  company: companyKey,
                  companyName: config.name,
                  method: 'reverse_dns',
                  confidence: 0.95,
                  details: 'Verified Google crawler via reverse DNS',
                  ipInfo,
                  reverseDnsVerified: true
                };
              }
            } else {
              return {
                company: companyKey,
                companyName: config.name,
                method: 'asn',
                confidence: 0.7,
                details: `ASN match: ${config.asn}`,
                ipInfo,
                matchedAsn: config.asn
              };
            }
          }
        }
      }

      // Check organization name patterns (lower confidence)
      if (ipInfo.organization) {
        const orgDetection = this.checkOrganizationName(ipInfo.organization, ipInfo);
        if (orgDetection) {
          return orgDetection;
        }
      }

      return null;
    } catch (error) {
      console.error('❌ IP analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Check organization name for LLM company indicators
   * @param {string} organization - The organization name
   * @param {Object} ipInfo - The IP information
   * @returns {Object|null} - Detection result or null
   */
  checkOrganizationName(organization, ipInfo) {
    if (!organization) return null;

    const lowerOrg = organization.toLowerCase();
    
    // Organization name patterns for each company
    const orgPatterns = {
      google: ['google', 'googlebot', 'google inc', 'alphabet'],
      openai: ['openai', 'open ai'],
      anthropic: ['anthropic'],
      meta: ['facebook', 'meta', 'meta platforms'],
      perplexity: ['perplexity', 'pplx']
    };

    for (const [companyKey, patterns] of Object.entries(orgPatterns)) {
      for (const pattern of patterns) {
        if (lowerOrg.includes(pattern)) {
          return {
            company: companyKey,
            companyName: LLM_SIGNATURES[companyKey]?.name || companyKey,
            method: 'organization',
            confidence: 0.6,
            details: `Organization name contains "${pattern}": ${organization}`,
            ipInfo,
            matchedPattern: pattern
          };
        }
      }
    }

    return null;
  }

  /**
   * Verify Google crawler via reverse DNS lookup
   * @param {string} ipAddress - The IP address to verify
   * @returns {Promise<boolean>} - Whether it's a verified Google crawler
   */
  async verifyGooglebot(ipAddress) {
    try {
      console.log(`🔍 Verifying Google crawler for IP: ${ipAddress}`);
      
      // Perform reverse DNS lookup
      const hostnames = await dns.reverse(ipAddress);
      
      if (hostnames && hostnames.length > 0) {
        // Check if any hostname ends with valid Google domains
        const validGoogleDomains = ['.googlebot.com', '.google.com', '.crawl.yahoo.net'];
        
        for (const hostname of hostnames) {
          const lowerHostname = hostname.toLowerCase();
          if (validGoogleDomains.some(domain => lowerHostname.endsWith(domain))) {
            // Forward lookup to verify the hostname resolves back to the same IP
            try {
              const addresses = await dns.resolve4(hostname);
              if (addresses.includes(ipAddress)) {
                console.log(`✅ Google crawler verified: ${hostname} -> ${ipAddress}`);
                return true;
              }
            } catch (forwardError) {
              console.log(`⚠️  Forward DNS lookup failed for ${hostname}`);
            }
          }
        }
      }
      
      console.log(`❌ Google crawler verification failed for ${ipAddress}`);
      return false;
    } catch (error) {
      console.log(`❌ Reverse DNS lookup failed for ${ipAddress}: ${error.message}`);
      return false;
    }
  }

  /**
   * Calculate confidence score for User-Agent matches
   * @param {string} userAgent - The full User-Agent string
   * @param {string} signature - The matched signature
   * @returns {number} - Confidence score (0-1)
   */
  calculateUserAgentConfidence(userAgent, signature) {
    // Exact match gets highest confidence
    if (userAgent.toLowerCase() === signature.toLowerCase()) {
      return 0.95;
    }
    
    // Check if it's a well-known bot signature
    const highConfidenceSignatures = ['gptbot', 'claudebot', 'googlebot', 'perplexitybot'];
    if (highConfidenceSignatures.some(sig => signature.toLowerCase().includes(sig))) {
      return 0.9;
    }
    
    // Partial match gets medium confidence
    return 0.8;
  }

  /**
   * Select the best detection from multiple results
   * @param {Array} detections - Array of detection results
   * @returns {Object|null} - Best detection or null
   */
  selectBestDetection(detections) {
    if (detections.length === 0) return null;
    
    // Sort by confidence score (highest first)
    detections.sort((a, b) => b.confidence - a.confidence);
    
    // Return the highest confidence detection
    const bestDetection = detections[0];
    
    // Add additional context if multiple detections exist
    if (detections.length > 1) {
      bestDetection.alternativeDetections = detections.slice(1);
    }
    
    return bestDetection;
  }

  /**
   * Check if a path is part of guided content strategy
   * @param {string} path - The URL path
   * @returns {boolean} - Whether the path is guided
   */
  isGuidedPath(path) {
    return isGuidedPath(path);
  }

  /**
   * Update detection statistics
   * @param {Object} detection - The detection result
   */
  updateStats(detection) {
    this.detectionStats.totalDetections++;
    this.detectionStats.methodCounts[detection.method] = 
      (this.detectionStats.methodCounts[detection.method] || 0) + 1;
    this.detectionStats.companyCounts[detection.company] = 
      (this.detectionStats.companyCounts[detection.company] || 0) + 1;
  }

  /**
   * Get detection statistics
   * @returns {Object} - Detection statistics
   */
  getStats() {
    return {
      ...this.detectionStats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset detection statistics
   */
  resetStats() {
    this.detectionStats = {
      totalDetections: 0,
      methodCounts: {
        user_agent: 0,
        ip_range: 0,
        asn: 0,
        reverse_dns: 0,
        organization: 0
      },
      companyCounts: {}
    };
    console.log('📊 Detection statistics reset');
  }

  /**
   * Test detection with sample data
   * @returns {Promise<Object>} - Test results
   */
  async runDetectionTest() {
    console.log('🧪 Running detection tests...');
    
    const testCases = [
      {
        name: 'OpenAI GPTBot',
        userAgent: 'GPTBot/1.0 (+https://openai.com/gptbot)',
        ipAddress: '23.102.140.115'
      },
      {
        name: 'Anthropic ClaudeBot',
        userAgent: 'ClaudeBot/1.0 (+https://www.anthropic.com/claude-bot)',
        ipAddress: '160.79.104.50'
      },
      {
        name: 'Google Extended',
        userAgent: 'Mozilla/5.0 (compatible; Google-Extended)',
        ipAddress: '66.249.66.1'
      },
      {
        name: 'Perplexity Bot',
        userAgent: 'PerplexityBot/1.0 (+https://perplexity.ai/bot)',
        ipAddress: '104.18.26.48'
      }
    ];

    const results = [];
    
    for (const testCase of testCases) {
      try {
        const detection = await this.detectLLMCompany(
          testCase.userAgent, 
          testCase.ipAddress
        );
        
        results.push({
          testCase: testCase.name,
          detected: !!detection,
          company: detection?.companyName || 'None',
          method: detection?.method || 'None',
          confidence: detection?.confidence || 0
        });
      } catch (error) {
        results.push({
          testCase: testCase.name,
          detected: false,
          error: error.message
        });
      }
    }

    console.log('✅ Detection tests completed');
    return results;
  }
}

// Create singleton instance
const detector = new LLMDetector();

module.exports = detector;
