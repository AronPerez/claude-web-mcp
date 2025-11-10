/**
 * Example AI Agent using Claude Code MCP Server
 * Shows how an agentic AI system can leverage Claude Code programmatically
 */

import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { spawn } from 'node:child_process';

/**
 * AI Agent that uses Claude Code MCP Server for code generation tasks
 */
class ClaudeCodeAgent {
  protected client: Client;
  private serverProcess: any;

  constructor() {
    this.client = new Client(
      {
        name: 'claude-code-agent',
        version: '1.0.0',
      },
      {
        capabilities: {}
      }
    );
  }

  /**
   * Start the MCP server and connect
   */
  async connect(): Promise<void> {
    // Spawn the MCP server process
    this.serverProcess = spawn('node', ['dist/claude-code-mcp-server.js'], {
      env: {
        ...process.env,
        MCP_HEADLESS: 'true',
        MCP_DEBUG: 'false'
      }
    });

    const transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/claude-code-mcp-server.js']
    });

    await this.client.connect(transport);
    console.log('Connected to Claude Code MCP Server');
  }

  /**
   * Initialize Claude Code automation
   */
  async initialize(): Promise<void> {
    const result = await this.client.callTool({
      name: 'initialize_claude_code',
      arguments: {
        headless: true,
        useOAuth: true
      }
    });
    console.log('Initialized:', result);
  }

  /**
   * Agent workflow: Convert Python to TypeScript
   */
  async convertPythonToTypeScript(pythonFile: string): Promise<string> {
    console.log(`🔄 Converting ${pythonFile} to TypeScript...`);

    // Create conversion session
    const sessionResult = await this.client.callTool({
      name: 'convert_code',
      arguments: {
        sourceFile: pythonFile,
        targetLanguage: 'typescript',
        requirements: [
          'Use modern TypeScript with strict typing',
          'Include comprehensive error handling',
          'Add JSDoc comments',
          'Use async/await for asynchronous operations',
          'Follow ESLint/Prettier standards'
        ]
      }
    });

    const session = JSON.parse((sessionResult.content as Array<{text: string}>)[0].text);
    console.log('Session created:', session.sessionId);

    // Enhance with specific capabilities
    await this.client.callTool({
      name: 'enhance_automation',
      arguments: {
        files: [],
        enhancements: [
          'error-handling',
          'rate-limiting',
          'session-management'
        ],
        customRequirements: 'Add retry logic with exponential backoff for all network requests'
      }
    });

    // Generate tests
    await this.client.callTool({
      name: 'generate_tests',
      arguments: {
        sessionId: session.sessionId,
        testFramework: 'jest',
        coverage: ['unit', 'integration']
      }
    });

    // Extract the generated code
    const codeResult = await this.client.callTool({
      name: 'extract_generated_code',
      arguments: {
        sessionId: session.sessionId,
        format: 'files'
      }
    });

    return session.sessionId;
  }

  /**
   * Agent workflow: Fix and enhance job automation
   */
  async enhanceJobAutomation(files: string[]): Promise<void> {
    console.log('🚀 Enhancing job automation...');

    // Create enhancement session
    const result = await this.client.callTool({
      name: 'enhance_automation',
      arguments: {
        files: files,
        enhancements: [
          'captcha-solving',
          'oauth-integration',
          'mutation-observers',
          'api-extraction'
        ],
        customRequirements: `
          - Detect ATS platforms (Greenhouse, Workday, Lever) automatically
          - Use Claude for answer generation when available
          - Track success rates and generate reports
          - Handle multi-step application flows
        `
      }
    });

    console.log('Enhancement complete:', result);
  }

  /**
   * Agent workflow: Batch code quality improvements
   */
  async batchImproveCodeQuality(projects: Array<{name: string, files: string[]}>): Promise<void> {
    console.log('📦 Batch improving code quality...');

    const tasks = projects.map(project => ({
      type: 'enhance',
      prompt: `Improve code quality for ${project.name}: add error handling, types, tests, and documentation`,
      files: project.files
    }));

    const result = await this.client.callTool({
      name: 'batch_process',
      arguments: {
        tasks: tasks,
        parallel: true,
        maxConcurrency: 3
      }
    });

    const batchResult = JSON.parse((result.content as Array<{text: string}>)[0].text);
    console.log(`Processed ${batchResult.processed} projects`);

    // Analyze quality of each result
    for (const sessionResult of batchResult.results) {
      await this.client.callTool({
        name: 'analyze_code_quality',
        arguments: {
          sessionId: sessionResult.sessionId,
          checks: ['security', 'performance', 'maintainability'],
          autoFix: true
        }
      });
    }
  }

  /**
   * Agent workflow: Create comprehensive automation suite
   */
  async createAutomationSuite(requirements: string): Promise<void> {
    console.log('🤖 Creating automation suite...');

    // Create main automation framework
    const mainSession = await this.client.callTool({
      name: 'create_code_session',
      arguments: {
        prompt: requirements,
        language: 'typescript',
        requirements: [
          'Modular architecture with plugins',
          'Event-driven design',
          'Comprehensive logging',
          'Error recovery mechanisms'
        ]
      }
    });

    const session = JSON.parse((mainSession.content as Array<{text: string}>)[0].text);

    // Add CAPTCHA solving module
    await this.client.callTool({
      name: 'send_code_request',
      arguments: {
        message: 'Add a CAPTCHA detection and solving module with support for reCAPTCHA, hCaptcha, and FunCaptcha',
        sessionId: session.sessionId
      }
    });

    // Add rate limiting
    await this.client.callTool({
      name: 'send_code_request',
      arguments: {
        message: 'Implement intelligent rate limiting with per-endpoint tracking and exponential backoff',
        sessionId: session.sessionId
      }
    });

    // Add monitoring
    await this.client.callTool({
      name: 'send_code_request',
      arguments: {
        message: 'Add Prometheus metrics and Grafana dashboard configuration for monitoring',
        sessionId: session.sessionId
      }
    });

    // Generate comprehensive tests
    await this.client.callTool({
      name: 'generate_tests',
      arguments: {
        sessionId: session.sessionId,
        testFramework: 'jest',
        coverage: ['unit', 'integration', 'e2e']
      }
    });

    // Create pull request
    await this.client.callTool({
      name: 'create_pull_request',
      arguments: {
        title: 'feat: Comprehensive automation suite',
        description: 'Implements modular automation framework with CAPTCHA solving, rate limiting, and monitoring',
        branch: 'feature/automation-suite',
        sessionId: session.sessionId
      }
    });

    console.log('✅ Automation suite created');
  }

  /**
   * Agent decision-making: Choose best approach for task
   */
  async intelligentTaskRouter(task: string): Promise<void> {
    console.log('🧠 Analyzing task and choosing approach...');

    // Analyze task complexity
    const keywords = task.toLowerCase();

    if (keywords.includes('convert') || keywords.includes('migrate')) {
      // Use conversion workflow
      console.log('→ Using code conversion workflow');
      await this.client.callTool({
        name: 'convert_code',
        arguments: {
          sourceFile: 'auto-detect',
          targetLanguage: 'typescript'
        }
      });
    } else if (keywords.includes('fix') || keywords.includes('bug')) {
      // Use fix workflow
      console.log('→ Using bug fix workflow');
      await this.client.callTool({
        name: 'create_code_session',
        arguments: {
          prompt: `Fix issues: ${task}`,
          requirements: ['Add tests for the fix', 'Document the changes']
        }
      });
    } else if (keywords.includes('test')) {
      // Generate tests
      console.log('→ Using test generation workflow');
      await this.client.callTool({
        name: 'generate_tests',
        arguments: {
          testFramework: 'jest',
          coverage: ['unit', 'integration']
        }
      });
    } else if (keywords.includes('enhance') || keywords.includes('improve')) {
      // Enhancement workflow
      console.log('→ Using enhancement workflow');
      await this.client.callTool({
        name: 'enhance_automation',
        arguments: {
          files: [],
          enhancements: ['error-handling', 'performance'],
          customRequirements: task
        }
      });
    } else {
      // General creation
      console.log('→ Using general creation workflow');
      await this.client.callTool({
        name: 'create_code_session',
        arguments: {
          prompt: task,
          language: 'typescript'
        }
      });
    }
  }

  /**
   * Close connection and cleanup
   */
  async disconnect(): Promise<void> {
    await this.client.callTool({
      name: 'close_session',
      arguments: {
        saveState: true
      }
    });

    await this.client.close();

    if (this.serverProcess) {
      this.serverProcess.kill();
    }
  }

  /**
   * Public helper: Generate tests for a session
   */
  async generateTests(sessionId: string, testFramework: string, coverage: string[]): Promise<void> {
    await this.client.callTool({
      name: 'generate_tests',
      arguments: {
        sessionId,
        testFramework,
        coverage
      }
    });
  }

  /**
   * Public helper: Send a code request to a session
   */
  async sendCodeRequest(message: string, sessionId: string): Promise<void> {
    await this.client.callTool({
      name: 'send_code_request',
      arguments: {
        message,
        sessionId
      }
    });
  }
}

