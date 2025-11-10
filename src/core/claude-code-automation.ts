import { Browser, BrowserContext, Page, chromium } from 'playwright';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import WebSocket from 'ws';

export interface ClaudeCodeConfig {
  headless?: boolean;
  sessionPath?: string;
  timeout?: number;
  captchaSolver?: CaptchaSolverInterface;
  debugMode?: boolean;
}

export interface CaptchaSolverInterface {
  solve(page: Page): Promise<void>;
}

export interface CodeSession {
  id: string;
  name: string;
  lastModified: Date;
  language?: string;
  files?: string[];
}

export interface PullRequest {
  title: string;
  description: string;
  branch: string;
  files: FileChange[];
}

export interface FileChange {
  path: string;
  content: string;
  action: 'create' | 'modify' | 'delete';
}

/**
 * Main automation class for Claude Code web interface
 */
export class ClaudeCodeAutomation extends EventEmitter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: ClaudeCodeConfig;
  private isAuthenticated: boolean = false;
  private sessionData: any = null;

  constructor(config: ClaudeCodeConfig = {}) {
    super();
    this.config = {
      headless: true,
      sessionPath: './claude-session',
      timeout: 30000,
      debugMode: false,
      ...config
    };
  }

  /**
   * Initialize browser and load saved session if available
   */
  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=site-per-process',
        '--window-size=1920,1080'
      ]
    });

    // Load saved session if exists
    const sessionExists = await this.loadSession();
    
    if (!sessionExists) {
      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });
    }

    this.page = await this.context!.newPage();
    
    // Setup request/response interceptors for debugging
    if (this.config.debugMode) {
      this.setupDebugInterceptors();
    }

    // Setup mutation observer injection
    await this.injectMutationObserver();
  }

  /**
   * Inject mutation observer for dynamic content tracking
   */
  private async injectMutationObserver(): Promise<void> {
    await this.page?.addInitScript(() => {
      // Track DOM mutations for dynamic content
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            // Dispatch custom events for automation tracking
            window.dispatchEvent(new CustomEvent('claude-dom-change', {
              detail: {
                added: mutation.addedNodes.length,
                removed: mutation.removedNodes.length,
                target: mutation.target instanceof Element ? mutation.target.className : ''
              }
            }));
          }
        });
      });

      // Start observing when document is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        });
      } else {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    });
  }

  /**
   * Setup debug interceptors for API calls
   */
  private setupDebugInterceptors(): void {
    this.page?.on('request', (request) => {
      if (request.url().includes('api.claude.ai')) {
        console.log('API Request:', request.method(), request.url());
        if (request.postData()) {
          console.log('Request Body:', request.postData());
        }
      }
    });

    this.page?.on('response', async (response) => {
      if (response.url().includes('api.claude.ai')) {
        console.log('API Response:', response.status(), response.url());
        if (response.ok()) {
          try {
            const body = await response.json();
            console.log('Response Body:', JSON.stringify(body, null, 2));
          } catch (e) {
            // Not JSON response
          }
        }
      }
    });
  }

  /**
   * Authenticate with Claude Code
   */
  async authenticate(email?: string, password?: string): Promise<boolean> {
    if (!this.page) throw new Error('Browser not initialized');

    await this.page.goto('https://claude.ai/code', { waitUntil: 'networkidle' });

    // Check if already authenticated
    const isLoggedIn = await this.checkAuthStatus();
    if (isLoggedIn) {
      this.isAuthenticated = true;
      return true;
    }

    // OAuth flow detection
    const oauthButton = await this.page.$('button:has-text("Continue with Google"), button:has-text("Continue with GitHub")');
    
    if (oauthButton) {
      // Handle OAuth authentication
      await this.handleOAuthFlow();
    } else if (email && password) {
      // Handle traditional login
      await this.handleTraditionalLogin(email, password);
    } else {
      throw new Error('Authentication credentials required');
    }

    // Wait for successful authentication
    await this.page.waitForURL('**/code**', { timeout: 60000 });
    
    // Save session after successful auth
    await this.saveSession();
    this.isAuthenticated = true;
    
    return true;
  }

  /**
   * Handle OAuth authentication flow
   */
  private async handleOAuthFlow(): Promise<void> {
    // This would integrate with your existing OAuth automation
    // Could use your SWE-agent adapter approach
    this.emit('oauth-required', { page: this.page });
    
    // Wait for OAuth completion
    await this.page!.waitForURL('**/code**', { timeout: 120000 });
  }

  /**
   * Handle traditional email/password login
   */
  private async handleTraditionalLogin(email: string, password: string): Promise<void> {
    await this.page!.fill('input[type="email"]', email);
    await this.page!.press('input[type="email"]', 'Enter');
    
    await this.page!.waitForSelector('input[type="password"]', { state: 'visible' });
    await this.page!.fill('input[type="password"]', password);
    await this.page!.press('input[type="password"]', 'Enter');

    // Handle potential CAPTCHA
    if (this.config.captchaSolver) {
      const hasCaptcha = await this.page!.$('.captcha-container, iframe[src*="recaptcha"], iframe[src*="hcaptcha"]');
      if (hasCaptcha) {
        await this.config.captchaSolver.solve(this.page!);
      }
    }
  }

  /**
   * Check authentication status
   */
  private async checkAuthStatus(): Promise<boolean> {
    try {
      // Check for authenticated elements
      const authIndicators = await this.page!.$$eval(
        '[data-testid="user-menu"], [aria-label*="Account"], .user-avatar',
        elements => elements.length > 0
      );
      return authIndicators;
    } catch {
      return false;
    }
  }

  /**
   * Create a new code session/project
   */
  async createSession(prompt: string, options: { language?: string; files?: string[] } = {}): Promise<CodeSession> {
    if (!this.isAuthenticated) throw new Error('Not authenticated');

    // Navigate to new session
    await this.page!.goto('https://claude.ai/code/new', { waitUntil: 'networkidle' });

    // Wait for editor to load
    await this.page!.waitForSelector('[contenteditable="true"], textarea[aria-label*="prompt"]', { state: 'visible' });

    // Input the prompt
    const promptInput = await this.page!.$('[contenteditable="true"], textarea[aria-label*="prompt"]');
    await promptInput!.click();
    await promptInput!.fill(prompt);

    // Upload files if provided
    if (options.files && options.files.length > 0) {
      await this.uploadFiles(options.files);
    }

    // Submit the prompt
    await this.page!.keyboard.press('Enter');
    
    // Wait for response
    await this.waitForResponse();

    // Extract session details
    const sessionId = await this.extractSessionId();
    
    return {
      id: sessionId,
      name: prompt.substring(0, 50),
      lastModified: new Date(),
      language: options.language,
      files: options.files
    };
  }

  /**
   * Upload files to current session
   */
  private async uploadFiles(filePaths: string[]): Promise<void> {
    const fileInput = await this.page!.$('input[type="file"]');
    
    if (fileInput) {
      await fileInput.setInputFiles(filePaths);
    } else {
      // Alternative: drag and drop simulation
      for (const filePath of filePaths) {
        await this.simulateFileDragDrop(filePath);
      }
    }
  }

  /**
   * Simulate file drag and drop
   */
  private async simulateFileDragDrop(filePath: string): Promise<void> {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath);

    await this.page!.evaluate(({ content, name }) => {
      const dataTransfer = new DataTransfer();
      const file = new File([content], name, { type: 'text/plain' });
      dataTransfer.items.add(file);

      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer
      });

      const dropZone = document.querySelector('[data-testid="drop-zone"], .editor-container, main');
      dropZone?.dispatchEvent(dropEvent);
    }, { content: fileContent, name: fileName });
  }

  /**
   * Send a message/request in current session
   */
  async sendRequest(message: string): Promise<string> {
    if (!this.isAuthenticated) throw new Error('Not authenticated');

    const inputSelector = '[contenteditable="true"], textarea:not([disabled])';
    await this.page!.waitForSelector(inputSelector, { state: 'visible' });

    const input = await this.page!.$(inputSelector);
    await input!.click();
    await input!.fill(message);

    // Submit
    await this.page!.keyboard.press('Enter');

    // Wait for response
    const response = await this.waitForResponse();
    return response;
  }

  /**
   * Wait for and extract Claude's response
   */
  private async waitForResponse(): Promise<string> {
    // Wait for streaming to complete
    await this.page!.waitForFunction(
      () => {
        const streamingIndicators = document.querySelectorAll('.typing-indicator, .loading-dots, [data-testid="streaming"]');
        return streamingIndicators.length === 0;
      },
      { timeout: this.config.timeout }
    );

    // Extract response text
    const response = await this.page!.evaluate(() => {
      const messages = Array.from(document.querySelectorAll('[data-testid="message"], .message-content'));
      const lastMessage = messages[messages.length - 1];
      return lastMessage?.textContent || '';
    });

    return response;
  }

  /**
   * Extract current session ID from URL or DOM
   */
  private async extractSessionId(): Promise<string> {
    const url = this.page!.url();
    const match = url.match(/\/code\/([a-zA-Z0-9-]+)/);
    
    if (match) {
      return match[1];
    }

    // Fallback: extract from DOM
    const sessionId = await this.page!.evaluate(() => {
      const meta = document.querySelector('meta[name="session-id"]');
      return meta?.getAttribute('content') || '';
    });

    return sessionId || `session-${Date.now()}`;
  }

  /**
   * Update existing code in the editor
   */
  async updateCode(filePath: string, newContent: string): Promise<void> {
    // Navigate to file in editor
    await this.page!.click(`[data-filepath="${filePath}"], [title="${filePath}"]`);
    
    // Wait for editor to load
    await this.page!.waitForSelector('.editor-content, .monaco-editor', { state: 'visible' });

    // Clear and update content
    await this.page!.keyboard.press('Control+A');
    await this.page!.keyboard.type(newContent);
  }

  /**
   * Create and submit a pull request
   */
  async submitPullRequest(pr: PullRequest): Promise<string> {
    // Look for PR/submit button
    const submitButton = await this.page!.$('button:has-text("Submit"), button:has-text("Create PR"), button:has-text("Pull Request")');
    
    if (!submitButton) {
      // Use chat to request PR creation
      await this.sendRequest(`Create a pull request with title: "${pr.title}" and description: "${pr.description}"`);
    } else {
      await submitButton.click();
      
      // Fill PR form
      await this.page!.fill('input[name="title"], input[placeholder*="Title"]', pr.title);
      await this.page!.fill('textarea[name="description"], textarea[placeholder*="Description"]', pr.description);
      
      // Submit PR
      await this.page!.click('button[type="submit"], button:has-text("Create")');
    }

    // Wait for PR URL
    await this.page!.waitForURL('**/pull/**', { timeout: 30000 });
    return this.page!.url();
  }

  /**
   * Get current session state
   */
  async getSessionState(): Promise<any> {
    return await this.page!.evaluate(() => {
      return {
        files: Array.from(document.querySelectorAll('[data-testid="file-tree-item"]')).map(el => el.textContent),
        activeFile: document.querySelector('[data-testid="active-file"]')?.textContent,
        hasUnsavedChanges: document.querySelector('[data-testid="unsaved-indicator"]') !== null,
        sessionId: window.location.pathname.split('/').pop()
      };
    });
  }

  /**
   * Save browser session for reuse
   */
  private async saveSession(): Promise<void> {
    if (!this.context) return;

    const cookies = await this.context.cookies();
    const localStorage = await this.page!.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) items[key] = window.localStorage.getItem(key) || '';
      }
      return items;
    });

    const sessionData = { cookies, localStorage };
    await fs.writeFile(this.config.sessionPath!, JSON.stringify(sessionData, null, 2));
  }

  /**
   * Load saved browser session
   */
  private async loadSession(): Promise<boolean> {
    try {
      const sessionData = await fs.readFile(this.config.sessionPath!, 'utf-8');
      const { cookies, localStorage } = JSON.parse(sessionData);

      this.context = await this.browser!.newContext();
      await this.context.addCookies(cookies);

      // Restore localStorage after page load
      this.sessionData = { localStorage };
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute custom JavaScript in the page context
   */
  async executeScript<T>(script: string, args?: any): Promise<T> {
    return await this.page!.evaluate(script, args);
  }

  /**
   * Take screenshot of current state
   */
  async screenshot(path: string): Promise<void> {
    await this.page!.screenshot({ path, fullPage: true });
  }

  /**
   * Close browser and cleanup
   */
  async close(): Promise<void> {
    await this.saveSession();
    await this.page?.close();
    await this.context?.close();
    await this.browser?.close();
  }
}

/**
 * Example CAPTCHA solver implementation
 */
export class TwoCaptchaSolver implements CaptchaSolverInterface {
  constructor(private apiKey: string) {}

  async solve(page: Page): Promise<void> {
    // Extract site key
    const siteKey = await page.evaluate(() => {
      const recaptcha = document.querySelector('[data-sitekey]');
      return recaptcha?.getAttribute('data-sitekey') || '';
    });

    if (siteKey) {
      // Your existing 2captcha integration
      console.log('Solving CAPTCHA with site key:', siteKey);
      // ... implementation
    }
  }
}

/**
 * WebSocket monitor for real-time updates
 */
export class ClaudeWebSocketMonitor {
  private ws: WebSocket | null = null;

  async connect(sessionId: string, authToken: string): Promise<void> {
    const wsUrl = `wss://claude.ai/ws/code/${sessionId}`;
    
    this.ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Origin': 'https://claude.ai'
      }
    });

    this.ws.on('message', (data: Buffer) => {
      const message = JSON.parse(data.toString());
      this.handleMessage(message);
    });
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'code-update':
        console.log('Code updated:', message.payload);
        break;
      case 'execution-result':
        console.log('Execution result:', message.payload);
        break;
      case 'error':
        console.error('Error:', message.payload);
        break;
    }
  }

  close(): void {
    this.ws?.close();
  }
}
