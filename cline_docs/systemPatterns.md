# System Patterns & Architecture

## Overall Architecture
**Microservices-style Node.js application with clear separation of concerns:**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Traffic   │───▶│  Express Server  │───▶│   Supabase DB   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Dashboard UI   │
                       └──────────────────┘
```

## Key Technical Decisions

### 1. Detection Strategy
- **Multi-layered approach**: User-Agent + IP Range + ASN + Reverse DNS
- **Confidence scoring**: Each detection method has confidence level
- **Fallback mechanisms**: If one method fails, others continue working

### 2. Database Design
- **Event-driven logging**: Every scraper interaction logged as event
- **Aggregated statistics**: Pre-computed daily/weekly stats for performance
- **Indexed queries**: Strategic indexes on timestamp, company, page fields

### 3. Real-time Processing
- **Middleware-based**: Express middleware intercepts all requests
- **Async logging**: Non-blocking database writes
- **Error resilience**: Failed logging doesn't break website functionality

### 4. Scalability Patterns
- **Stateless design**: No server-side sessions
- **Database connection pooling**: Efficient Supabase client usage
- **Caching strategy**: IP analysis results cached for 24 hours

## Core Components

### Detection Engine (`src/services/detector.js`)
- Analyzes User-Agent strings against known patterns
- Checks IP addresses against company ranges
- Performs ASN lookups for organization identification
- Special handling for Google (reverse DNS verification)

### Activity Logger (`src/services/logger.js`)
- Writes to main activity table
- Updates aggregated statistics
- Handles database errors gracefully

### IP Analyzer (`src/services/ipAnalyzer.js`)
- Integrates with ipapi.co for geolocation
- Caches results to avoid API rate limits
- Identifies data center vs residential IPs

### Tracking Middleware (`src/middleware/tracker.js`)
- Intercepts all HTTP requests
- Extracts relevant headers and IP information
- Coordinates detection and logging

## Data Flow Patterns

### 1. Request Processing
```
HTTP Request → Middleware → Detection → Logging → Response
```

### 2. Analytics Generation
```
Raw Events → Aggregation Queries → Dashboard API → Frontend Charts
```

### 3. Webhook Integration
```
External Site → Webhook Endpoint → Detection → Logging → Response
```

## Security Patterns
- **Input validation**: All webhook inputs validated
- **Rate limiting**: Prevent abuse of tracking endpoints
- **IP whitelisting**: Webhook endpoints restricted to known sources
- **Error handling**: No sensitive information in error responses

## Performance Patterns
- **Async operations**: All I/O operations non-blocking
- **Connection pooling**: Efficient database connections
- **Selective tracking**: Skip tracking for static assets
- **Batch operations**: Group database writes when possible
