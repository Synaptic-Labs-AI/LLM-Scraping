/**
 * API Routes for LLM Scraper Tracker
 * 
 * This file contains all the API endpoints for retrieving analytics,
 * statistics, and activity data from the LLM scraper tracking system.
 */

const express = require('express');
const { supabase } = require('../config/database');
const detector = require('../services/detector');
const logger = require('../services/logger');
const { ipAnalyzer } = require('../services/ipAnalyzer');
const { getTrackingStats } = require('../middleware/tracker');
const { getAllCompanies, getCompanyDisplayName } = require('../config/llm-signatures');

const router = express.Router();

// Middleware to add API headers
router.use((req, res, next) => {
  res.set({
    'X-API-Version': '1.0.0',
    'X-Service': 'LLM-Scraper-Tracker'
  });
  next();
});

/**
 * GET /api/activity
 * Get recent LLM scraper activity
 */
router.get('/activity', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000); // Max 1000
    const offset = parseInt(req.query.offset) || 0;
    const company = req.query.company;
    const days = parseInt(req.query.days) || 7;
    
    // Calculate date filter
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    let query = supabase
      .from('llm_activity')
      .select('*')
      .gte('timestamp', startDate)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (company && getAllCompanies().includes(company)) {
      query = query.eq('llm_company', company);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Failed to fetch activity:', error.message);
      return res.status(500).json({ 
        error: 'Failed to fetch activity data',
        details: error.message 
      });
    }

    // Transform data for better readability
    const transformedData = data.map(activity => ({
      ...activity,
      companyDisplayName: getCompanyDisplayName(activity.llm_company),
      timeAgo: getTimeAgo(activity.timestamp)
    }));

    res.json({
      data: transformedData,
      pagination: {
        limit,
        offset,
        total: data.length,
        hasMore: data.length === limit
      },
      filters: {
        company: company || 'all',
        days
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Activity API error:', error.message);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * GET /api/stats
 * Get comprehensive statistics about LLM scraper activity
 */
router.get('/stats', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 365); // Max 1 year
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Get total activities by company
    const { data: companyData, error: companyError } = await supabase
      .from('llm_activity')
      .select('llm_company, timestamp, is_guided_path')
      .gte('timestamp', startDate);

    if (companyError) {
      throw companyError;
    }

    // Count by company
    const companyCounts = {};
    let totalGuided = 0;
    let totalActivities = companyData.length;

    companyData.forEach(item => {
      companyCounts[item.llm_company] = (companyCounts[item.llm_company] || 0) + 1;
      if (item.is_guided_path) totalGuided++;
    });

    // Get top scraped pages
    const { data: pageStats, error: pageError } = await supabase
      .from('page_scraping_stats')
      .select('*')
      .order('scrape_count', { ascending: false })
      .limit(20);

    if (pageError) {
      throw pageError;
    }

    // Get daily activity trend
    const { data: dailyStats, error: dailyError } = await supabase
      .from('llm_company_stats')
      .select('*')
      .gte('date', startDate.split('T')[0])
      .order('date', { ascending: true });

    if (dailyError) {
      throw dailyError;
    }

    // Process daily trend data
    const dailyTrend = {};
    dailyStats.forEach(stat => {
      if (!dailyTrend[stat.date]) {
        dailyTrend[stat.date] = { date: stat.date, total: 0, companies: {} };
      }
      dailyTrend[stat.date].total += stat.total_requests;
      dailyTrend[stat.date].companies[stat.company] = stat.total_requests;
    });

    // Get unique metrics
    const { data: uniqueMetrics, error: uniqueError } = await supabase
      .from('llm_activity')
      .select('ip_address, page_visited')
      .gte('timestamp', startDate);

    if (uniqueError) {
      throw uniqueError;
    }

    const uniqueIPs = new Set(uniqueMetrics.map(m => m.ip_address)).size;
    const uniquePages = new Set(uniqueMetrics.map(m => m.page_visited)).size;

    res.json({
      summary: {
        totalActivities,
        uniqueIPs,
        uniquePages,
        guidedPathRate: totalActivities > 0 ? ((totalGuided / totalActivities) * 100).toFixed(2) : 0,
        companyCounts: Object.fromEntries(
          Object.entries(companyCounts).map(([key, value]) => [
            getCompanyDisplayName(key), value
          ])
        ),
        timeframe: `${days} days`
      },
      topPages: pageStats.map(page => ({
        ...page,
        url: page.page_url,
        companyDisplayName: getCompanyDisplayName(page.llm_company)
      })),
      dailyTrend: Object.values(dailyTrend),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Stats API error:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      message: error.message 
    });
  }
});