/**
 * Example orchestrator that coordinates multiple agents
 */
class MultiAgentOrchestrator {
  private agents: Map<string, ClaudeCodeAgent> = new Map();

  /**
   * Create specialized agents for different tasks
   */
  async initializeAgents(): Promise<void> {
    // Agent for code conversion
    const conversionAgent = new ClaudeCodeAgent();
    await conversionAgent.connect();
    await conversionAgent.initialize();
    this.agents.set('conversion', conversionAgent);

    // Agent for testing
    const testingAgent = new ClaudeCodeAgent();
    await testingAgent.connect();
    await testingAgent.initialize();
    this.agents.set('testing', testingAgent);

    // Agent for documentation
    const docAgent = new ClaudeCodeAgent();
    await docAgent.connect();
    await docAgent.initialize();
    this.agents.set('documentation', docAgent);
  }

  /**
   * Coordinate agents for complex workflows
   */
  async executeComplexWorkflow(project: any): Promise<void> {
    console.log('🎭 Orchestrating multi-agent workflow...');

    // Step 1: Conversion agent converts code
    const conversionAgent = this.agents.get('conversion')!;
    const sessionId = await conversionAgent.convertPythonToTypeScript(project.sourceFile);

    // Step 2: Testing agent generates tests
    const testingAgent = this.agents.get('testing')!;
    await testingAgent.generateTests(sessionId, 'jest', ['unit', 'integration', 'e2e']);

    // Step 3: Documentation agent creates docs
    const docAgent = this.agents.get('documentation')!;
    await docAgent.sendCodeRequest('Generate comprehensive API documentation and README', sessionId);

    console.log('✅ Multi-agent workflow complete');
  }

