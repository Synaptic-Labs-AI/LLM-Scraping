# LLM Scraper Tracker

A comprehensive system to track when major LLM companies (OpenAI, Google, Anthropic, Perplexity) scrape the Synapticlabs.ai website. The system logs scraper activity, analyzes patterns, and provides analytics through a web dashboard.

## 🚀 Features

- **Multi-layered Detection**: Identifies LLM scrapers using User-Agent strings, IP ranges, ASN analysis, and reverse DNS verification
- **Real-time Tracking**: Logs all scraper interactions with detailed metadata
- **Analytics Dashboard**: Web-based dashboard showing scraping patterns and trends
- **Webhook Integration**: External API for website integration
- **Guided Path Monitoring**: Tracks effectiveness of directing scrapers to important content
- **Performance Optimized**: Batch processing, caching, and efficient database operations

## 🏗️ Tech Stack

- **Backend**: Node.js with Express.js
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Railway
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **External APIs**: ipapi.co for IP geolocation

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd llm-scraper-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up Supabase database**
   - Create a new Supabase project
   - Run the SQL schema from `scripts/setup-database.sql` in your Supabase SQL editor
   - Update `.env` with your Supabase credentials

5. **Start the application**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 🔧 Configuration

### Environment Variables

```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
IP_API_KEY=optional_ip_api_key
WEBHOOK_SECRET=random_secure_string_for_webhook_auth
```

### Database Setup

Run the SQL schema in `scripts/setup-database.sql` to create:
- `llm_activity` - Main tracking table
- `page_scraping_stats` - Aggregated page statistics
- `llm_company_stats` - Daily company summaries
- Indexes and views for performance
- Triggers for automatic statistics updates

## 📊 API Endpoints

### Analytics API
- `GET /api/stats` - Comprehensive statistics
- `GET /api/activity` - Recent scraper activity
- `GET /api/companies` - List of tracked companies
- `GET /api/guidance` - Guided path effectiveness
- `GET /api/system` - System status and performance

### Webhook API
- `POST /webhook/track` - Single tracking event
- `POST /webhook/batch` - Batch tracking events
- `POST /webhook/test` - Test webhook functionality
- `GET /webhook/status` - Webhook service status

### Dashboard
- `GET /dashboard` - Analytics dashboard
- `GET /health` - Health check endpoint

## 🤖 Detected LLM Companies

The system can detect scrapers from:

- **OpenAI** (GPTBot, ChatGPT-User, CCBot)
- **Anthropic** (ClaudeBot, ANTHROPIC-AI)
- **Google** (Googlebot, Google-Extended, Bard)
- **Perplexity AI** (PerplexityBot)
- **Meta AI** (facebookexternalhit, Meta-ExternalAgent)
- **Other LLM crawlers** (Various AI and automated crawlers)

## 🔍 Detection Methods

1. **User-Agent Analysis**: Matches against known LLM crawler patterns
2. **IP Range Checking**: Verifies against known company IP ranges
3. **ASN Verification**: Checks Autonomous System Numbers
4. **Reverse DNS**: Special verification for Google crawlers
5. **Organization Analysis**: Analyzes IP organization names

## 📈 Usage Examples

### Test Detection
```bash
curl -X POST http://localhost:3000/api/test \
  -H "Content-Type: application/json" \
  -d '{"userAgent": "GPTBot/1.0 (+https://openai.com/gptbot)"}'
```

### Webhook Integration
```javascript
// Send tracking data from your website
fetch('http://your-tracker-url/webhook/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: window.location.href,
    userAgent: navigator.userAgent,
    referrer: document.referrer,
    timestamp: new Date().toISOString()
  })
});
```

### Get Statistics
```bash
curl http://localhost:3000/api/stats?days=30
```

## 🧪 Testing

Run the core service tests:
```bash
node tests/core.test.js
```

Test individual components:
```bash
# Test detection engine
npm test -- detector

# Test IP analyzer
npm test -- ipAnalyzer

# Test API endpoints
npm test -- api
```

## 🚀 Deployment

### Railway Deployment

1. **Connect to Railway**
   ```bash
   npm install -g @railway/cli
   railway login
   railway init
   ```

2. **Set environment variables**
   ```bash
   railway variables set SUPABASE_URL=your_url
   railway variables set SUPABASE_ANON_KEY=your_key
   # ... other variables
   ```

3. **Deploy**
   ```bash
   railway up
   ```

### Manual Deployment

1. **Build and start**
   ```bash
   npm install --production
   npm start
   ```

2. **Use PM2 for production**
   ```bash
   npm install -g pm2
   pm2 start src/app.js --name llm-tracker
   pm2 startup
   pm2 save
   ```

## 📁 Project Structure

```
llm-scraper-tracker/
├── src/
│   ├── app.js                 # Main Express application
│   ├── config/
│   │   ├── database.js        # Supabase configuration
│   │   └── llm-signatures.js  # LLM detection patterns
│   ├── middleware/
│   │   └── tracker.js         # Main tracking middleware
│   ├── services/
│   │   ├── detector.js        # LLM detection engine
│   │   ├── ipAnalyzer.js      # IP address analysis
│   │   └── logger.js          # Database logging service
│   └── routes/
│       ├── api.js             # API endpoints
│       ├── dashboard.js       # Dashboard routes
│       └── webhook.js         # Webhook endpoints
├── scripts/
│   └── setup-database.sql     # Database schema
├── tests/
│   └── core.test.js           # Core service tests
├── cline_docs/                # Memory bank documentation
├── package.json
└── README.md
```

## 🔒 Security

- **Input Validation**: All webhook inputs are validated
- **Rate Limiting**: Prevents abuse of tracking endpoints
- **CORS Protection**: Configured for specific origins
- **Helmet Security**: Security headers enabled
- **Error Handling**: No sensitive information in error responses

## 📊 Performance

- **Async Operations**: All I/O operations are non-blocking
- **Batch Processing**: Groups database writes for efficiency
- **Caching**: IP analysis results cached for 24 hours
- **Selective Tracking**: Skips tracking for static assets
- **Connection Pooling**: Efficient database connections

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- Check the [API documentation](#-api-endpoints)
- Review the [troubleshooting guide](#-testing)
- Open an issue on GitHub

## 🔄 Changelog

### v1.0.0
- Initial release
- Multi-layered LLM detection
- Real-time activity tracking
- Analytics dashboard
- Webhook integration
- Comprehensive API
