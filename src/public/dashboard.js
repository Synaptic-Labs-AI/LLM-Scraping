/**
 * LLM Scraper Tracker Dashboard JavaScript
 * Handles all dashboard interactions, data loading, and real-time updates
 */

class LLMDashboard {
    constructor() {
        this.companyChart = null;
        this.trendChart = null;
        this.refreshInterval = 30000; // 30 seconds
        this.currentSection = 'overview';
        this.baseUrl = window.location.origin;
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing LLM Scraper Tracker Dashboard...');
        
        this.setupNavigation();
        this.setupEventListeners();
        await this.loadInitialData();
        this.startAutoRefresh();
        
        console.log('✅ Dashboard initialized successfully');
    }

    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        const sections = document.querySelectorAll('.dashboard-section');

        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetSection = button.dataset.section;
                
                // Update active nav button
                navButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update active section
                sections.forEach(section => section.classList.remove('active'));
                document.getElementById(targetSection).classList.add('active');
                
                this.currentSection = targetSection;
                this.loadSectionData(targetSection);
            });
        });
    }

    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refresh-activity');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadRecentActivity());
        }

        // Company filter
        const companyFilter = document.getElementById('company-filter');
        if (companyFilter) {
            companyFilter.addEventListener('change', () => this.loadRecentActivity());
        }

        // Test detection button
        const testBtn = document.getElementById('test-detection');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.testDetection());
        }

        // Test webhook button
        const webhookBtn = document.getElementById('test-webhook');
        if (webhookBtn) {
            webhookBtn.addEventListener('click', () => this.testWebhook());
        }
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadOverviewData(),
                this.loadSystemStatus(),
                this.setupWebhookInfo()
            ]);
        } catch (error) {
            console.error('❌ Failed to load initial data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    async loadSectionData(section) {
        switch (section) {
            case 'overview':
                await this.loadOverviewData();
                break;
            case 'activity':
                await this.loadRecentActivity();
                break;
            case 'companies':
                await this.loadCompaniesData();
                break;
            case 'guidance':
                await this.loadGuidanceData();
                break;
            case 'system':
                await this.loadSystemStatus();
                break;
            case 'test':
                this.setupTestSection();
                break;
        }
    }

    async loadOverviewData() {
        try {
            const [statsResponse, healthResponse] = await Promise.all([
                fetch(`${this.baseUrl}/api/stats`),
                fetch(`${this.baseUrl}/health`)
            ]);

            if (!statsResponse.ok) throw new Error('Failed to fetch stats');
            if (!healthResponse.ok) throw new Error('Failed to fetch health');

            const stats = await statsResponse.json();
            const health = await healthResponse.json();

            this.updateOverviewStats(stats, health);
            this.updateCharts(stats);
            this.updateLastUpdated();

        } catch (error) {
            console.error('❌ Failed to load overview data:', error);
            this.showError('Failed to load overview data');
        }
    }

    updateOverviewStats(stats, health) {
        // Update stat cards
        document.getElementById('total-activities').textContent = stats.summary?.totalActivities || '0';
        document.getElementById('unique-companies').textContent = Object.keys(stats.summary?.companyCounts || {}).length;
        document.getElementById('guidance-rate').textContent = stats.summary?.guidedPathRate + '%' || '0%';
        
        // Update uptime
        if (health.uptime) {
            const hours = Math.floor(health.uptime / 3600);
            document.getElementById('system-uptime').textContent = hours + 'h';
        }
    }

    updateCharts(stats) {
        this.updateCompanyChart(stats.summary?.companyCounts || {});
        this.updateTrendChart(stats.dailyTrend || []);
    }

    updateCompanyChart(companyCounts) {
        const ctx = document.getElementById('company-chart');
        if (!ctx) return;

        if (this.companyChart) {
            this.companyChart.destroy();
        }

        const companies = Object.keys(companyCounts);
        const counts = Object.values(companyCounts);
        const colors = [
            '#10a37f', '#d97706', '#4285f4', '#8b5cf6', '#1877f2',
            '#00a1f1', '#007aff', '#ff9900', '#39c5bb', '#fe2c55', '#6b7280'
        ];

        this.companyChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: companies.map(c => this.formatCompanyName(c)),
                datasets: [{
                    data: counts,
                    backgroundColor: colors.slice(0, companies.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    updateTrendChart(dailyData) {
        const ctx = document.getElementById('trend-chart');
        if (!ctx) return;

        if (this.trendChart) {
            this.trendChart.destroy();
        }

        // Group data by date
        const dateGroups = {};
        dailyData.forEach(item => {
            if (!dateGroups[item.date]) {
                dateGroups[item.date] = 0;
            }
            dateGroups[item.date] += item.total || 0;
        });

        const dates = Object.keys(dateGroups).sort();
        const values = dates.map(date => dateGroups[date]);

        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates.map(date => new Date(date).toLocaleDateString()),
                datasets: [{
                    label: 'Daily Requests',
                    data: values,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    async loadRecentActivity() {
        try {
            const companyFilter = document.getElementById('company-filter')?.value || 'all';
            const url = companyFilter === 'all' 
                ? `${this.baseUrl}/api/activity?limit=50`
                : `${this.baseUrl}/api/activity?limit=50&company=${companyFilter}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch activity');

            const data = await response.json();
            this.updateActivityTable(data.data || []);
            this.updateCompanyFilter(data.data || []);

        } catch (error) {
            console.error('❌ Failed to load recent activity:', error);
            this.showError('Failed to load activity data');
        }
    }

    updateActivityTable(activities) {
        const tbody = document.querySelector('#activity-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (activities.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No activity data available</td></tr>';
            return;
        }

        activities.forEach(activity => {
            const row = document.createElement('tr');
            const time = new Date(activity.timestamp).toLocaleString();
            const company = this.formatCompanyName(activity.llm_company);
            const page = this.truncateText(activity.page_visited, 50);
            const method = activity.detection_method;
            const guided = activity.is_guided_path ? '✅' : '❌';
            const country = activity.country || 'Unknown';

            row.innerHTML = `
                <td>${time}</td>
                <td><span class="company-badge company-${activity.llm_company}">${company}</span></td>
                <td title="${activity.page_visited}">${page}</td>
                <td>${method}</td>
                <td>${guided}</td>
                <td>${country}</td>
            `;
            tbody.appendChild(row);
        });
    }

    updateCompanyFilter(activities) {
        const filter = document.getElementById('company-filter');
        if (!filter) return;

        const companies = [...new Set(activities.map(a => a.llm_company))];
        const currentValue = filter.value;

        filter.innerHTML = '<option value="all">All Companies</option>';
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company;
            option.textContent = this.formatCompanyName(company);
            filter.appendChild(option);
        });

        filter.value = currentValue;
    }

    async loadCompaniesData() {
        try {
            const response = await fetch(`${this.baseUrl}/api/stats`);
            if (!response.ok) throw new Error('Failed to fetch companies data');

            const data = await response.json();
            this.updateCompaniesGrid(data.summary?.companyCounts || {});

        } catch (error) {
            console.error('❌ Failed to load companies data:', error);
            this.showError('Failed to load companies data');
        }
    }

    updateCompaniesGrid(companyCounts) {
        const grid = document.getElementById('companies-grid');
        if (!grid) return;

        grid.innerHTML = '';

        if (Object.keys(companyCounts).length === 0) {
            grid.innerHTML = '<div class="loading-card">No company data available</div>';
            return;
        }

        Object.entries(companyCounts).forEach(([company, count]) => {
            const card = document.createElement('div');
            card.className = 'company-card';
            card.innerHTML = `
                <h4><span class="company-badge company-${company}">${this.formatCompanyName(company)}</span></h4>
                <div class="company-stats">
                    <div class="company-stat">
                        <span class="number">${count}</span>
                        <span class="label">Total Requests</span>
                    </div>
                    <div class="company-stat">
                        <span class="number">-</span>
                        <span class="label">Last Seen</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    async loadGuidanceData() {
        try {
            const [statsResponse, guidanceResponse] = await Promise.all([
                fetch(`${this.baseUrl}/api/stats`),
                fetch(`${this.baseUrl}/api/guidance`)
            ]);

            if (!statsResponse.ok) throw new Error('Failed to fetch stats');
            
            const stats = await statsResponse.json();
            let guidance = { guidanceRate: '0' };
            
            if (guidanceResponse.ok) {
                guidance = await guidanceResponse.json();
            }

            this.updateGuidanceStats(guidance);
            this.updatePagesTable(stats.topPages || []);

        } catch (error) {
            console.error('❌ Failed to load guidance data:', error);
            this.showError('Failed to load guidance data');
        }
    }

    updateGuidanceStats(guidance) {
        document.getElementById('guided-rate').textContent = guidance.guidanceRate + '%';
        // Add more guidance stats as needed
    }

    updatePagesTable(pages) {
        const tbody = document.querySelector('#pages-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (pages.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No page data available</td></tr>';
            return;
        }

        pages.slice(0, 20).forEach(page => {
            const row = document.createElement('tr');
            const url = this.truncateText(page.page_url || page.url, 60);
            const scrapes = page.scrape_count || 0;
            const companies = 1; // Simplified for now
            const guided = this.isGuidedPath(page.page_url || page.url) ? '✅' : '❌';
            const lastScraped = new Date(page.last_scraped).toLocaleDateString();

            row.innerHTML = `
                <td title="${page.page_url || page.url}">${url}</td>
                <td>${scrapes}</td>
                <td>${companies}</td>
                <td>${guided}</td>
                <td>${lastScraped}</td>
            `;
            tbody.appendChild(row);
        });
    }

    async loadSystemStatus() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            const health = await response.json();

            this.updateSystemStatus(health);

        } catch (error) {
            console.error('❌ Failed to load system status:', error);
            this.showError('Failed to load system status');
        }
    }

    updateSystemStatus(health) {
        const dbStatus = document.getElementById('db-status');
        if (dbStatus) {
            if (health.database?.status === 'healthy') {
                dbStatus.innerHTML = '<span class="success">✅ Connected</span>';
            } else {
                dbStatus.innerHTML = '<span class="error">❌ Disconnected</span>';
            }
        }
    }

    setupTestSection() {
        this.setupWebhookInfo();
    }

    setupWebhookInfo() {
        const webhookUrl = document.getElementById('webhook-url');
        if (webhookUrl) {
            webhookUrl.textContent = `${this.baseUrl}/webhook/track`;
        }
    }

    async testDetection() {
        const userAgent = document.getElementById('test-user-agent')?.value;
        const url = document.getElementById('test-url')?.value;
        const resultsDiv = document.getElementById('test-results');

        if (!userAgent || !url) {
            resultsDiv.textContent = 'Please enter both User-Agent and URL';
            return;
        }

        try {
            const response = await fetch(`${this.baseUrl}/webhook/track`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url,
                    userAgent: userAgent,
                    referrer: 'https://test.example.com',
                    timestamp: new Date().toISOString()
                })
            });

            const result = await response.json();
            resultsDiv.textContent = JSON.stringify(result, null, 2);

        } catch (error) {
            resultsDiv.textContent = `Error: ${error.message}`;
        }
    }

    async testWebhook() {
        const resultsDiv = document.getElementById('webhook-results');

        try {
            const response = await fetch(`${this.baseUrl}/webhook/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    test: true,
                    timestamp: new Date().toISOString()
                })
            });

            const result = await response.json();
            resultsDiv.textContent = JSON.stringify(result, null, 2);

        } catch (error) {
            resultsDiv.textContent = `Error: ${error.message}`;
        }
    }

    startAutoRefresh() {
        setInterval(() => {
            if (this.currentSection === 'overview') {
                this.loadOverviewData();
            } else if (this.currentSection === 'activity') {
                this.loadRecentActivity();
            }
            this.updateLastUpdated();
        }, this.refreshInterval);
    }

    updateLastUpdated() {
        const updateTime = document.getElementById('update-time');
        if (updateTime) {
            updateTime.textContent = new Date().toLocaleTimeString();
        }
    }

    // Utility functions
    formatCompanyName(company) {
        const names = {
            'openai': 'OpenAI',
            'anthropic': 'Anthropic',
            'google': 'Google',
            'perplexity': 'Perplexity AI',
            'meta': 'Meta AI',
            'microsoft': 'Microsoft AI',
            'apple': 'Apple AI',
            'amazon': 'Amazon AI',
            'cohere': 'Cohere AI',
            'bytedance': 'ByteDance AI',
            'misc_llm': 'Other LLM'
        };
        return names[company] || company.charAt(0).toUpperCase() + company.slice(1);
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    isGuidedPath(path) {
        const guidedPaths = [
            '/about', '/flows', '/agents', '/chatbot', '/ai-education', '/bootcamps',
            '/blog/', '/case-studies/', '/research/', '/ai-tools/', '/solutions/',
            '/resources/', '/documentation/', '/whitepapers/', '/tutorials/',
            '/best-practices/', '/insights/', '/reports/'
        ];
        return guidedPaths.some(guidedPath => 
            path.toLowerCase().startsWith(guidedPath.toLowerCase())
        );
    }

    showError(message) {
        console.error('Dashboard Error:', message);
        // Could add toast notifications here
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new LLMDashboard();
});