/**
 * GET /api/companies
 * Get list of all tracked LLM companies
 */
router.get('/companies', (req, res) => {
  try {
    const companies = getAllCompanies().map(company => ({
      key: company,
      name: getCompanyDisplayName(company),
      description: `${getCompanyDisplayName(company)} scraper activity`
    }));

    res.json({
      companies,
      total: companies.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Companies API error:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch companies',
      message: error.message 
    });
  }
});

/**
 * GET /api/guidance
 * Get guided path effectiveness metrics
 */
router.get('/guidance', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('llm_activity')
      .select('page_visited, is_guided_path, llm_company, timestamp')
      .gte('timestamp', startDate);

    if (error) {
      throw error;
    }

    const total = data.length;
    const guided = data.filter(item => item.is_guided_path).length;
    const unguided = total - guided;

    // Breakdown by company
    const companyBreakdown = {};
    data.forEach(item => {
      if (!companyBreakdown[item.llm_company]) {
        companyBreakdown[item.llm_company] = { total: 0, guided: 0 };
      }
      companyBreakdown[item.llm_company].total++;
      if (item.is_guided_path) {
        companyBreakdown[item.llm_company].guided++;
      }
    });

    // Calculate rates for each company
    Object.keys(companyBreakdown).forEach(company => {
      const stats = companyBreakdown[company];
      stats.guidanceRate = stats.total > 0 ? ((stats.guided / stats.total) * 100).toFixed(2) : 0;
      stats.companyDisplayName = getCompanyDisplayName(company);
    });

    res.json({
      summary: {
        total,
        guided,
        unguided,
        guidanceRate: total > 0 ? ((guided / total) * 100).toFixed(2) : 0,
        timeframe: `${days} days`
      },
      companyBreakdown,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Guidance API error:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch guidance metrics',
      message: error.message 
    });
  }
});

/**
 * GET /api/system
 * Get system status and performance metrics
 */
router.get('/system', async (req, res) => {
  try {
    const trackingStats = getTrackingStats();
    const ipAnalyzerStats = ipAnalyzer.getUsageStats();

    res.json({
      service: 'LLM Scraper Tracker',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      tracking: trackingStats,
      ipAnalyzer: ipAnalyzerStats,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ System API error:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch system status',
      message: error.message 
    });
  }
});

/**
 * POST /api/test
 * Test the detection system with custom User-Agent and IP
 */
router.post('/test', async (req, res) => {
  try {
    const { userAgent, ipAddress } = req.body;

    if (!userAgent) {
      return res.status(400).json({
        error: 'Missing required field: userAgent'
      });
    }

    const testIP = ipAddress || req.ip || '127.0.0.1';
    
    // Run detection
    const detection = await detector.detectLLMCompany(userAgent, testIP);

    res.json({
      input: {
        userAgent,
        ipAddress: testIP
      },
      detection: detection ? {
        company: detection.company,
        companyName: detection.companyName,
        method: detection.method,
        confidence: detection.confidence,
        details: detection.details
      } : null,
      detected: !!detection,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Test API error:', error.message);
    res.status(500).json({ 
      error: 'Test failed',
      message: error.message 
    });
  }
});

/**
 * Helper function to calculate time ago
 */
function getTimeAgo(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

module.exports = router;
