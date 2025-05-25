/**
 * Activity Logger Service
 * 
 * This service handles logging LLM scraper activity to the database.
 * It manages the main activity table and updates aggregated statistics.
 */

const { supabase } = require('../config/database');

class ActivityLogger {
  constructor() {
    this.logQueue = [];
    this.isProcessing = false;
    this.batchSize = 10;
    this.flushInterval = 5000; // 5 seconds
    this.stats = {
      totalLogged: 0,
      successCount: 0,
      errorCount: 0,
      lastError: null
    };

    // Start batch processing
    this.startBatchProcessing();
  }

  /**
   * Log LLM activity to the database
   * @param {Object} data - Activity data to log
   * @returns {Promise<boolean>} - Success status
   */
  async logLLMActivity(data) {
    try {
      const activityData = this.prepareActivityData(data);
      
      // Add to queue for batch processing
      this.logQueue.push(activityData);
      
      // If queue is full, process immediately
      if (this.logQueue.length >= this.batchSize) {
        await this.processBatch();
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to queue activity for logging:', error.message);
      this.stats.errorCount++;
      this.stats.lastError = error.message;
      return false;
    }
  }

  /**
   * Prepare activity data for database insertion
   * @param {Object} data - Raw activity data
   * @returns {Object} - Formatted activity data
   */
  prepareActivityData(data) {
    return {
      timestamp: data.timestamp || new Date().toISOString(),
      llm_company: data.company,
      user_agent: data.userAgent ? data.userAgent.substring(0, 1000) : null, // Limit length
      ip_address: data.ipAddress,
      page_visited: data.pageVisited,
      referer: data.referer ? data.referer.substring(0, 1000) : null, // Limit length
      detection_method: data.detectionMethod,
      country: data.country || null,
      asn: data.asn || null,
      organization: data.organization ? data.organization.substring(0, 500) : null, // Limit length
      is_guided_path: data.isGuidedPath || false,
      session_id: data.sessionId || null
    };
  }

  /**
   * Start batch processing of log queue
   */
  startBatchProcessing() {
    setInterval(async () => {
      if (this.logQueue.length > 0 && !this.isProcessing) {
        await this.processBatch();
      }
    }, this.flushInterval);

    console.log(`📝 Activity logger started with batch size ${this.batchSize} and ${this.flushInterval}ms interval`);
  }

  /**
   * Process a batch of log entries
   */
  async processBatch() {
    if (this.isProcessing || this.logQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const batch = this.logQueue.splice(0, this.batchSize);

    try {
      console.log(`📝 Processing batch of ${batch.length} activity logs`);

      // Insert batch to database
      const { error: insertError } = await supabase
        .from('llm_activity')
        .insert(batch);

      if (insertError) {
        console.error('❌ Batch insert failed:', insertError.message);
        this.stats.errorCount += batch.length;
        this.stats.lastError = insertError.message;
        
        // Re-queue failed items (with limit to prevent infinite loops)
        if (this.logQueue.length < 100) {
          this.logQueue.unshift(...batch);
        }
      } else {
        console.log(`✅ Successfully logged ${batch.length} activities`);
        this.stats.successCount += batch.length;
        this.stats.totalLogged += batch.length;

        // Update aggregated statistics for each activity
        for (const activity of batch) {
          await this.updateAggregatedStats(activity);
        }
      }
    } catch (error) {
      console.error('❌ Batch processing error:', error.message);
      this.stats.errorCount += batch.length;
      this.stats.lastError = error.message;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Update aggregated statistics tables
   * @param {Object} activity - Activity data
   */
  async updateAggregatedStats(activity) {
    try {
      // Update page scraping stats
      await this.updatePageStats(activity.page_visited, activity.llm_company);

      // Update daily company stats
      await this.updateCompanyStats(activity.llm_company, activity.ip_address);
    } catch (error) {
      console.error('❌ Failed to update aggregated stats:', error.message);
    }
  }

  /**
   * Update page scraping statistics
   * @param {string} pageUrl - The page URL
   * @param {string} company - The LLM company
   */
  async updatePageStats(pageUrl, company) {
    try {
      // Use upsert to handle both insert and update
      const { error } = await supabase
        .from('page_scraping_stats')
        .upsert({
          page_url: pageUrl,
          llm_company: company,
          scrape_count: 1,
          first_scraped: new Date().toISOString(),
          last_scraped: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'page_url,llm_company',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('❌ Failed to update page stats:', error.message);
      }
    } catch (error) {
      console.error('❌ Page stats update error:', error.message);
    }
  }

  /**
   * Update daily company statistics
   * @param {string} company - The LLM company
   * @param {string} ipAddress - The IP address
   */
  async updateCompanyStats(company, ipAddress) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Use upsert for company stats
      const { error } = await supabase
        .from('llm_company_stats')
        .upsert({
          company: company,
          date: today,
          total_requests: 1,
          unique_pages: 1,
          unique_ips: 1,
          last_activity: new Date().toISOString()
        }, {
          onConflict: 'company,date',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('❌ Failed to update company stats:', error.message);
      }
    } catch (error) {
      console.error('❌ Company stats update error:', error.message);
    }
  }

  /**
   * Log a single activity immediately (bypass queue)
   * @param {Object} data - Activity data
   * @returns {Promise<boolean>} - Success status
   */
  async logActivityImmediate(data) {
    try {
      const activityData = this.prepareActivityData(data);

      console.log(`📝 Logging immediate activity: ${activityData.llm_company} -> ${activityData.page_visited}`);

      const { error } = await supabase
        .from('llm_activity')
        .insert([activityData]);

      if (error) {
        console.error('❌ Immediate logging failed:', error.message);
        this.stats.errorCount++;
        this.stats.lastError = error.message;
        return false;
      }

      console.log(`✅ Activity logged immediately`);
      this.stats.successCount++;
      this.stats.totalLogged++;

      // Update aggregated stats
      await this.updateAggregatedStats(activityData);

      return true;
    } catch (error) {
      console.error('❌ Immediate logging error:', error.message);
      this.stats.errorCount++;
      this.stats.lastError = error.message;
      return false;
    }
  }

  /**
   * Get recent activity from database
   * @param {number} limit - Number of records to fetch
   * @param {string} company - Filter by company (optional)
   * @returns {Promise<Array>} - Recent activity records
   */
  async getRecentActivity(limit = 50, company = null) {
    try {
      let query = supabase
        .from('llm_activity')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (company) {
        query = query.eq('llm_company', company);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Failed to fetch recent activity:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Recent activity fetch error:', error.message);
      return [];
    }
  }

  /**
   * Get activity statistics
   * @param {number} days - Number of days to analyze
   * @returns {Promise<Object>} - Activity statistics
   */
  async getActivityStats(days = 7) {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      // Get total activity count
      const { count: totalCount, error: countError } = await supabase
        .from('llm_activity')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', startDate);

      if (countError) {
        console.error('❌ Failed to get activity count:', countError.message);
        return { error: countError.message };
      }

      // Get company breakdown
      const { data: companyData, error: companyError } = await supabase
        .from('llm_activity')
        .select('llm_company')
        .gte('timestamp', startDate);

      if (companyError) {
        console.error('❌ Failed to get company data:', companyError.message);
        return { error: companyError.message };
      }

      // Count by company
      const companyCounts = {};
      companyData.forEach(item => {
        companyCounts[item.llm_company] = (companyCounts[item.llm_company] || 0) + 1;
      });

      return {
        totalActivities: totalCount || 0,
        companyCounts,
        timeframe: `${days} days`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Activity stats error:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Get logger statistics
   * @returns {Object} - Logger performance statistics
   */
  getLoggerStats() {
    return {
      ...this.stats,
      queueSize: this.logQueue.length,
      isProcessing: this.isProcessing,
      batchSize: this.batchSize,
      flushInterval: this.flushInterval,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Flush all pending logs immediately
   * @returns {Promise<void>}
   */
  async flush() {
    console.log('🚀 Flushing all pending logs...');
    
    while (this.logQueue.length > 0 && !this.isProcessing) {
      await this.processBatch();
    }
    
    console.log('✅ All logs flushed');
  }

  /**
   * Reset logger statistics
   */
  resetStats() {
    this.stats = {
      totalLogged: 0,
      successCount: 0,
      errorCount: 0,
      lastError: null
    };
    console.log('📊 Logger statistics reset');
  }

  /**
   * Test logging functionality
   * @returns {Promise<Object>} - Test results
   */
  async testLogging() {
    console.log('🧪 Testing activity logging...');

    const testActivity = {
      company: 'openai',
      userAgent: 'GPTBot/1.0 (Test)',
      ipAddress: '127.0.0.1',
      pageVisited: '/test-page',
      detectionMethod: 'user_agent',
      isGuidedPath: true
    };

    try {
      const success = await this.logActivityImmediate(testActivity);
      
      if (success) {
        console.log('✅ Logging test passed');
        return { success: true, message: 'Test activity logged successfully' };
      } else {
        console.log('❌ Logging test failed');
        return { success: false, message: 'Failed to log test activity' };
      }
    } catch (error) {
      console.log('❌ Logging test error:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const activityLogger = new ActivityLogger();

module.exports = activityLogger;
