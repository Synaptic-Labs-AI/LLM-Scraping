/**
 * Core Services Test
 * 
 * Basic tests to verify our core services are working correctly
 * Run with: node tests/core.test.js
 */

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-key';

const detector = require('../src/services/detector');
const { ipAnalyzer } = require('../src/services/ipAnalyzer');
const { LLM_SIGNATURES, isGuidedPath, shouldTrackPath } = require('../src/config/llm-signatures');

/**
 * Test the LLM detection engine
 */
async function testDetector() {
  console.log('🧪 Testing LLM Detector...');
  
  const testCases = [
    {
      name: 'OpenAI GPTBot',
      userAgent: 'GPTBot/1.0 (+https://openai.com/gptbot)',
      expectedCompany: 'openai',
      expectedMethod: 'user_agent'
    },
    {
      name: 'Anthropic ClaudeBot',
      userAgent: 'ClaudeBot/1.0 (+https://www.anthropic.com/claude-bot)',
      expectedCompany: 'anthropic',
      expectedMethod: 'user_agent'
    },
    {
      name: 'Google Extended',
      userAgent: 'Mozilla/5.0 (compatible; Google-Extended)',
      expectedCompany: 'google',
      expectedMethod: 'user_agent'
    },
    {
      name: 'Perplexity Bot',
      userAgent: 'PerplexityBot/1.0 (+https://perplexity.ai/bot)',
      expectedCompany: 'perplexity',
      expectedMethod: 'user_agent'
    },
    {
      name: 'Regular Browser',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      expectedCompany: null,
      expectedMethod: null
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const detection = await detector.detectLLMCompany(testCase.userAgent, '127.0.0.1');
      
      if (testCase.expectedCompany === null) {
        // Should not detect anything
        if (!detection) {
          console.log(`✅ ${testCase.name}: Correctly not detected`);
          passed++;
        } else {
          console.log(`❌ ${testCase.name}: Unexpected detection - ${detection.companyName}`);
          failed++;
        }
      } else {
        // Should detect the expected company
        if (detection && detection.company === testCase.expectedCompany) {
          console.log(`✅ ${testCase.name}: Correctly detected as ${detection.companyName} via ${detection.method}`);
          passed++;
        } else {
          console.log(`❌ ${testCase.name}: Expected ${testCase.expectedCompany}, got ${detection?.company || 'none'}`);
          failed++;
        }
      }
    } catch (error) {
      console.log(`❌ ${testCase.name}: Error - ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Detector Tests: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

/**
 * Test the IP analyzer (without making actual API calls)
 */
function testIPAnalyzer() {
  console.log('🧪 Testing IP Analyzer...');
  
  const testCases = [
    {
      name: 'Valid IPv4',
      ip: '192.168.1.1',
      shouldBeValid: true
    },
    {
      name: 'Invalid IP',
      ip: '999.999.999.999',
      shouldBeValid: false
    },
    {
      name: 'Private IP',
      ip: '10.0.0.1',
      shouldBePrivate: true
    },
    {
      name: 'Public IP',
      ip: '8.8.8.8',
      shouldBePrivate: false
    },
    {
      name: 'Localhost',
      ip: '127.0.0.1',
      shouldBePrivate: true
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const isValid = ipAnalyzer.isValidIP(testCase.ip);
      const isPrivate = ipAnalyzer.isPrivateIP(testCase.ip);

      if (testCase.hasOwnProperty('shouldBeValid')) {
        if (isValid === testCase.shouldBeValid) {
          console.log(`✅ ${testCase.name}: IP validity check passed`);
          passed++;
        } else {
          console.log(`❌ ${testCase.name}: Expected valid=${testCase.shouldBeValid}, got ${isValid}`);
          failed++;
        }
      }

      if (testCase.hasOwnProperty('shouldBePrivate')) {
        if (isPrivate === testCase.shouldBePrivate) {
          console.log(`✅ ${testCase.name}: IP private check passed`);
          passed++;
        } else {
          console.log(`❌ ${testCase.name}: Expected private=${testCase.shouldBePrivate}, got ${isPrivate}`);
          failed++;
        }
      }
    } catch (error) {
      console.log(`❌ ${testCase.name}: Error - ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 IP Analyzer Tests: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

/**
 * Test the LLM signatures configuration
 */
function testLLMSignatures() {
  console.log('🧪 Testing LLM Signatures...');
  
  let passed = 0;
  let failed = 0;

  // Test that all companies have required fields
  for (const [companyKey, config] of Object.entries(LLM_SIGNATURES)) {
    try {
      if (!config.name) {
        console.log(`❌ ${companyKey}: Missing name field`);
        failed++;
        continue;
      }

      if (!config.userAgents || !Array.isArray(config.userAgents)) {
        console.log(`❌ ${companyKey}: Missing or invalid userAgents field`);
        failed++;
        continue;
      }

      if (config.userAgents.length === 0) {
        console.log(`❌ ${companyKey}: Empty userAgents array`);
        failed++;
        continue;
      }

      console.log(`✅ ${companyKey}: Configuration valid (${config.userAgents.length} user agents)`);
      passed++;
    } catch (error) {
      console.log(`❌ ${companyKey}: Error - ${error.message}`);
      failed++;
    }
  }

  // Test guided path detection
  const guidedPathTests = [
    { path: '/case-studies/ai-implementation', shouldBeGuided: true },
    { path: '/research/llm-benchmarks', shouldBeGuided: true },
    { path: '/blog/latest-news', shouldBeGuided: true },
    { path: '/admin/dashboard', shouldBeGuided: false },
    { path: '/about', shouldBeGuided: false }
  ];

  for (const test of guidedPathTests) {
    const isGuided = isGuidedPath(test.path);
    if (isGuided === test.shouldBeGuided) {
      console.log(`✅ Guided path test: ${test.path} correctly identified`);
      passed++;
    } else {
      console.log(`❌ Guided path test: ${test.path} expected ${test.shouldBeGuided}, got ${isGuided}`);
      failed++;
    }
  }

  // Test tracking path detection
  const trackingPathTests = [
    { path: '/case-studies/ai', shouldTrack: true },
    { path: '/favicon.ico', shouldTrack: false },
    { path: '/robots.txt', shouldTrack: false },
    { path: '/api/data', shouldTrack: true }
  ];

  for (const test of trackingPathTests) {
    const shouldTrack = shouldTrackPath(test.path);
    if (shouldTrack === test.shouldTrack) {
      console.log(`✅ Tracking path test: ${test.path} correctly identified`);
      passed++;
    } else {
      console.log(`❌ Tracking path test: ${test.path} expected ${test.shouldTrack}, got ${shouldTrack}`);
      failed++;
    }
  }

  console.log(`\n📊 LLM Signatures Tests: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Core Services Tests\n');
  
  const results = {
    detector: await testDetector(),
    ipAnalyzer: testIPAnalyzer(),
    signatures: testLLMSignatures()
  };

  const totalPassed = results.detector.passed + results.ipAnalyzer.passed + results.signatures.passed;
  const totalFailed = results.detector.failed + results.ipAnalyzer.failed + results.signatures.failed;
  const totalTests = totalPassed + totalFailed;

  console.log('📋 Test Summary:');
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${totalPassed}`);
  console.log(`   Failed: ${totalFailed}`);
  console.log(`   Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);

  if (totalFailed === 0) {
    console.log('\n🎉 All tests passed! Core services are working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please check the implementation.');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  testDetector,
  testIPAnalyzer,
  testLLMSignatures,
  runAllTests
};
