# Claude Code Web Automation

A comprehensive TypeScript/Playwright solution for programmatically interacting with the Claude Code web interface at https://claude.ai/code.

## Features

### Core Automation
- **Browser Automation**: Full Playwright integration with stealth mode
- **Authentication**: Support for OAuth and traditional login flows
- **Session Management**: Persistent sessions with cookie/localStorage preservation
- **CAPTCHA Handling**: Integrated 2captcha solver support
- **Request Interception**: API monitoring and modification capabilities

### Advanced Features
- **Session Pooling**: Manage multiple concurrent sessions
- **Rate Limit Handling**: Intelligent throttling and exponential backoff
- **API Extraction**: Reverse engineer and use internal APIs directly
- **WebSocket Monitoring**: Real-time code updates and streaming
- **Mutation Observers**: Dynamic content tracking

## Installation

```bash
npm install

# Install Playwright browsers
npx playwright install chromium
```

## Configuration

Create a `.env` file:

```env
TWOCAPTCHA_API_KEY=your_2captcha_key
CLAUDE_EMAIL=your_email (optional)
CLAUDE_PASSWORD=your_password (optional)
```

## Basic Usage

```typescript
import { ClaudeCodeAutomation } from './claude-code-automation';

const automation = new ClaudeCodeAutomation({
  headless: false,
  debugMode: true
});

await automation.initialize();
await automation.authenticate();

// Create a coding session
const session = await automation.createSession(
  'Create a TypeScript REST API with Express',
  {
    language: 'typescript',
    files: ['./requirements.md']
  }
);

// Send follow-up requests
await automation.sendRequest('Add authentication middleware');

// Submit a PR
const prUrl = await automation.submitPullRequest({
  title: 'feat: Add REST API implementation',
  description: 'Implements Express REST API with TypeScript',
  branch: 'feature/rest-api'
});
```

## Advanced Usage

### Session Pool Management

Handle multiple concurrent sessions efficiently:

```typescript
import { ClaudeSessionPool } from './claude-code-advanced';

const pool = new ClaudeSessionPool(10, 5); // 10 sessions, 5 concurrent
await pool.initialize(browser);

// Execute tasks with automatic session management
const result = await pool.executeWithSession(async (context) => {
  const page = await context.newPage();
  // Your automation logic here
  return result;
});
```

### API Extraction and Direct Requests

Bypass the browser for faster operations:

```typescript
import { ClaudeCodeAPIExtractor } from './claude-code-advanced';

const extractor = new ClaudeCodeAPIExtractor();
await extractor.extractFromBrowser(page);

// Make direct API calls
const sessionId = await extractor.createSessionAPI('Your prompt here');
const response = await extractor.sendMessageAPI(sessionId, 'Follow-up message');
```

### Rate Limit Handling

Intelligent throttling to avoid hitting limits:

```typescript
import { RateLimitHandler } from './claude-code-advanced';

const rateLimiter = new RateLimitHandler();

if (rateLimiter.shouldThrottle('/api/messages')) {
  await rateLimiter.handleRateLimitResponse(response);
}

rateLimiter.recordRequest('/api/messages');
```

### WebSocket Real-time Monitoring

Stream code updates in real-time:

```typescript
import { CodeStreamHandler } from './claude-code-advanced';

const stream = new CodeStreamHandler();
await stream.connect(sessionId, authToken);

stream.send({
  type: 'subscribe',
  channels: ['code-updates', 'execution-results']
});
```

## Integration Examples

### With Existing Automation Systems

```typescript
// Integrate with Skyvern
import { SkyvernClaudeIntegration } from './claude-code-examples';

const integration = new SkyvernClaudeIntegration(
  claudeAutomation,
  skyvernAPI
);

const script = await integration.generateAutomationScript(
  'Automate LinkedIn job applications with smart form detection'
);
```

### Job Application Automation Enhancement

```typescript
import { enhanceJobApplicationAutomation } from './claude-code-examples';

const enhancedSession = await enhanceJobApplicationAutomation(automation);
// Your enhanced automation is ready with:
// - Improved field detection
// - Smart resume parsing
// - Answer generation
// - Success tracking
```

## API Methods

### Core Methods

| Method | Description |
|--------|------------|
| `initialize()` | Initialize browser and load saved sessions |
| `authenticate(email?, password?)` | Authenticate with Claude Code |
| `createSession(prompt, options)` | Create new coding session |
| `sendRequest(message)` | Send message in current session |
| `updateCode(filePath, content)` | Update code in editor |
| `submitPullRequest(pr)` | Create and submit PR |
| `getSessionState()` | Get current session state |

### Advanced Methods

| Method | Description |
|--------|------------|
| `executeScript(script, args)` | Execute custom JavaScript |
| `screenshot(path)` | Take screenshot |
| `extractSessionId()` | Get current session ID |
| `uploadFiles(files)` | Upload files to session |

## Event Handling

The automation class extends EventEmitter:

```typescript
automation.on('oauth-required', async ({ page }) => {
  // Handle OAuth flow
});

automation.on('captcha-detected', async ({ page, type }) => {
  // Handle CAPTCHA
});

automation.on('rate-limited', async ({ endpoint, retryAfter }) => {
  // Handle rate limiting
});
```

## Best Practices

1. **Session Management**: Always save sessions to avoid re-authentication
2. **Rate Limiting**: Use session pools and intelligent throttling
3. **Error Handling**: Implement comprehensive try-catch blocks
4. **Debugging**: Enable debug mode for API monitoring
5. **CAPTCHA**: Have fallback solutions for CAPTCHA challenges

## Architecture Notes

### Request Flow
1. Browser automation captures API patterns
2. Session pool manages concurrent operations
3. Rate limiter prevents API throttling
4. WebSocket handler streams real-time updates

### Security Considerations
- Sessions stored locally (encrypted recommended)
- OAuth tokens handled securely
- API keys never exposed in code

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Check OAuth configuration
   - Verify CAPTCHA solver is working
   - Ensure cookies are properly saved/loaded

2. **Rate Limiting**
   - Reduce concurrent sessions
   - Implement longer delays between requests
   - Use session pooling

3. **Dynamic Content**
   - Wait for mutation observers
   - Use proper selectors with data attributes
   - Implement retry logic

## Advanced Patterns

### Custom Tool Integration

```typescript
// Add custom Claude Code tools
await automation.executeScript(() => {
  window.claudeTools = {
    customFormatter: (code) => {
      // Custom formatting logic
    },
    customValidator: (code) => {
      // Custom validation
    }
  };
});
```

### Batch Processing

```typescript
const tasks = [...]; // Your tasks

for (const task of tasks) {
  await pool.executeWithSession(async (context) => {
    // Process task
  });
}
```

## Performance Optimization

1. **Use Direct API**: When possible, use extracted APIs instead of browser automation
2. **Cache Responses**: Implement response caching for repeated requests
3. **Parallel Execution**: Use session pools for concurrent operations
4. **Minimize DOM Operations**: Batch updates and use efficient selectors

## Contributing

Feel free to extend this solution with:
- Additional authentication methods
- More sophisticated rate limiting
- Enhanced error recovery
- Custom integrations

## License

MIT

## Notes

This solution is designed for legitimate automation of your own Claude Code sessions. Always respect terms of service and rate limits.