  /**
   * Cleanup all agents
   */
  async cleanup(): Promise<void> {
    for (const agent of this.agents.values()) {
      await agent.disconnect();
    }
  }
}

// Example usage patterns for AI agents
async function demonstrateAIAgentUsage() {
  console.log('🚀 Claude Code MCP Server - AI Agent Examples\n');

  const agent = new ClaudeCodeAgent();

  try {
    // Connect to MCP server
    await agent.connect();
    await agent.initialize();

    // Example 1: Convert Python scraper to TypeScript
    console.log('\n📌 Example 1: Python to TypeScript Conversion');
    await agent.convertPythonToTypeScript('./examples/scraper.py');

    // Example 2: Enhance job automation
    console.log('\n📌 Example 2: Enhance Job Automation');
    await agent.enhanceJobAutomation([
      './job-automation/greenhouse.ts',
      './job-automation/workday.ts'
    ]);

    // Example 3: Batch quality improvements
    console.log('\n📌 Example 3: Batch Quality Improvements');
    await agent.batchImproveCodeQuality([
      { name: 'API Server', files: ['./api/server.ts'] },
      { name: 'Frontend', files: ['./frontend/app.tsx'] },
      { name: 'Worker', files: ['./worker/processor.ts'] }
    ]);

    // Example 4: Create automation suite
    console.log('\n📌 Example 4: Create Automation Suite');
    await agent.createAutomationSuite(
      'Create a comprehensive web scraping and automation framework with browser automation, API extraction, and data processing capabilities'
    );

    // Example 5: Intelligent task routing
    console.log('\n📌 Example 5: Intelligent Task Routing');
    await agent.intelligentTaskRouter('Fix the memory leak in the websocket handler and add proper cleanup');

  } catch (error) {
    console.error('Agent error:', error);
  } finally {
    await agent.disconnect();
  }
}

// Multi-agent orchestration example
async function demonstrateMultiAgentOrchestration() {
  console.log('\n🎭 Multi-Agent Orchestration Example\n');

  const orchestrator = new MultiAgentOrchestrator();

  try {
    await orchestrator.initializeAgents();

    await orchestrator.executeComplexWorkflow({
      sourceFile: './legacy/old_system.py',
      targetLanguage: 'typescript',
      requirements: ['microservices', 'docker', 'kubernetes']
    });

  } finally {
    await orchestrator.cleanup();
  }
}

// Export for use by other AI systems
export {
  ClaudeCodeAgent,
  MultiAgentOrchestrator,
  demonstrateAIAgentUsage,
  demonstrateMultiAgentOrchestration
};

// Run examples if executed directly
if (require.main === module) {
  (async () => {
    await demonstrateAIAgentUsage();
    await demonstrateMultiAgentOrchestration();
  })().catch(console.error);
}
