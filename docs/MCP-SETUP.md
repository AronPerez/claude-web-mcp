# Claude Code MCP Server - Setup Guide

## Why MCP Server is Better for Agentic AI

The MCP (Model Context Protocol) Server provides significant advantages over direct browser automation for AI agents:

### ✅ **Standardized Tool Interface**
- AI agents can discover and use tools through a consistent protocol
- No need to understand implementation details
- Self-documenting with schemas and descriptions

### ✅ **Better Resource Management**
- Session pooling for concurrent operations
- Automatic cleanup and state management
- Rate limiting handled transparently

### ✅ **AI-Native Design**
- Tools designed for LLM consumption
- Structured inputs/outputs with JSON schemas
- Error handling that AI can understand

### ✅ **Integration Ready**
- Works with Claude Desktop, OpenAI Assistants, LangChain, etc.
- Can be composed with other MCP servers
- Supports multi-agent orchestration

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <your-repo>
cd claude-code-mcp

# Install dependencies
npm install

# Build the server
npm run build

# Install Playwright browsers
npx playwright install chromium
```

### 2. Configuration

Create a `.env` file:

```env
# Authentication
TWOCAPTCHA_API_KEY=your_api_key

# MCP Settings
MCP_HEADLESS=true
MCP_DEBUG=false
MCP_MAX_SESSIONS=5
MCP_SESSION_PATH=./sessions
```

### 3. Add to Claude Desktop

Edit your Claude Desktop configuration file:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "claude-code": {
      "command": "node",
      "args": ["/absolute/path/to/dist/claude-code-mcp-server.js"],
      "env": {
        "MCP_HEADLESS": "true",
        "TWOCAPTCHA_API_KEY": "your_key"
      }
    }
  }
}
```

### 4. Restart Claude Desktop

After adding the configuration, restart Claude Desktop. The tools will be available in your conversations.

## Available Tools

### Core Tools

| Tool | Description | Use Case |
|------|-------------|----------|
| `initialize_claude_code` | Start browser and authenticate | Required before other operations |
| `create_code_session` | Create new coding session | Start a new project or task |
| `send_code_request` | Send follow-up message | Iterate on existing code |
| `convert_code` | Convert between languages | Python → TypeScript, etc. |
| `enhance_automation` | Add capabilities to code | CAPTCHA, OAuth, rate limiting |

### Advanced Tools

| Tool | Description | Use Case |
|------|-------------|----------|
| `batch_process` | Process multiple tasks | Bulk conversions or fixes |
| `analyze_code_quality` | Code quality analysis | Security, performance checks |
| `generate_tests` | Create test suites | Unit, integration, E2E tests |
| `create_pull_request` | Submit PR | GitHub integration |

## Usage Examples

### In Claude Desktop

Once configured, you can use natural language:

```
"Initialize Claude Code and convert my Python scraper at /path/to/scraper.py to TypeScript with Playwright"

"Enhance the job automation files in /job-automation/ with CAPTCHA solving and OAuth integration"

"Create a comprehensive web automation framework with rate limiting and session management"
```

### Programmatic Usage (AI Agents)

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const client = new Client({
  name: 'my-ai-agent',
  version: '1.0.0',
});

// Connect to the MCP server
await client.connect(transport);

// Use tools
const result = await client.callTool('convert_code', {
  sourceFile: './scraper.py',
  targetLanguage: 'typescript',
  requirements: ['Use Playwright', 'Add error handling']
});
```

## Integration Patterns

### 1. With LangChain

```python
from langchain.tools import MCPTool
from langchain.agents import initialize_agent

# Create MCP tool
claude_code_tool = MCPTool(
    server_command="node dist/claude-code-mcp-server.js",
    tool_names=["convert_code", "enhance_automation"]
)

# Use in agent
agent = initialize_agent(
    tools=[claude_code_tool],
    llm=your_llm,
    agent="zero-shot-react-description"
)

