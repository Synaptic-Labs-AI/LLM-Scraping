# Technical Context & Setup

## Technology Stack

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js v4.18.2
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Railway
- **Process Manager**: PM2 (for production)

### Frontend
- **Dashboard**: Vanilla HTML/CSS/JavaScript
- **Charts**: Chart.js for data visualization
- **Styling**: Custom CSS with responsive design
- **No framework**: Keeping it simple for maintainability

### External Services
- **IP Geolocation**: ipapi.co
- **Database**: Supabase PostgreSQL
- **DNS Lookups**: Node.js built-in DNS module

## Development Setup

### Prerequisites
```bash
node --version  # v18 or higher
npm --version   # v8 or higher
```

### Environment Variables Required
```
PORT=3000
NODE_ENV=development
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
IP_API_KEY=optional_ip_api_key
WEBHOOK_SECRET=random_secure_string_for_webhook_auth
```

### Key Dependencies
```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "helmet": "^7.0.0",
  "morgan": "^1.10.0",
  "dotenv": "^16.3.1",
  "@supabase/supabase-js": "^2.38.0",
  "axios": "^1.5.0",
  "ip-range-check": "^0.2.0",
  "useragent": "^2.3.0",
  "node-cron": "^3.0.2"
}
```

## Database Schema

### Main Tables
1. **llm_activity**: Core tracking table for all scraper interactions
2. **page_scraping_stats**: Aggregated page-level statistics
3. **llm_company_stats**: Daily company activity summaries

### Key Indexes
- `idx_llm_activity_timestamp`: For time-based queries
- `idx_llm_activity_company`: For company filtering
- `idx_llm_activity_page`: For page analysis

## API Endpoints

### Public Endpoints
- `GET /health`: Health check
- `GET /`: Service information

### Analytics API
- `GET /api/activity`: Recent scraping activity
- `GET /api/stats`: Activity statistics
- `GET /api/guidance`: Guided path effectiveness

### Dashboard
- `GET /dashboard`: Analytics dashboard UI
- `GET /dashboard/data`: Dashboard data API

### Webhooks
- `POST /webhook/track`: External tracking webhook
- `POST /webhook/test`: Webhook testing endpoint

## Development Workflow

### Local Development
```bash
npm install
cp .env.example .env
# Configure environment variables
npm run dev
```

### Testing Strategy
- Unit tests for detection logic
- Integration tests for API endpoints
- Manual testing with various User-Agent strings
- Database migration testing

### Deployment Process
1. Push to GitHub repository
2. Railway auto-deploys from main branch
3. Environment variables configured in Railway dashboard
4. Database migrations run automatically

## Technical Constraints

### Rate Limits
- IP API: 1000 requests/day (free tier)
- Supabase: Based on plan (generous limits)

### Performance Requirements
- Response time: <200ms for tracking middleware
- Database writes: <100ms for activity logging
- Dashboard load: <2 seconds initial load

### Security Considerations
- No sensitive data in logs
- Webhook authentication required
- Input validation on all endpoints
- Rate limiting on public endpoints

## Monitoring & Logging

### Application Logs
- Request/response logging via Morgan
- Error logging to console
- Activity detection logging with emojis

### Database Monitoring
- Supabase built-in monitoring
- Query performance tracking
- Connection pool monitoring

### Health Checks
- `/health` endpoint for uptime monitoring
- Database connectivity checks
- External API availability checks
