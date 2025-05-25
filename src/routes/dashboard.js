/**
 * Dashboard Routes for LLM Scraper Tracker
 * 
 * This file contains routes for serving the analytics dashboard
 * and dashboard-specific API endpoints.
 */

const express = require('express');
const path = require('path');

const router = express.Router();

/**
 * GET /dashboard
 * Serve the main dashboard HTML page
 */
router.get('/', (req, res) => {
  // For now, send a simple HTML page since we haven't created the full dashboard yet
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LLM Scraper Tracker Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        h1 {
            color: #667eea;
            text-align: center;
            margin-bottom: 30px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }
        .stat-number {
            font-size: 2rem;
            font-weight: bold;
            color: #667eea;
            display: block;
        }
        .api-links {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-top: 20px;
        }
        .api-links h3 {
            margin-top: 0;
        }
        .api-links a {
            display: inline-block;
            margin: 5px 10px 5px 0;
            padding: 8px 16px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-size: 14px;
        }
        .api-links a:hover {
            background: #5a6fd8;
        }
        .status {
            text-align: center;
            margin: 20px 0;
        }
        .status.online {
            color: #28a745;
        }
        .loading {
            text-align: center;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 LLM Scraper Tracker Dashboard</h1>
        
        <div class="status online">
            <strong>✅ System Online</strong>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total Activities</h3>
                <span class="stat-number" id="total-activities">Loading...</span>
                <small>Last 7 days</small>
            </div>
            <div class="stat-card">
                <h3>Unique Companies</h3>
                <span class="stat-number" id="unique-companies">Loading...</span>
                <small>Active scrapers</small>
            </div>
            <div class="stat-card">
                <h3>Guidance Rate</h3>
                <span class="stat-number" id="guidance-rate">Loading...</span>
                <small>Following guided paths</small>
            </div>
            <div class="stat-card">
                <h3>System Uptime</h3>
                <span class="stat-number" id="uptime">Loading...</span>
                <small>Hours online</small>
            </div>
        </div>

        <div class="api-links">
            <h3>📊 API Endpoints</h3>
            <a href="/api/stats" target="_blank">Statistics</a>
            <a href="/api/activity" target="_blank">Recent Activity</a>
            <a href="/api/companies" target="_blank">Companies</a>
            <a href="/api/guidance" target="_blank">Guidance Metrics</a>
            <a href="/api/system" target="_blank">System Status</a>
            <a href="/health" target="_blank">Health Check</a>
        </div>

        <div class="api-links">
            <h3>🔧 Test Endpoints</h3>
            <a href="#" onclick="testDetection()">Test Detection</a>
            <a href="/webhook/status" target="_blank">Webhook Status</a>
            <a href="#" onclick="runSystemTest()">System Test</a>
        </div>

        <div id="test-results" style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; display: none;">
            <h4>Test Results:</h4>
            <pre id="test-output"></pre>
        </div>
    </div>

    <script>
        // Load dashboard data
        async function loadDashboardData() {
            try {
                // Load stats
                const statsResponse = await fetch('/api/stats');
                const stats = await statsResponse.json();
                
                document.getElementById('total-activities').textContent = stats.summary.totalActivities;
                document.getElementById('unique-companies').textContent = Object.keys(stats.summary.companyCounts).length;
                document.getElementById('guidance-rate').textContent = stats.summary.guidedPathRate + '%';

                // Load system info
                const systemResponse = await fetch('/api/system');
                const system = await systemResponse.json();
                
                const uptimeHours = Math.floor(system.uptime / 3600);
                document.getElementById('uptime').textContent = uptimeHours + 'h';

            } catch (error) {
                console.error('Failed to load dashboard data:', error);
                document.querySelectorAll('.stat-number').forEach(el => {
                    el.textContent = 'Error';
                    el.style.color = '#dc3545';
                });
            }
        }

        // Test detection function
        async function testDetection() {
            const testCases = [
                { userAgent: 'GPTBot/1.0 (+https://openai.com/gptbot)', expected: 'OpenAI' },
                { userAgent: 'ClaudeBot/1.0 (+https://www.anthropic.com/claude-bot)', expected: 'Anthropic' },
                { userAgent: 'Mozilla/5.0 (compatible; Google-Extended)', expected: 'Google' },
                { userAgent: 'PerplexityBot/1.0 (+https://perplexity.ai/bot)', expected: 'Perplexity AI' }
            ];

            const results = [];
            
            for (const testCase of testCases) {
                try {
                    const response = await fetch('/api/test', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userAgent: testCase.userAgent })
                    });
                    const result = await response.json();
                    
                    results.push({
                        userAgent: testCase.userAgent,
                        expected: testCase.expected,
                        detected: result.detection?.companyName || 'None',
                        success: result.detection?.companyName === testCase.expected
                    });
                } catch (error) {
                    results.push({
                        userAgent: testCase.userAgent,
                        expected: testCase.expected,
                        detected: 'Error',
                        success: false,
                        error: error.message
                    });
                }
            }

            showTestResults('Detection Test Results', results);
        }

        // Run system test
        async function runSystemTest() {
            try {
                const [healthResponse, systemResponse] = await Promise.all([
                    fetch('/health'),
                    fetch('/api/system')
                ]);

                const health = await healthResponse.json();
                const system = await systemResponse.json();

                const results = {
                    health: health.status,
                    database: health.database?.status || 'unknown',
                    uptime: Math.floor(system.uptime / 60) + ' minutes',
                    memory: Math.floor(system.memory.heapUsed / 1024 / 1024) + ' MB',
                    environment: system.environment
                };

                showTestResults('System Test Results', results);
            } catch (error) {
                showTestResults('System Test Results', { error: error.message });
            }
        }

        // Show test results
        function showTestResults(title, results) {
            const resultsDiv = document.getElementById('test-results');
            const outputPre = document.getElementById('test-output');
            
            outputPre.textContent = title + '\\n\\n' + JSON.stringify(results, null, 2);
            resultsDiv.style.display = 'block';
            resultsDiv.scrollIntoView({ behavior: 'smooth' });
        }

        // Load data on page load
        loadDashboardData();

        // Refresh data every 30 seconds
        setInterval(loadDashboardData, 30000);
    </script>
</body>
</html>
  `);
});

/**
 * GET /dashboard/data
 * Get dashboard-specific data (redirect to API for now)
 */
router.get('/data', (req, res) => {
  res.redirect('/api/stats');
});

/**
 * GET /dashboard/health
 * Dashboard health check
 */
router.get('/health', async (req, res) => {
  try {
    res.json({
      dashboard: 'healthy',
      timestamp: new Date().toISOString(),
      endpoints: {
        main: '/dashboard',
        data: '/dashboard/data',
        health: '/dashboard/health'
      }
    });
  } catch (error) {
    res.status(500).json({
      dashboard: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
