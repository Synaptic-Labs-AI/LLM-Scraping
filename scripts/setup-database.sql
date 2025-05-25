-- LLM Scraper Tracker Database Schema
-- Run this in your Supabase SQL editor to set up the database

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Main tracking table for all LLM scraper activity
CREATE TABLE IF NOT EXISTS llm_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    llm_company TEXT NOT NULL,
    user_agent TEXT,
    ip_address INET,
    page_visited TEXT NOT NULL,
    referer TEXT,
    detection_method TEXT NOT NULL,
    country TEXT,
    asn TEXT,
    organization TEXT,
    is_guided_path BOOLEAN DEFAULT FALSE,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Page scraping statistics - aggregated data per page per company
CREATE TABLE IF NOT EXISTS page_scraping_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_url TEXT NOT NULL,
    llm_company TEXT NOT NULL,
    scrape_count INTEGER DEFAULT 1,
    last_scraped TIMESTAMPTZ DEFAULT NOW(),
    first_scraped TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(page_url, llm_company)
);

-- Daily company activity summary for quick analytics
CREATE TABLE IF NOT EXISTS llm_company_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company TEXT NOT NULL,
    date DATE NOT NULL,
    total_requests INTEGER DEFAULT 0,
    unique_pages INTEGER DEFAULT 0,
    unique_ips INTEGER DEFAULT 0,
    last_activity TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company, date)
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_llm_activity_timestamp ON llm_activity(timestamp);
CREATE INDEX IF NOT EXISTS idx_llm_activity_company ON llm_activity(llm_company);
CREATE INDEX IF NOT EXISTS idx_llm_activity_page ON llm_activity(page_visited);
CREATE INDEX IF NOT EXISTS idx_llm_activity_ip ON llm_activity(ip_address);
CREATE INDEX IF NOT EXISTS idx_page_stats_company ON page_scraping_stats(llm_company);
CREATE INDEX IF NOT EXISTS idx_page_stats_url ON page_scraping_stats(page_url);
CREATE INDEX IF NOT EXISTS idx_company_stats_date ON llm_company_stats(date);
CREATE INDEX IF NOT EXISTS idx_company_stats_company ON llm_company_stats(company);

-- Views for common analytics queries
CREATE OR REPLACE VIEW recent_activity AS
SELECT 
    timestamp,
    llm_company,
    page_visited,
    ip_address,
    detection_method,
    is_guided_path,
    country,
    organization
FROM llm_activity 
WHERE timestamp >= NOW() - INTERVAL '7 days'
ORDER BY timestamp DESC;

CREATE OR REPLACE VIEW top_scraped_pages AS
SELECT 
    page_url,
    SUM(scrape_count) as total_scrapes,
    COUNT(DISTINCT llm_company) as companies_count,
    MAX(last_scraped) as most_recent,
    MIN(first_scraped) as first_seen
FROM page_scraping_stats 
GROUP BY page_url 
ORDER BY total_scrapes DESC;

CREATE OR REPLACE VIEW company_activity_summary AS
SELECT 
    llm_company,
    COUNT(*) as total_activities,
    COUNT(DISTINCT page_visited) as unique_pages,
    COUNT(DISTINCT ip_address) as unique_ips,
    MAX(timestamp) as last_activity,
    MIN(timestamp) as first_activity
FROM llm_activity 
GROUP BY llm_company
ORDER BY total_activities DESC;

-- Function to update page stats automatically
CREATE OR REPLACE FUNCTION update_page_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO page_scraping_stats (page_url, llm_company, scrape_count, first_scraped, last_scraped)
    VALUES (NEW.page_visited, NEW.llm_company, 1, NEW.timestamp, NEW.timestamp)
    ON CONFLICT (page_url, llm_company)
    DO UPDATE SET
        scrape_count = page_scraping_stats.scrape_count + 1,
        last_scraped = NEW.timestamp,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update company daily stats
CREATE OR REPLACE FUNCTION update_company_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO llm_company_stats (company, date, total_requests, last_activity)
    VALUES (NEW.llm_company, DATE(NEW.timestamp), 1, NEW.timestamp)
    ON CONFLICT (company, date)
    DO UPDATE SET
        total_requests = llm_company_stats.total_requests + 1,
        last_activity = NEW.timestamp;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update stats when new activity is logged
CREATE TRIGGER trigger_update_page_stats
    AFTER INSERT ON llm_activity
    FOR EACH ROW
    EXECUTE FUNCTION update_page_stats();

CREATE TRIGGER trigger_update_company_stats
    AFTER INSERT ON llm_activity
    FOR EACH ROW
    EXECUTE FUNCTION update_company_stats();

-- Row Level Security (RLS) policies for security
ALTER TABLE llm_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_scraping_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_company_stats ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Allow read access" ON llm_activity FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON page_scraping_stats FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON llm_company_stats FOR SELECT USING (true);

-- Allow insert for service role
CREATE POLICY "Allow insert for service role" ON llm_activity FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow insert for service role" ON page_scraping_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow insert for service role" ON llm_company_stats FOR INSERT WITH CHECK (true);

-- Allow update for service role
CREATE POLICY "Allow update for service role" ON page_scraping_stats FOR UPDATE USING (true);
CREATE POLICY "Allow update for service role" ON llm_company_stats FOR UPDATE USING (true);

-- Comments for documentation
COMMENT ON TABLE llm_activity IS 'Main table tracking all LLM scraper interactions with the website';
COMMENT ON TABLE page_scraping_stats IS 'Aggregated statistics per page per LLM company';
COMMENT ON TABLE llm_company_stats IS 'Daily activity summaries per LLM company';

COMMENT ON COLUMN llm_activity.detection_method IS 'Method used to detect LLM: user_agent, ip_range, asn, reverse_dns';
COMMENT ON COLUMN llm_activity.is_guided_path IS 'Whether the scraped page is part of our guided content strategy';
COMMENT ON COLUMN llm_activity.session_id IS 'Session identifier for tracking scraper sessions';

-- Sample data for testing (optional - remove in production)
-- INSERT INTO llm_activity (llm_company, user_agent, ip_address, page_visited, detection_method, is_guided_path)
-- VALUES 
--     ('openai', 'GPTBot/1.0', '23.102.140.115', '/case-studies/ai-implementation', 'user_agent', true),
--     ('anthropic', 'ClaudeBot/1.0', '160.79.104.50', '/research/llm-benchmarks', 'user_agent', true),
--     ('google', 'Google-Extended/1.0', '66.249.66.1', '/blog/ai-trends-2024', 'user_agent', true);
