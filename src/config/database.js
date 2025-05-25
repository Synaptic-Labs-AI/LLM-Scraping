/**
 * Supabase Database Configuration
 * 
 * This file sets up the Supabase client for database operations.
 * It provides both regular and admin clients for different use cases.
 */

const { createClient } = require('@supabase/supabase-js');

// Validate required environment variables
if (!process.env.SUPABASE_URL) {
  throw new Error('🚨 Missing SUPABASE_URL environment variable');
}

if (!process.env.SUPABASE_ANON_KEY) {
  throw new Error('🚨 Missing SUPABASE_ANON_KEY environment variable');
}

// Create the main Supabase client (for general operations)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false, // We don't need session persistence for this app
      autoRefreshToken: false
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'User-Agent': 'LLM-Scraper-Tracker/1.0'
      }
    }
  }
);

// Create admin client for privileged operations (if service role key is available)
let supabaseAdmin = null;
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'User-Agent': 'LLM-Scraper-Tracker-Admin/1.0'
        }
      }
    }
  );
  console.log('✅ Supabase admin client initialized');
} else {
  console.log('⚠️  No service role key provided - admin operations will be limited');
}

/**
 * Test database connection
 * @returns {Promise<boolean>} - Whether the connection is successful
 */
async function testConnection() {
  try {
    const { data, error } = await supabase
      .from('llm_activity')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Database connection test failed:', error.message);
      return false;
    }
    
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection test error:', error.message);
    return false;
  }
}

/**
 * Get database health status
 * @returns {Promise<Object>} - Health status information
 */
async function getHealthStatus() {
  try {
    const startTime = Date.now();
    
    // Test basic query
    const { data, error } = await supabase
      .from('llm_activity')
      .select('count', { count: 'exact', head: true });
    
    const responseTime = Date.now() - startTime;
    
    if (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        responseTime: responseTime
      };
    }
    
    return {
      status: 'healthy',
      responseTime: responseTime,
      recordCount: data || 0
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      responseTime: null
    };
  }
}

/**
 * Execute a raw SQL query (admin only)
 * @param {string} query - The SQL query to execute
 * @returns {Promise<Object>} - Query result
 */
async function executeRawQuery(query) {
  if (!supabaseAdmin) {
    throw new Error('Admin client not available - service role key required');
  }
  
  try {
    const { data, error } = await supabaseAdmin.rpc('execute_sql', {
      query: query
    });
    
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('❌ Raw query execution failed:', error.message);
    throw error;
  }
}

/**
 * Get database statistics
 * @returns {Promise<Object>} - Database statistics
 */
async function getDatabaseStats() {
  try {
    const [activityCount, pageStatsCount, companyStatsCount] = await Promise.all([
      supabase.from('llm_activity').select('count', { count: 'exact', head: true }),
      supabase.from('page_scraping_stats').select('count', { count: 'exact', head: true }),
      supabase.from('llm_company_stats').select('count', { count: 'exact', head: true })
    ]);
    
    return {
      totalActivities: activityCount.count || 0,
      totalPages: pageStatsCount.count || 0,
      totalCompanyStats: companyStatsCount.count || 0,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Failed to get database stats:', error.message);
    return {
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Initialize connection test on startup
if (process.env.NODE_ENV !== 'test') {
  testConnection().then(success => {
    if (success) {
      console.log('🚀 Database ready for LLM tracking');
    } else {
      console.error('💥 Database connection failed - check your Supabase configuration');
    }
  });
}

module.exports = {
  supabase,
  supabaseAdmin,
  testConnection,
  getHealthStatus,
  executeRawQuery,
  getDatabaseStats
};
