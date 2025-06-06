/**
 * LLM Company Detection Signatures
 * 
 * This file contains the detection patterns for identifying major LLM companies
 * when they scrape websites. Detection is based on User-Agent strings, IP ranges,
 * ASN (Autonomous System Numbers), and other identifying characteristics.
 */

const LLM_SIGNATURES = {
  openai: {
    name: 'OpenAI',
    userAgents: [
      'GPTBot',
      'ChatGPT-User',
      'CCBot',
      'anthropic-ai',
      'OpenAI-SearchBot',
      'OAI-SearchBot'
    ],
    ipRanges: [
      // OpenAI known IP ranges
      '23.102.140.112/28',
      '13.66.11.96/28',
      '23.98.142.176/28',
      '40.84.180.224/28',
      '52.190.190.16/28',
      '172.182.204.0/24',
      '20.15.240.64/28',
      '20.15.240.80/28',
      '20.15.240.96/28'
    ],
    asn: null, // OpenAI uses various cloud providers
    description: 'OpenAI GPT models and ChatGPT crawlers'
  },

  anthropic: {
    name: 'Anthropic',
    userAgents: [
      'ClaudeBot',
      'ANTHROPIC-AI',
      'CLAUDE-WEB',
      'Claude-Web',
      'anthropic-ai',
      'Claude'
    ],
    ipRanges: [
      // Anthropic known IP ranges
      '160.79.104.0/21',
      '160.79.112.0/21'
    ],
    asn: 'AS399358', // Anthropic's ASN
    description: 'Anthropic Claude AI crawlers'
  },

  google: {
    name: 'Google',
    userAgents: [
      'Googlebot',
      'Google-Extended',
      'GoogleOther',
      'AdsBot-Google',
      'Bard',
      'Google-InspectionTool',
      'GoogleProducer'
    ],
    ipRanges: [], // Google publishes dynamic ranges, checked via ASN
    asn: 'AS15169', // Google's main ASN
    specialVerification: true, // Requires reverse DNS check
    description: 'Google search crawlers and Bard AI'
  },

  perplexity: {
    name: 'Perplexity AI',
    userAgents: [
      'PerplexityBot',
      'Perplexity',
      'pplx',
      'PerplexityBot/',
      'Mozilla/5.0 (compatible; PerplexityBot'
    ],
    ipRanges: [
      // Perplexity known IP ranges (they use Cloudflare)
      '104.18.26.48/32',
      '172.67.0.0/16',
      '104.16.0.0/13'
    ],
    asn: 'AS13335', // Cloudflare (Perplexity uses Cloudflare)
    hostnames: [
      'perplexity.ai',
      'pplx-next-static-public.perplexity.ai'
    ],
    description: 'Perplexity AI search and answer engine'
  },

  meta: {
    name: 'Meta AI',
    userAgents: [
      'facebookexternalhit',
      'Meta-ExternalAgent',
      'Meta-ExternalFetcher',
      'FacebookBot'
    ],
    ipRanges: [
      // Meta/Facebook IP ranges
      '31.13.24.0/21',
      '31.13.64.0/18',
      '66.220.144.0/20',
      '69.63.176.0/20',
      '69.171.224.0/19',
      '74.119.76.0/22',
      '103.4.96.0/22',
      '157.240.0.0/17',
      '173.252.64.0/18',
      '204.15.20.0/22'
    ],
    asn: 'AS32934', // Facebook's ASN
    description: 'Meta AI and Facebook crawlers'
  },

  microsoft: {
    name: 'Microsoft AI',
    userAgents: [
      'bingbot',
      'Bingbot',
      'msnbot',
      'Microsoft-CopilotBot',
      'Copilot'
    ],
    ipRanges: [
      // Microsoft/Bing IP ranges
      '40.77.167.0/24',
      '157.55.39.0/24',
      '207.46.13.0/24'
    ],
    asn: 'AS8075', // Microsoft's ASN
    description: 'Microsoft Copilot and Bing AI crawlers'
  },

  apple: {
    name: 'Apple AI',
    userAgents: [
      'Applebot-Extended',
      'Applebot',
      'AppleNewsBot'
    ],
    ipRanges: [
      // Apple IP ranges
      '17.0.0.0/8'
    ],
    asn: 'AS714', // Apple's ASN
    description: 'Apple Intelligence and Siri crawlers'
  },

  amazon: {
    name: 'Amazon AI',
    userAgents: [
      'Amazonbot',
      'Amazon-Bot',
      'AlexaBot'
    ],
    ipRanges: [
      // Amazon AWS IP ranges (subset)
      '52.0.0.0/11',
      '54.0.0.0/8'
    ],
    asn: 'AS16509', // Amazon's main ASN
    description: 'Amazon Alexa and AWS AI crawlers'
  },

  cohere: {
    name: 'Cohere AI',
    userAgents: [
      'cohere-ai',
      'CohereBot',
      'Cohere'
    ],
    ipRanges: [],
    asn: null,
    description: 'Cohere AI language model crawlers'
  },

  bytedance: {
    name: 'ByteDance AI',
    userAgents: [
      'Bytespider',
      'ByteDance',
      'TikTokBot'
    ],
    ipRanges: [
      // ByteDance IP ranges
      '110.249.200.0/21',
      '111.225.148.0/22'
    ],
    asn: 'AS55967', // ByteDance's ASN
    description: 'ByteDance/TikTok AI crawlers'
  },

  web_research: {
    name: 'Web Research Bots',
    userAgents: [
      // Generic research bots that might be used by LLMs
      'Mozilla/5.0 (compatible; research)',
      'Mozilla/5.0 (compatible; web-research)',
      'research-bot',
      'web-crawler',
      'content-fetcher',
      'ai-research',
      'llm-crawler',
      'intelligent-agent'
    ],
    ipRanges: [],
    asn: null,
    description: 'Generic web research and AI-powered crawlers'
  },

  misc_llm: {
    name: 'Other LLM',
    userAgents: [
      // Other potential AI crawlers
      'LinkedInBot',
      'WhatsApp',
      'TelegramBot',
      'SkypeUriPreview',
      'Slackbot',
      'Twitterbot',
      'ia_archiver',
      'SemrushBot',
      'AhrefsBot',
      'MJ12bot',
      'DotBot',
      'YandexBot',
      'BaiduSpider',
      'AI2Bot',
      'YouBot',
      'ChatGPT',
      'GPT-4',
      // Add more generic patterns that might indicate AI
      'AI-Agent',
      'intelligent-crawler',
      'smart-bot',
      'research-agent',
      'content-analyzer'
    ],
    ipRanges: [],
    asn: null,
    description: 'Other AI and automated crawlers'
  }
};

