/**
 * Enhanced LLM Detection Service
 * 
 * This service provides additional detection methods for catching LLM activity
 * that might not use official bot user-agents, including web research features.
 */

const { LLM_SIGNATURES } = require('../config/llm-signatures');
const { analyzeIP } = require('./ipAnalyzer');

class EnhancedLLMDetector {
    constructor() {
        // Patterns that might indicate AI/LLM activity
        this.suspiciousPatterns = {
            userAgentPatterns: [
                // Headless browsers often used by AI services
                /headless/i,
                /phantom/i,
                /selenium/i,
                /puppeteer/i,
                /playwright/i,
                
                // Generic research patterns
                /research/i,
                /crawler/i,
                /scraper/i,
                /bot/i,
                /spider/i,
                
                // AI-related terms
                /artificial/i,
                /intelligence/i,
                /machine.learning/i,
                /neural/i,
                /gpt/i,
                /claude/i,
                /bard/i,
                
                // Automated tools
                /automated/i,
                /script/i,
                /tool/i,
                /agent/i
            ],
            
            // Suspicious request patterns
            requestPatterns: {
                // Very fast sequential requests
                rapidRequests: true,
                // Unusual referrer patterns
                suspiciousReferrers: [
                    /openai\.com/i,
                    /anthropic\.com/i,
                    /perplexity\.ai/i,
                    /claude\.ai/i,
                    /chatgpt\.com/i,
                    /bard\.google\.com/i,
                    /copilot\.microsoft\.com/i
                ],
                // Missing typical browser headers
                missingHeaders: ['accept-language', 'accept-encoding', 'cache-control']
            }
        };
        
        // Track request patterns for behavioral analysis
        this.requestHistory = new Map();
        this.cleanupInterval = setInterval(() => this.cleanupOldRequests(), 300000); // 5 minutes
    }

    /**
     * Enhanced detection that combines multiple signals
     */
    async detectLLMActivity(req) {
        const userAgent = req.get('User-Agent') || '';
        const clientIP = this.getClientIP(req);
        const referer = req.get('Referer') || '';
        const headers = req.headers;
        const url = req.originalUrl || req.url;
        
        const detectionResults = [];
        
        // 1. Standard bot detection (existing method)
        const standardDetection = await this.standardDetection(userAgent, clientIP);
        if (standardDetection) {
            detectionResults.push(standardDetection);
        }
        
        // 2. Suspicious user-agent patterns
        const userAgentDetection = this.detectSuspiciousUserAgent(userAgent);
        if (userAgentDetection) {
            detectionResults.push(userAgentDetection);
        }
        
        // 3. Referrer-based detection
        const referrerDetection = this.detectSuspiciousReferrer(referer);
        if (referrerDetection) {
            detectionResults.push(referrerDetection);
        }
        
        // 4. Header analysis
        const headerDetection = this.analyzeHeaders(headers);
        if (headerDetection) {
            detectionResults.push(headerDetection);
        }
        
        // 5. Behavioral pattern analysis
        const behaviorDetection = this.analyzeBehavior(clientIP, userAgent, url);
        if (behaviorDetection) {
            detectionResults.push(behaviorDetection);
        }
        
        // Return the highest confidence detection
        return this.selectBestDetection(detectionResults);
    }

    async standardDetection(userAgent, clientIP) {
        // Use existing detection logic
        const detector = require('./detector');
        return await detector.detectLLMCompany(userAgent, clientIP);
    }

    detectSuspiciousUserAgent(userAgent) {
        if (!userAgent) return null;
        
        for (const pattern of this.suspiciousPatterns.userAgentPatterns) {
            if (pattern.test(userAgent)) {
                return {
                    company: 'web_research',
                    companyName: 'Web Research Bots',
                    method: 'suspicious_user_agent',
                    confidence: 0.6,
                    details: `Suspicious user-agent pattern: ${pattern.source}`,
                    userAgent: userAgent
                };
            }
        }
        
        return null;
    }

