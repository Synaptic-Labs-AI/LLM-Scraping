/**
 * IP Address Analysis Service
 * 
 * This service analyzes IP addresses to gather geolocation and organization
 * information. It uses ipapi.co for IP lookups and includes caching to
 * avoid hitting rate limits.
 */

const axios = require('axios');

class IPAnalyzer {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.apiKey = process.env.IP_API_KEY; // Optional API key for higher limits
    this.requestCount = 0;
    this.lastReset = Date.now();
    this.maxRequestsPerDay = this.apiKey ? 10000 : 1000; // Free tier: 1000/day, paid: 10000/day
  }

  /**
   * Analyze an IP address and return detailed information
   * @param {string} ipAddress - The IP address to analyze
   * @returns {Promise<Object>} - IP analysis results
   */
  async analyzeIP(ipAddress) {
    // Validate IP address format
    if (!this.isValidIP(ipAddress)) {
      console.log(`⚠️  Invalid IP address format: ${ipAddress}`);
      return this.getDefaultIPInfo(ipAddress);
    }

    // Check if it's a private/local IP
    if (this.isPrivateIP(ipAddress)) {
      console.log(`🏠 Private IP detected: ${ipAddress}`);
      return this.getPrivateIPInfo(ipAddress);
    }

    // Check cache first
    const cacheKey = ipAddress;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`💾 Using cached IP info for ${ipAddress}`);
      return cached.data;
    }

    // Check rate limits
    if (!this.canMakeRequest()) {
      console.log(`⏰ Rate limit reached, using cached/default data for ${ipAddress}`);
      return cached?.data || this.getDefaultIPInfo(ipAddress);
    }

    try {
      console.log(`🔍 Analyzing IP: ${ipAddress}`);
      const ipInfo = await this.fetchIPInfo(ipAddress);
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: ipInfo,
        timestamp: Date.now()
      });

      this.requestCount++;
      return ipInfo;
    } catch (error) {
      console.error(`❌ IP analysis failed for ${ipAddress}:`, error.message);
      
      // Return cached data if available, otherwise default
      return cached?.data || this.getDefaultIPInfo(ipAddress);
    }
  }

  /**
   * Fetch IP information from the API
   * @param {string} ipAddress - The IP address to lookup
   * @returns {Promise<Object>} - IP information
   */
  async fetchIPInfo(ipAddress) {
    const url = `https://ipapi.co/${ipAddress}/json/`;
    const headers = {
      'User-Agent': 'Synapticlabs-LLM-Tracker/1.0',
      'Accept': 'application/json'
    };

    // Add API key if available
    const params = {};
    if (this.apiKey) {
      params.key = this.apiKey;
    }

    const response = await axios.get(url, {
      timeout: 5000,
      headers,
      params
    });

    // Check for API errors
    if (response.data.error) {
      throw new Error(`API Error: ${response.data.reason || 'Unknown error'}`);
    }

    const ipInfo = {
      ip: ipAddress,
      country: response.data.country_name || 'Unknown',
      countryCode: response.data.country_code || 'XX',
      region: response.data.region || 'Unknown',
      city: response.data.city || 'Unknown',
      organization: response.data.org || 'Unknown',
      asn: response.data.asn || null,
      timezone: response.data.timezone || null,
      isDataCenter: this.isDataCenterIP(response.data),
      isProxy: response.data.threat || false,
      latitude: response.data.latitude || null,
      longitude: response.data.longitude || null,
      isp: response.data.org || 'Unknown',
      connectionType: this.getConnectionType(response.data),
      analysisTimestamp: new Date().toISOString()
    };

    console.log(`✅ IP analysis complete for ${ipAddress}: ${ipInfo.country}, ${ipInfo.organization}`);
    return ipInfo;
  }

  /**
   * Check if an IP address is valid
   * @param {string} ip - The IP address to validate
   * @returns {boolean} - Whether the IP is valid
   */
  isValidIP(ip) {
    if (!ip || typeof ip !== 'string') return false;
    
    // IPv4 regex
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    // IPv6 regex (simplified)
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Check if an IP address is private/local
   * @param {string} ip - The IP address to check
   * @returns {boolean} - Whether the IP is private
   */
  isPrivateIP(ip) {
    const privateRanges = [
      /^10\./,                    // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./,              // 192.168.0.0/16
      /^127\./,                   // 127.0.0.0/8 (localhost)
      /^169\.254\./,              // 169.254.0.0/16 (link-local)
      /^::1$/,                    // IPv6 localhost
      /^fe80:/,                   // IPv6 link-local
      /^fc00:/,                   // IPv6 unique local
      /^fd00:/                    // IPv6 unique local
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Determine if an IP belongs to a data center
   * @param {Object} ipData - The IP data from the API
   * @returns {boolean} - Whether the IP is from a data center
   */
  isDataCenterIP(ipData) {
    const datacenterIndicators = [
      'amazon', 'aws', 'google', 'microsoft', 'azure', 'cloudflare',
      'digitalocean', 'linode', 'vultr', 'hetzner', 'ovh',
      'datacenter', 'hosting', 'server', 'cloud', 'vps',
      'dedicated', 'colocation', 'colo', 'infrastructure'
    ];

    const org = (ipData.org || '').toLowerCase();
    const isp = (ipData.isp || '').toLowerCase();
    
    return datacenterIndicators.some(indicator => 
      org.includes(indicator) || isp.includes(indicator)
    );
  }

  /**
   * Determine connection type based on IP data
   * @param {Object} ipData - The IP data from the API
   * @returns {string} - The connection type
   */
  getConnectionType(ipData) {
    if (this.isDataCenterIP(ipData)) {
      return 'datacenter';
    }
    
    const org = (ipData.org || '').toLowerCase();
    
    if (org.includes('mobile') || org.includes('cellular')) {
      return 'mobile';
    }
    
    if (org.includes('broadband') || org.includes('cable') || org.includes('fiber')) {
      return 'broadband';
    }
    
    if (org.includes('satellite')) {
      return 'satellite';
    }
    
    return 'unknown';
  }

  /**
   * Get default IP info for invalid or failed lookups
   * @param {string} ipAddress - The IP address
   * @returns {Object} - Default IP information
   */
  getDefaultIPInfo(ipAddress) {
    return {
      ip: ipAddress,
      country: 'Unknown',
      countryCode: 'XX',
      region: 'Unknown',
      city: 'Unknown',
      organization: 'Unknown',
      asn: null,
      timezone: null,
      isDataCenter: false,
      isProxy: false,
      latitude: null,
      longitude: null,
      isp: 'Unknown',
      connectionType: 'unknown',
      analysisTimestamp: new Date().toISOString(),
      error: 'Analysis failed or invalid IP'
    };
  }

  /**
   * Get private IP info
   * @param {string} ipAddress - The private IP address
   * @returns {Object} - Private IP information
   */
  getPrivateIPInfo(ipAddress) {
    return {
      ip: ipAddress,
      country: 'Private Network',
      countryCode: 'XX',
      region: 'Private',
      city: 'Private',
      organization: 'Private Network',
      asn: null,
      timezone: null,
      isDataCenter: false,
      isProxy: false,
      latitude: null,
      longitude: null,
      isp: 'Private Network',
      connectionType: 'private',
      analysisTimestamp: new Date().toISOString(),
      isPrivate: true
    };
  }

  /**
   * Check if we can make another API request
   * @returns {boolean} - Whether we can make a request
   */
  canMakeRequest() {
    // Reset counter if it's a new day
    const now = Date.now();
    if (now - this.lastReset > 24 * 60 * 60 * 1000) {
      this.requestCount = 0;
      this.lastReset = now;
    }

    return this.requestCount < this.maxRequestsPerDay;
  }

  /**
   * Get current usage statistics
   * @returns {Object} - Usage statistics
   */
  getUsageStats() {
    return {
      requestCount: this.requestCount,
      maxRequests: this.maxRequestsPerDay,
      cacheSize: this.cache.size,
      hasApiKey: !!this.apiKey,
      lastReset: new Date(this.lastReset).toISOString()
    };
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 IP analysis cache cleared');
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
  }
}

// Create singleton instance
const ipAnalyzer = new IPAnalyzer();

// Clean cache periodically (every hour)
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    ipAnalyzer.cleanExpiredCache();
  }, 60 * 60 * 1000); // 1 hour
}

/**
 * Analyze an IP address (convenience function)
 * @param {string} ip - The IP address to analyze
 * @returns {Promise<Object>} - IP analysis results
 */
async function analyzeIP(ip) {
  return ipAnalyzer.analyzeIP(ip);
}

module.exports = {
  analyzeIP,
  ipAnalyzer,
  IPAnalyzer
};