result = agent.run("Convert the Python scraper to TypeScript")
```

### 2. With OpenAI Assistants

```javascript
const assistant = await openai.beta.assistants.create({
  name: "Code Converter",
  tools: [{
    type: "mcp",
    mcp: {
      server: "claude-code",
      tools: ["convert_code", "enhance_automation"]
    }
  }]
});
```

### 3. Multi-Agent Systems

```typescript
// Specialized agents for different tasks
const conversionAgent = new ClaudeCodeAgent('conversion');
const testingAgent = new ClaudeCodeAgent('testing');
const deploymentAgent = new ClaudeCodeAgent('deployment');

// Orchestrate workflow
await conversionAgent.convertCode(sourceFile);
await testingAgent.generateTests(sessionId);
await deploymentAgent.createPR(sessionId);
```

## Advanced Configuration

### Session Pool Settings

```javascript
{
  "mcpServers": {
    "claude-code": {
      "env": {
        "MCP_MAX_SESSIONS": "10",     // Max concurrent sessions
        "MCP_POOL_SIZE": "5",          // Session pool size
        "MCP_TIMEOUT": "60000"         // Request timeout (ms)
      }
    }
  }
}
```

### Rate Limiting

```javascript
{
  "mcpServers": {
    "claude-code": {
      "env": {
        "MCP_RATE_LIMIT_MESSAGES": "30",  // Messages per minute
        "MCP_RATE_LIMIT_SESSIONS": "10",  // Sessions per hour
        "MCP_BACKOFF_MULTIPLIER": "2"     // Exponential backoff
      }
    }
  }
}
```

### Debug Mode

```javascript
{
  "mcpServers": {
    "claude-code": {
      "env": {
        "MCP_DEBUG": "true",
        "MCP_LOG_LEVEL": "verbose",
        "MCP_LOG_FILE": "./logs/mcp.log"
      }
    }
  }
}
```

## Best Practices

### 1. Session Management
- Initialize once per workflow
- Reuse sessions for related tasks
- Close sessions when done to free resources

### 2. Error Handling
- Tools return structured errors
- Implement retry logic for transient failures
- Check rate limits before batch operations

### 3. Performance
- Use batch_process for multiple tasks
- Enable parallel processing when possible
- Cache authentication tokens

### 4. Security
- Store API keys in environment variables
- Use headless mode in production
- Implement proper authentication

## Troubleshooting

### Common Issues

**MCP server not appearing in Claude Desktop:**
- Check the path is absolute in config
- Verify Node.js is in PATH
- Check logs: `~/Library/Logs/Claude/mcp-*.log`

**Authentication failures:**
- Ensure OAuth is enabled in config
- Check CAPTCHA solver API key
- Try manual authentication first

**Rate limiting:**
- Reduce MCP_MAX_SESSIONS
- Increase delays between requests
- Use session pooling

**Browser crashes:**
- Increase system memory
- Reduce concurrent sessions
- Enable headless mode

### Debug Commands

```bash
# Test MCP server directly
node dist/claude-code-mcp-server.js

# Check MCP communication
MCP_DEBUG=true node dist/claude-code-mcp-server.js

# Validate configuration
npx @modelcontextprotocol/cli validate mcp.json
```

## Performance Comparison

| Approach | Speed | Reliability | AI Integration | Resource Usage |
|----------|-------|-------------|----------------|----------------|
| Direct Browser | Slow | Medium | Manual | High |
| API Extraction | Fast | High | Manual | Low |
| **MCP Server** | **Fast** | **High** | **Native** | **Medium** |

## Migration Guide

### From Direct Automation

```typescript
// Before (Direct)
const automation = new ClaudeCodeAutomation();
await automation.initialize();
await automation.createSession(prompt);

// After (MCP)
await client.callTool('initialize_claude_code', {});
await client.callTool('create_code_session', { prompt });
```

### From API Calls

```typescript
// Before (API)
const response = await fetch('/api/claude/session', {
  method: 'POST',
  body: JSON.stringify({ prompt })
});

// After (MCP)
const result = await client.callTool('create_code_session', { 
  prompt 
});
```

## Resources

- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [Claude Desktop Documentation](https://claude.ai/docs)
- [Example Integrations](./examples/)
- [API Reference](./docs/api.md)

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review logs in MCP_LOG_FILE
3. Enable debug mode for detailed output
4. Create an issue with logs and configuration