    detectSuspiciousReferrer(referer) {
        if (!referer) return null;
        
        for (const pattern of this.suspiciousPatterns.requestPatterns.suspiciousReferrers) {
            if (pattern.test(referer)) {
                // Try to determine which LLM service based on referrer
                let company = 'misc_llm';
                let companyName = 'Other LLM';
                
                if (/openai|chatgpt/i.test(referer)) {
                    company = 'openai';
                    companyName = 'OpenAI';
                } else if (/anthropic|claude/i.test(referer)) {
                    company = 'anthropic';
                    companyName = 'Anthropic';
                } else if (/perplexity/i.test(referer)) {
                    company = 'perplexity';
                    companyName = 'Perplexity AI';
                } else if (/google|bard/i.test(referer)) {
                    company = 'google';
                    companyName = 'Google';
                } else if (/microsoft|copilot/i.test(referer)) {
                    company = 'microsoft';
                    companyName = 'Microsoft AI';
                }
                
                return {
                    company: company,
                    companyName: companyName,
                    method: 'suspicious_referrer',
                    confidence: 0.8,
                    details: `Suspicious referrer: ${referer}`
                };
            }
        }
        
        return null;
    }

    analyzeHeaders(headers) {
        const suspiciousIndicators = [];
        
        // Check for missing typical browser headers
        const missingHeaders = this.suspiciousPatterns.requestPatterns.missingHeaders.filter(
            header => !headers[header] && !headers[header.replace('-', '_')]
        );
        
        if (missingHeaders.length >= 2) {
            suspiciousIndicators.push(`Missing headers: ${missingHeaders.join(', ')}`);
        }
        
        // Check for unusual header combinations
        if (headers['user-agent'] && !headers['accept-language']) {
            suspiciousIndicators.push('Missing accept-language header');
        }
        
        // Check for automation-related headers
        const automationHeaders = ['x-requested-with', 'x-automation', 'x-bot'];
        for (const header of automationHeaders) {
            if (headers[header]) {
                suspiciousIndicators.push(`Automation header: ${header}`);
            }
        }
        
        if (suspiciousIndicators.length > 0) {
            return {
                company: 'web_research',
                companyName: 'Web Research Bots',
                method: 'header_analysis',
                confidence: 0.5,
                details: `Suspicious headers: ${suspiciousIndicators.join(', ')}`
            };
        }
        
        return null;
    }

    analyzeBehavior(clientIP, userAgent, url) {
        const key = `${clientIP}:${userAgent}`;
        const now = Date.now();
        
        if (!this.requestHistory.has(key)) {
            this.requestHistory.set(key, {
                requests: [],
                firstSeen: now,
                urls: new Set()
            });
        }
        
        const history = this.requestHistory.get(key);
        history.requests.push({ timestamp: now, url });
        history.urls.add(url);
        
        // Analyze patterns
        const recentRequests = history.requests.filter(req => now - req.timestamp < 60000); // Last minute
        
        // Check for rapid requests (more than 10 requests per minute)
        if (recentRequests.length > 10) {
            return {
                company: 'web_research',
                companyName: 'Web Research Bots',
                method: 'rapid_requests',
                confidence: 0.7,
                details: `${recentRequests.length} requests in last minute`
            };
        }
        
        // Check for systematic crawling (many different URLs)
        if (history.urls.size > 20) {
            return {
                company: 'web_research',
                companyName: 'Web Research Bots',
                method: 'systematic_crawling',
                confidence: 0.6,
                details: `Accessed ${history.urls.size} different URLs`
            };
        }
        
        return null;
    }

    selectBestDetection(detections) {
        if (detections.length === 0) return null;
        
        // Sort by confidence and return the best match
        detections.sort((a, b) => b.confidence - a.confidence);
        return detections[0];
    }

    getClientIP(req) {
        return req.ip || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null);
    }

    cleanupOldRequests() {
        const cutoff = Date.now() - 3600000; // 1 hour ago
        
        for (const [key, history] of this.requestHistory.entries()) {
            history.requests = history.requests.filter(req => req.timestamp > cutoff);
            
            if (history.requests.length === 0) {
                this.requestHistory.delete(key);
            }
        }
    }

    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

module.exports = new EnhancedLLMDetector();
