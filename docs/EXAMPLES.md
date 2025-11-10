# Usage Examples

## Basic Usage

### Simple Code Generation

```typescript
import { ClaudeCodeAutomation } from './src/core/claude-code-automation';

const automation = new ClaudeCodeAutomation({
  headless: false,
  debugMode: true
});

await automation.initialize();
await automation.authenticate();

const session = await automation.createSession(
  'Create a REST API with Express and TypeScript'
);

console.log('Session created:', session.id);
await automation.close();
```

### Code Conversion

```typescript
const session = await automation.createSession(
  'Convert this Python code to TypeScript with type safety',
  {
    language: 'typescript',
    files: ['./my-script.py']
  }
);

await automation.sendRequest('Add error handling and logging');
await automation.sendRequest('Generate unit tests');
```

## Advanced Usage

### Session Pool for Concurrent Operations

```typescript
import { ClaudeSessionPool } from './src/core/claude-code-advanced';

const pool = new ClaudeSessionPool(10, 5);
await pool.initialize(browser);

const tasks = [
  'Convert file1.py to TypeScript',
  'Convert file2.py to TypeScript',
  'Convert file3.py to TypeScript'
];

const results = await Promise.all(
  tasks.map(task => 
    pool.executeWithSession(async (context) => {
      const page = await context.newPage();
      // Perform automation
      return result;
    })
  )
);
```

### Rate Limiting

```typescript
import { RateLimitHandler } from './src/core/claude-code-advanced';

const rateLimiter = new RateLimitHandler();

async function makeRequest(endpoint: string) {
  if (rateLimiter.shouldThrottle(endpoint)) {
    await rateLimiter.wait(endpoint);
  }
  
  const response = await fetch(endpoint);
  rateLimiter.recordRequest(endpoint);
  
  if (response.status === 429) {
    await rateLimiter.handleRateLimitResponse(response);
    return makeRequest(endpoint); // Retry
  }
  
  return response;
}
```

### Direct API Usage

```typescript
import { ClaudeCodeAPIExtractor } from './src/core/claude-code-advanced';

const extractor = new ClaudeCodeAPIExtractor();
await extractor.extractFromBrowser(page);

// Bypass browser for faster operations
const sessionId = await extractor.createSessionAPI(
  'Create a web scraper with Playwright'
);

const response = await extractor.sendMessageAPI(
  sessionId,
  'Add proxy support and retry logic'
);
```

### WebSocket Real-time Updates

```typescript
import { CodeStreamHandler } from './src/core/claude-code-advanced';

const stream = new CodeStreamHandler();
await stream.connect(sessionId, authToken);

stream.on('code-update', (data) => {
  console.log('Code updated:', data.filePath);
  console.log('Content:', data.content);
});

stream.on('execution-result', (result) => {
  console.log('Execution:', result.status);
});

stream.send({
  type: 'subscribe',
  channels: ['code-updates', 'execution-results']
});
```

## MCP Server Usage

### In Claude Desktop

Simply use natural language after configuring the MCP server:

```
Initialize Claude Code and create a TypeScript REST API with:
- Express framework
- MongoDB integration
- JWT authentication
- Rate limiting
- Comprehensive error handling
```

### Programmatic MCP Usage

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const client = new Client({
  name: 'code-converter',
  version: '1.0.0'
});

await client.connect(transport);

// Convert code
const result = await client.callTool('convert_code', {
  sourceFile: './scraper.py',
  targetLanguage: 'typescript',
  requirements: [
    'Use Playwright instead of Selenium',
    'Add TypeScript types',
    'Include error handling'
  ]
});

// Enhance with automation features
await client.callTool('enhance_automation', {
  sessionId: result.sessionId,
  features: ['captcha-solving', 'rate-limiting', 'proxy-rotation']
});

// Generate tests
await client.callTool('generate_tests', {
  sessionId: result.sessionId,
  testTypes: ['unit', 'integration']
});
```

## Integration Examples

### With CI/CD Pipeline

```typescript
// .github/workflows/code-conversion.yml
async function convertCodeInCI() {
  const automation = new ClaudeCodeAutomation({
    headless: true,
    sessionPath: process.env.SESSION_PATH
  });
  
  await automation.initialize();
  
  const session = await automation.createSession(
    `Convert ${process.env.SOURCE_FILE} to ${process.env.TARGET_LANG}`
  );
  
  const prUrl = await automation.submitPullRequest({
    title: 'chore: Automated code conversion',
    description: 'Converted by Claude Code Automation',
    branch: 'automated/conversion',
    files: session.files || []
  });
  
  console.log('PR created:', prUrl);
}
```

### With Cron Jobs

```typescript
import cron from 'node-cron';

// Daily code quality checks
cron.schedule('0 0 * * *', async () => {
  const automation = new ClaudeCodeAutomation({ headless: true });
  await automation.initialize();
  
  const session = await automation.createSession(
    'Review codebase for security vulnerabilities and performance issues'
  );
  
  // Send report
  await sendSlackNotification(session.id);
});
```

### Error Handling Best Practices

```typescript
async function robustAutomation() {
  const automation = new ClaudeCodeAutomation();
  
  try {
    await automation.initialize();
    
    automation.on('captcha-detected', async ({ page }) => {
      console.log('CAPTCHA detected, solving...');
      // CAPTCHA will be solved automatically if configured
    });
    
    automation.on('rate-limited', async ({ retryAfter }) => {
      console.log(`Rate limited, waiting ${retryAfter}ms`);
    });
    
    await automation.authenticate();
    const session = await automation.createSession('Your prompt');
    
    return session;
    
  } catch (error) {
    console.error('Automation failed:', error);
    
    // Save debug info
    await automation.screenshot('./error.png');
    
    throw error;
    
  } finally {
    await automation.close();
  }
}
```
