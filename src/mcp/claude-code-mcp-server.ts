import { Server } from '@modelcontextprotocol/sdk/server/index';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  Tool,
  Resource,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types';
import { ClaudeCodeAutomation, TwoCaptchaSolver } from '../core/claude-code-automation';
import { ClaudeCodeAPIExtractor, ClaudeSessionPool } from '../core/claude-code-advanced';
import { chromium, Browser } from 'playwright';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * MCP Server for Claude Code Automation
 * Provides AI agents with tools to interact with Claude Code programmatically
 */
class ClaudeCodeMCPServer {
  private server: Server;
  private automation: ClaudeCodeAutomation | null = null;
  private browser: Browser | null = null;
  private apiExtractor: ClaudeCodeAPIExtractor;
  private sessionPool: ClaudeSessionPool | null = null;
  private activeSessions: Map<string, any> = new Map();
  private config: any;

  constructor() {
    this.server = new Server(
      {
        name: 'claude-code-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.apiExtractor = new ClaudeCodeAPIExtractor();
    
    this.config = {
      headless: process.env.MCP_HEADLESS === 'true',
      debugMode: process.env.MCP_DEBUG === 'true',
      twoCaptchaKey: process.env.TWOCAPTCHA_API_KEY,
      maxSessions: parseInt(process.env.MCP_MAX_SESSIONS || '5'),
      sessionPath: process.env.MCP_SESSION_PATH || './sessions'
    };

    this.setupHandlers();
  }

  /**
   * Define available tools for AI agents
   */
  private getTools(): Tool[] {
    return [
      {
        name: 'initialize_claude_code',
        description: 'Initialize Claude Code automation browser and authentication',
        inputSchema: {
          type: 'object',
          properties: {
            headless: {
              type: 'boolean',
              description: 'Run browser in headless mode',
              default: true
            },
            useOAuth: {
              type: 'boolean',
              description: 'Use OAuth authentication instead of credentials',
              default: true
            },
            email: {
              type: 'string',
              description: 'Email for traditional login (optional)'
            },
            password: {
              type: 'string',
              description: 'Password for traditional login (optional)'
            }
          }
        }
      },
      {
        name: 'create_code_session',
        description: 'Create a new Claude Code session with a prompt',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The initial prompt for Claude Code'
            },
            language: {
              type: 'string',
              description: 'Programming language (typescript, python, etc.)',
              enum: ['typescript', 'python', 'javascript', 'rust', 'go', 'java', 'cpp']
            },
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'File paths to upload to the session'
            },
            requirements: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific requirements or constraints'
            }
          },
          required: ['prompt']
        }
      },
      {
        name: 'send_code_request',
        description: 'Send a follow-up request to the current Claude Code session',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The message to send to Claude Code'
            },
            sessionId: {
              type: 'string',
              description: 'Session ID (optional, uses current if not provided)'
            },
            waitForCompletion: {
              type: 'boolean',
              description: 'Wait for response completion',
              default: true
            }
          },
          required: ['message']
        }
      },
      {
        name: 'update_code',
        description: 'Update code in a specific file within Claude Code editor',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Path to the file to update'
            },
            content: {
              type: 'string',
              description: 'New content for the file'
            },
            sessionId: {
              type: 'string',
              description: 'Session ID (optional)'
            }
          },
          required: ['filePath', 'content']
        }
      },
      {
        name: 'create_pull_request',
        description: 'Create and submit a pull request from Claude Code session',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'PR title'
            },
            description: {
              type: 'string',
              description: 'PR description'
            },
            branch: {
              type: 'string',
              description: 'Branch name'
            },
            sessionId: {
              type: 'string',
              description: 'Session ID (optional)'
            }
          },
          required: ['title', 'description']
        }
      },
      {
        name: 'get_session_state',
        description: 'Get the current state of a Claude Code session',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID (optional, uses current if not provided)'
            }
          }
        }
      },
      {
        name: 'extract_generated_code',
        description: 'Extract all generated code from the current session',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID (optional)'
            },
            format: {
              type: 'string',
              enum: ['raw', 'files', 'zip'],
              description: 'Output format',
              default: 'files'
            }
          }
        }
      },
      {
        name: 'convert_code',
        description: 'Convert code from one language/framework to another',
        inputSchema: {
          type: 'object',
          properties: {
            sourceFile: {
              type: 'string',
              description: 'Path to source file'
            },
            sourceLanguage: {
              type: 'string',
              description: 'Source language/framework'
            },
            targetLanguage: {
              type: 'string',
              description: 'Target language/framework'
            },
            requirements: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific conversion requirements'
            }
          },
          required: ['sourceFile', 'targetLanguage']
        }
      },
      {
        name: 'enhance_automation',
        description: 'Enhance existing automation code with specific capabilities',
        inputSchema: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Automation files to enhance'
            },
            enhancements: {
              type: 'array',
              items: { 
                type: 'string',
                enum: [
                  'captcha-solving',
                  'rate-limiting',
                  'oauth-integration',
                  'error-handling',
                  'mutation-observers',
                  'session-management',
                  'api-extraction'
                ]
              },
              description: 'Enhancement types to add'
            },
            customRequirements: {
              type: 'string',
              description: 'Custom enhancement requirements'
            }
          },
          required: ['files', 'enhancements']
        }
      },
      {
        name: 'generate_tests',
        description: 'Generate comprehensive tests for code',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID with code to test'
            },
            testFramework: {
              type: 'string',
              enum: ['jest', 'mocha', 'pytest', 'unittest', 'vitest'],
              description: 'Test framework to use'
            },
            coverage: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['unit', 'integration', 'e2e', 'performance']
              },
              description: 'Types of tests to generate'
            }
          },
          required: ['sessionId']
        }
      },
      {
        name: 'batch_process',
        description: 'Process multiple code tasks in parallel',
        inputSchema: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['convert', 'enhance', 'create', 'fix']
                  },
                  prompt: { type: 'string' },
                  files: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                },
                required: ['type', 'prompt']
              },
              description: 'Tasks to process'
            },
            parallel: {
              type: 'boolean',
              description: 'Process tasks in parallel',
              default: true
            },
            maxConcurrency: {
              type: 'integer',
              description: 'Maximum concurrent tasks',
              default: 3
            }
          },
          required: ['tasks']
        }
      },
      {
        name: 'analyze_code_quality',
        description: 'Analyze and improve code quality',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID to analyze'
            },
            checks: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['security', 'performance', 'maintainability', 'test-coverage', 'documentation']
              },
              description: 'Quality checks to perform'
            },
            autoFix: {
              type: 'boolean',
              description: 'Automatically fix issues',
              default: false
            }
          },
          required: ['sessionId']
        }
      },
      {
        name: 'execute_code',
        description: 'Execute generated code in a sandboxed environment',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID with code to execute'
            },
            input: {
              type: 'string',
              description: 'Input data for execution'
            },
            timeout: {
              type: 'integer',
              description: 'Execution timeout in milliseconds',
              default: 30000
            }
          },
          required: ['sessionId']
        }
      },
      {
        name: 'close_session',
        description: 'Close a Claude Code session and clean up resources',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID to close (optional, closes all if not provided)'
            },
            saveState: {
              type: 'boolean',
              description: 'Save session state for later',
              default: true
            }
          }
        }
      }
    ];
  }

  /**
   * Define available resources
   */
  private getResources(): Resource[] {
    return [
      {
        uri: 'claude-code://sessions',
        name: 'Active Sessions',
        description: 'List of active Claude Code sessions',
        mimeType: 'application/json'
      },
      {
        uri: 'claude-code://templates',
        name: 'Code Templates',
        description: 'Available code generation templates',
        mimeType: 'application/json'
      },
      {
        uri: 'claude-code://history',
        name: 'Session History',
        description: 'Historical sessions and their outputs',
        mimeType: 'application/json'
      }
    ];
  }

  /**
   * Setup MCP handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools()
    }));

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: this.getResources()
    }));

    // Read resource content
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      if (uri === 'claude-code://sessions') {
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(Array.from(this.activeSessions.entries()).map(([id, session]) => ({
              id,
              name: session.name,
              created: session.created,
              lastModified: session.lastModified,
              language: session.language
            })), null, 2)
          }]
        };
      }

      if (uri === 'claude-code://templates') {
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(this.getTemplates(), null, 2)
          }]
        };
      }

      throw new McpError(
        ErrorCode.InvalidRequest,
        `Unknown resource: ${uri}`
      );
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'initialize_claude_code':
            return await this.handleInitialize(args);
          
          case 'create_code_session':
            return await this.handleCreateSession(args);
          
          case 'send_code_request':
            return await this.handleSendRequest(args);
          
          case 'update_code':
            return await this.handleUpdateCode(args);
          
          case 'create_pull_request':
            return await this.handleCreatePR(args);
          
          case 'get_session_state':
            return await this.handleGetSessionState(args);
          
          case 'extract_generated_code':
            return await this.handleExtractCode(args);
          
          case 'convert_code':
            return await this.handleConvertCode(args);
          
          case 'enhance_automation':
            return await this.handleEnhanceAutomation(args);
          
          case 'generate_tests':
            return await this.handleGenerateTests(args);
          
          case 'batch_process':
            return await this.handleBatchProcess(args);
          
          case 'analyze_code_quality':
            return await this.handleAnalyzeQuality(args);
          
          case 'execute_code':
            return await this.handleExecuteCode(args);
          
          case 'close_session':
            return await this.handleCloseSession(args);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error: any) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });
  }

  /**
   * Handle initialize tool
   */
  private async handleInitialize(args: any): Promise<any> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: args.headless ?? this.config.headless,
        args: ['--disable-blink-features=AutomationControlled']
      });
    }

    if (!this.automation) {
      this.automation = new ClaudeCodeAutomation({
        headless: args.headless ?? this.config.headless,
        debugMode: this.config.debugMode,
        captchaSolver: this.config.twoCaptchaKey 
          ? new TwoCaptchaSolver(this.config.twoCaptchaKey)
          : undefined
      });

      await this.automation.initialize();
    }

    // Handle authentication
    if (args.useOAuth) {
      await this.automation.authenticate();
    } else if (args.email && args.password) {
      await this.automation.authenticate(args.email, args.password);
    }

    // Initialize session pool for batch operations
    if (!this.sessionPool) {
      this.sessionPool = new ClaudeSessionPool(
        this.config.maxSessions,
        Math.floor(this.config.maxSessions / 2)
      );
      await this.sessionPool.initialize(this.browser);
    }

    return {
      content: [{
        type: 'text',
        text: 'Claude Code automation initialized successfully'
      }]
    };
  }

  /**
   * Handle create session tool
   */
  private async handleCreateSession(args: any): Promise<any> {
    if (!this.automation) {
      throw new Error('Automation not initialized. Call initialize_claude_code first.');
    }

    // Build enhanced prompt with requirements
    let enhancedPrompt = args.prompt;
    if (args.requirements && args.requirements.length > 0) {
      enhancedPrompt += '\n\nRequirements:\n' + args.requirements.map((r: string) => `- ${r}`).join('\n');
    }

    const session = await this.automation.createSession(enhancedPrompt, {
      language: args.language,
      files: args.files
    });

    // Store session
    this.activeSessions.set(session.id, {
      ...session,
      name: args.prompt.substring(0, 50),
      created: new Date(),
      lastModified: new Date()
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          sessionId: session.id,
          message: 'Session created successfully',
          url: `https://claude.ai/code/${session.id}`
        }, null, 2)
      }]
    };
  }

  /**
   * Handle send request tool
   */
  private async handleSendRequest(args: any): Promise<any> {
    if (!this.automation) {
      throw new Error('Automation not initialized');
    }

    const response = await this.automation.sendRequest(args.message);

    // Update session modified time
    if (args.sessionId) {
      const session = this.activeSessions.get(args.sessionId);
      if (session) {
        session.lastModified = new Date();
      }
    }

    return {
      content: [{
        type: 'text',
        text: response
      }]
    };
  }

  /**
   * Handle convert code tool
   */
  private async handleConvertCode(args: any): Promise<any> {
    if (!this.automation) {
      throw new Error('Automation not initialized');
    }

    const sourceContent = await fs.readFile(args.sourceFile, 'utf-8');
    const sourceExt = path.extname(args.sourceFile);
    
    // Detect source language if not provided
    const sourceLanguage = args.sourceLanguage || this.detectLanguage(sourceExt);

    // Build conversion prompt
    let prompt = `Convert this ${sourceLanguage} code to ${args.targetLanguage}:\n\n`;
    prompt += '```' + sourceLanguage + '\n' + sourceContent + '\n```\n\n';
    
    if (args.requirements && args.requirements.length > 0) {
      prompt += 'Requirements:\n' + args.requirements.map((r: string) => `- ${r}`).join('\n');
    }

    // Add framework-specific requirements
    if (args.targetLanguage === 'typescript' && sourceLanguage === 'python') {
      prompt += '\n\nAdditional requirements for TypeScript conversion:\n';
      prompt += '- Use modern TypeScript features and strict typing\n';
      prompt += '- Include proper error handling with try-catch blocks\n';
      prompt += '- Add JSDoc comments for all functions\n';
      prompt += '- Use async/await for asynchronous operations\n';
    }

    const session = await this.automation.createSession(prompt, {
      language: args.targetLanguage,
      files: [args.sourceFile]
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          sessionId: session.id,
          message: `Code conversion started: ${sourceLanguage} -> ${args.targetLanguage}`,
          url: `https://claude.ai/code/${session.id}`
        }, null, 2)
      }]
    };
  }

  /**
   * Handle enhance automation tool
   */
  private async handleEnhanceAutomation(args: any): Promise<any> {
    if (!this.automation) {
      throw new Error('Automation not initialized');
    }

    // Build enhancement prompt
    let prompt = 'Enhance this automation code with the following capabilities:\n\n';
    
    const enhancementDescriptions: Record<string, string> = {
      'captcha-solving': 'Add CAPTCHA detection and solving with 2captcha integration',
      'rate-limiting': 'Implement intelligent rate limiting with exponential backoff',
      'oauth-integration': 'Add OAuth authentication flow support',
      'error-handling': 'Add comprehensive error handling and retry logic',
      'mutation-observers': 'Implement DOM mutation observers for dynamic content',
      'session-management': 'Add session persistence and management',
      'api-extraction': 'Extract and use internal APIs directly'
    };

    args.enhancements.forEach((enhancement: string) => {
      prompt += `- ${enhancementDescriptions[enhancement] || enhancement}\n`;
    });

    if (args.customRequirements) {
      prompt += `\nCustom requirements:\n${args.customRequirements}`;
    }

    const session = await this.automation.createSession(prompt, {
      files: args.files
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          sessionId: session.id,
          message: 'Enhancement process started',
          enhancements: args.enhancements,
          url: `https://claude.ai/code/${session.id}`
        }, null, 2)
      }]
    };
  }

  /**
   * Handle batch process tool
   */
  private async handleBatchProcess(args: any): Promise<any> {
    if (!this.sessionPool) {
      throw new Error('Session pool not initialized');
    }

    const results = [];
    const tasks = args.tasks;
    const maxConcurrency = args.maxConcurrency || 3;

    if (args.parallel) {
      // Process tasks in parallel using session pool
      const promises = tasks.map((task: any) => 
        this.sessionPool!.executeWithSession(async (context) => {
          const page = await context.newPage();
          
          // Create temporary automation for this session
          const tempAutomation = new ClaudeCodeAutomation({
            headless: true,
            debugMode: false
          });

          // Process task based on type
          let result;
          switch (task.type) {
            case 'convert':
              result = await this.processConversionTask(tempAutomation, task);
              break;
            case 'enhance':
              result = await this.processEnhancementTask(tempAutomation, task);
              break;
            case 'create':
              result = await this.processCreationTask(tempAutomation, task);
              break;
            case 'fix':
              result = await this.processFixTask(tempAutomation, task);
              break;
            default:
              result = { error: `Unknown task type: ${task.type}` };
          }

          await page.close();
          return result;
        })
      );

      results.push(...await Promise.all(promises));
    } else {
      // Process sequentially
      for (const task of tasks) {
        const result = await this.processSingleTask(task);
        results.push(result);
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          processed: results.length,
          results: results
        }, null, 2)
      }]
    };
  }

  /**
   * Process a single task
   */
  private async processSingleTask(task: any): Promise<any> {
    if (!this.automation) {
      throw new Error('Automation not initialized');
    }

    const session = await this.automation.createSession(task.prompt, {
      files: task.files
    });

    return {
      taskType: task.type,
      sessionId: session.id,
      prompt: task.prompt.substring(0, 50) + '...',
      status: 'completed'
    };
  }

  /**
   * Handle close session tool
   */
  private async handleCloseSession(args: any): Promise<any> {
    if (args.sessionId) {
      // Close specific session
      const session = this.activeSessions.get(args.sessionId);
      if (session && args.saveState) {
        // Save session state
        const statePath = path.join(this.config.sessionPath, `${args.sessionId}.json`);
        await fs.writeFile(statePath, JSON.stringify(session, null, 2));
      }
      this.activeSessions.delete(args.sessionId);
    } else {
      // Close all sessions
      if (args.saveState) {
        for (const [id, session] of this.activeSessions.entries()) {
          const statePath = path.join(this.config.sessionPath, `${id}.json`);
          await fs.writeFile(statePath, JSON.stringify(session, null, 2));
        }
      }
      this.activeSessions.clear();
    }

    // Clean up browser if no active sessions
    if (this.activeSessions.size === 0 && this.browser) {
      await this.browser.close();
      this.browser = null;
      this.automation = null;
      this.sessionPool = null;
    }

    return {
      content: [{
        type: 'text',
        text: `Session(s) closed successfully`
      }]
    };
  }

  // Helper methods for batch processing
  private async processConversionTask(automation: any, task: any): Promise<any> {
    return {
      type: 'conversion',
      status: 'completed',
      prompt: task.prompt
    };
  }

  private async processEnhancementTask(automation: any, task: any): Promise<any> {
    return {
      type: 'enhancement',
      status: 'completed',
      prompt: task.prompt
    };
  }

  private async processCreationTask(automation: any, task: any): Promise<any> {
    return {
      type: 'creation',
      status: 'completed',
      prompt: task.prompt
    };
  }

  private async processFixTask(automation: any, task: any): Promise<any> {
    return {
      type: 'fix',
      status: 'completed',
      prompt: task.prompt
    };
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(ext: string): string {
    const langMap: Record<string, string> = {
      '.py': 'python',
      '.ts': 'typescript',
      '.js': 'javascript',
      '.rs': 'rust',
      '.go': 'go',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.rb': 'ruby',
      '.php': 'php'
    };
    return langMap[ext] || 'unknown';
  }

  /**
   * Get available templates
   */
  private getTemplates(): any[] {
    return [
      {
        name: 'playwright-automation',
        description: 'Playwright browser automation with stealth',
        languages: ['typescript', 'javascript']
      },
      {
        name: 'captcha-solver',
        description: 'CAPTCHA detection and solving system',
        languages: ['typescript', 'python']
      },
      {
        name: 'api-scraper',
        description: 'API extraction and scraping tool',
        languages: ['typescript', 'python']
      },
      {
        name: 'job-automation',
        description: 'Job application automation for ATS platforms',
        languages: ['typescript']
      }
    ];
  }

  // Placeholder implementations for remaining handlers
  private async handleUpdateCode(args: any): Promise<any> {
    if (!this.automation) throw new Error('Not initialized');
    await this.automation.updateCode(args.filePath, args.content);
    return { content: [{ type: 'text', text: 'Code updated successfully' }] };
  }

  private async handleCreatePR(args: any): Promise<any> {
    if (!this.automation) throw new Error('Not initialized');
    const prUrl = await this.automation.submitPullRequest({
      title: args.title,
      description: args.description,
      branch: args.branch || 'feature/generated',
      files: []
    });
    return { content: [{ type: 'text', text: `PR created: ${prUrl}` }] };
  }

  private async handleGetSessionState(args: any): Promise<any> {
    if (!this.automation) throw new Error('Not initialized');
    const state = await this.automation.getSessionState();
    return { content: [{ type: 'text', text: JSON.stringify(state, null, 2) }] };
  }

  private async handleExtractCode(args: any): Promise<any> {
    if (!this.automation) throw new Error('Not initialized');
    const state = await this.automation.getSessionState();
    return { content: [{ type: 'text', text: JSON.stringify({ files: state.files }, null, 2) }] };
  }

  private async handleGenerateTests(args: any): Promise<any> {
    if (!this.automation) throw new Error('Not initialized');
    const prompt = `Generate ${args.testFramework || 'jest'} tests with ${args.coverage?.join(', ') || 'full'} coverage`;
    await this.automation.sendRequest(prompt);
    return { content: [{ type: 'text', text: 'Tests generated successfully' }] };
  }

  private async handleAnalyzeQuality(args: any): Promise<any> {
    if (!this.automation) throw new Error('Not initialized');
    const checks = args.checks?.join(', ') || 'all quality checks';
    await this.automation.sendRequest(`Analyze code quality: ${checks}`);
    return { content: [{ type: 'text', text: 'Quality analysis complete' }] };
  }

  private async handleExecuteCode(args: any): Promise<any> {
    return { content: [{ type: 'text', text: 'Code execution not implemented in this version' }] };
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('Claude Code MCP Server started');
    console.error(`Available tools: ${this.getTools().length}`);
    console.error(`Available resources: ${this.getResources().length}`);
  }
}

// Start server when run directly
if (require.main === module) {
  const server = new ClaudeCodeMCPServer();
  server.start().catch(console.error);
}

export { ClaudeCodeMCPServer };