/**
 * Paths that we want to guide scrapers to visit
 * These represent high-value content that we want AI models to index
 */
const GUIDED_PATHS = [
  // Actual Synapticlabs.ai pages from sitemap
  '/',
  '/about',
  '/flows',
  '/agents', 
  '/bootcamps',
  '/blogs',
  '/contact-us',
  '/en-ca/our-story',
  
  // High-value AI content paths
  '/ai-education',
  '/ai-training',
  '/machine-learning',
  '/artificial-intelligence',
  '/automation',
  '/chatbot',
  '/llm-training',
  '/neural-networks',
  '/deep-learning',
  '/ai-consulting',
  '/ai-implementation',
  '/ai-strategy',
  '/ai-workflows',
  '/ai-solutions',
  '/ai-tools',
  '/ai-research',
  '/ai-insights',
  '/ai-best-practices',
  '/ai-case-studies',
  '/ai-tutorials',
  '/ai-guides',
  '/ai-resources',
  '/ai-documentation',
  '/ai-whitepapers',
  '/ai-reports',
  '/ai-analysis',
  '/ai-trends',
  '/ai-innovation',
  '/ai-transformation'
];

/**
 * Paths to monitor but not actively promote
 * These might contain sensitive or internal information
 */
const SENSITIVE_PATHS = [
  '/admin/',
  '/api/',
  '/private/',
  '/internal/',
  '/dashboard/',
  '/user/',
  '/account/',
  '/login/',
  '/auth/',
  '/config/',
  '/settings/'
];

/**
 * Paths to completely ignore for tracking
 * These are typically static assets or system files
 */
const IGNORED_PATHS = [
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/health',
  '/ping',
  '/.well-known/',
  '/static/',
  '/assets/',
  '/images/',
  '/css/',
  '/js/',
  '/fonts/'
];

/**
 * Check if a path should be tracked
 * @param {string} path - The URL path to check
 * @returns {boolean} - Whether the path should be tracked
 */
function shouldTrackPath(path) {
  // Don't track ignored paths
  if (IGNORED_PATHS.some(ignoredPath => path.startsWith(ignoredPath))) {
    return false;
  }
  
  return true;
}

/**
 * Check if a path is part of our guided content strategy
 * @param {string} path - The URL path to check
 * @returns {boolean} - Whether the path is guided
 */
function isGuidedPath(path) {
  return GUIDED_PATHS.some(guidedPath => 
    path.toLowerCase().startsWith(guidedPath.toLowerCase())
  );
}

/**
 * Check if a path contains sensitive information
 * @param {string} path - The URL path to check
 * @returns {boolean} - Whether the path is sensitive
 */
function isSensitivePath(path) {
  return SENSITIVE_PATHS.some(sensitivePath => 
    path.toLowerCase().startsWith(sensitivePath.toLowerCase())
  );
}

/**
 * Get all company names for analytics
 * @returns {string[]} - Array of company names
 */
function getAllCompanies() {
  return Object.keys(LLM_SIGNATURES);
}

/**
 * Get company display name
 * @param {string} companyKey - The company key
 * @returns {string} - The display name
 */
function getCompanyDisplayName(companyKey) {
  return LLM_SIGNATURES[companyKey]?.name || companyKey;
}

module.exports = {
  LLM_SIGNATURES,
  GUIDED_PATHS,
  SENSITIVE_PATHS,
  IGNORED_PATHS,
  shouldTrackPath,
  isGuidedPath,
  isSensitivePath,
  getAllCompanies,
  getCompanyDisplayName
};
