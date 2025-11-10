import { Browser, BrowserContext, Page } from 'playwright';
import { EventEmitter } from 'node:events';
import PQueue from 'p-queue';
import fetch from 'node-fetch';
import WebSocket from 'ws';

export class ClaudeCodeAPIExtractor {
  private apiEndpoints: Map<string, any> = new Map();
  private authHeaders: Record<string, string> = {};
  private sessionToken?: string;
  private organizationId?: string;

  /**
   * Check if session token is available
   */
  hasSessionToken(): boolean {
    return !!this.sessionToken;
  }

  /**
   * Extract API configuration from browser session
   */
  async extractFromBrowser(page: Page): Promise<void> {
    // Inject API interceptor
    await page.addInitScript(() => {
      // Store original fetch
      const originalFetch = window.fetch;
      
      // Override fetch to capture requests
      (window as any).fetch = async function(...args: any[]) {
        const [url, options] = args;
        
        // Store request details
        window.postMessage({
          type: 'api-request',
          url: url.toString(),
          method: options?.method || 'GET',
          headers: options?.headers || {},
          body: options?.body
        }, '*');

        // Call original fetch
        const response = await originalFetch.apply(window, args as [RequestInfo | URL, RequestInit?]);
        
        // Clone response to read it
        const cloned = response.clone();
        const body = await cloned.text();

        // Convert headers to object
        const headersObj: any = {};
        response.headers.forEach((value: string, key: string) => {
          headersObj[key] = value;
        });

        // Store response
        window.postMessage({
          type: 'api-response',
          url: url.toString(),
          status: response.status,
          headers: headersObj,
          body: body
        }, '*');

        return response;
      };

      // Also capture XMLHttpRequest
      const originalXHR = window.XMLHttpRequest;
      (window as any).XMLHttpRequest = function() {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;
        const originalSend = xhr.send;

        xhr.open = function(method: string, url: string, ...args: any[]) {
          (xhr as any)._url = url;
          (xhr as any)._method = method;
          return originalOpen.apply(xhr, [method, url, ...args] as any);
        };

        xhr.send = function(body?: any) {
          window.postMessage({
            type: 'xhr-request',
            url: (xhr as any)._url,
            method: (xhr as any)._method,
            body: body
          }, '*');

          return originalSend.call(xhr, body);
        };

        return xhr;
      };
    });

    // Listen for captured requests
    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data.type === 'api-request' || event.data.type === 'api-response') {
          console.log('API_CAPTURE:', JSON.stringify(event.data));
        }
      });
    });

    // Extract authentication details
    await this.extractAuthDetails(page);
  }

  /**
   * Extract authentication details from page
   */
  private async extractAuthDetails(page: Page): Promise<void> {
    const authData = await page.evaluate(() => {
      // Extract from localStorage
      const token = localStorage.getItem('claude_session_token') || 
                   localStorage.getItem('auth_token') ||
                   localStorage.getItem('access_token');

      // Extract from cookies
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);

      // Extract from session storage
      const sessionData = {
        organizationId: sessionStorage.getItem('organization_id'),
        workspaceId: sessionStorage.getItem('workspace_id'),
        userId: sessionStorage.getItem('user_id')
      };

      // Look for auth headers in fetch interceptor
      const authHeaders = (window as any).__capturedAuthHeaders || {};

      return {
        token,
        cookies,
        sessionData,
        authHeaders
      };
    });

    if (authData.token) {
      this.sessionToken = authData.token;
      this.authHeaders = {
        'Authorization': `Bearer ${authData.token}`,
        'X-Organization-Id': authData.sessionData.organizationId || '',
        'X-Workspace-Id': authData.sessionData.workspaceId || ''
      };
    }

    this.organizationId = authData.sessionData.organizationId || undefined;
  }

  /**
   * Make direct API request bypassing browser
   */
  async makeAPIRequest(endpoint: string, options: any = {}): Promise<any> {
    const url = `https://api.claude.ai${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.authHeaders,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create a new code session via API
   */
  async createSessionAPI(prompt: string): Promise<string> {
    const response = await this.makeAPIRequest('/v1/code/sessions', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        model: 'claude-sonnet-4-5',
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    return response.session_id;
  }

  /**
   * Send message to session via API
   */
  async sendMessageAPI(sessionId: string, message: string): Promise<any> {
    return this.makeAPIRequest(`/v1/code/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  }
}

/**
 * Session Pool Manager for handling multiple concurrent sessions
 */
export class ClaudeSessionPool extends EventEmitter {
  private sessions: Map<string, BrowserContext> = new Map();
  private availableSessions: string[] = [];
  private busySessions: Set<string> = new Set();
  private queue: PQueue;

  constructor(
    private maxSessions: number = 5,
    private maxConcurrency: number = 3
  ) {
    super();
    this.queue = new PQueue({ concurrency: maxConcurrency });
  }

  /**
   * Initialize session pool
   */
  async initialize(browser: Browser): Promise<void> {
    for (let i = 0; i < this.maxSessions; i++) {
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
      });
      
      const sessionId = `session-${i}`;
      this.sessions.set(sessionId, context);
      this.availableSessions.push(sessionId);
    }
  }

  /**
   * Acquire a session from pool
   */
  async acquireSession(): Promise<{ sessionId: string; context: BrowserContext }> {
    // Wait for available session
    while (this.availableSessions.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const sessionId = this.availableSessions.pop()!;
    this.busySessions.add(sessionId);

    return {
      sessionId,
      context: this.sessions.get(sessionId)!
    };
  }

  /**
   * Release session back to pool
   */
  releaseSession(sessionId: string): void {
    this.busySessions.delete(sessionId);
    this.availableSessions.push(sessionId);
    this.emit('session-available', sessionId);
  }

  /**
   * Execute task with automatic session management
   */
  async executeWithSession<T>(task: (context: BrowserContext) => Promise<T>): Promise<T> {
    return this.queue.add(async () => {
      const { sessionId, context } = await this.acquireSession();
      
      try {
        const result = await task(context);
        return result;
      } finally {
        this.releaseSession(sessionId);
      }
    });
  }

  /**
   * Close all sessions
   */
  async closeAll(): Promise<void> {
    for (const context of this.sessions.values()) {
      await context.close();
    }
    this.sessions.clear();
    this.availableSessions = [];
    this.busySessions.clear();
  }
}

/**
 * Rate Limit Handler with intelligent backoff
 */
export class RateLimitHandler {
  private requestCounts: Map<string, number> = new Map();
  private resetTimes: Map<string, number> = new Map();
  private backoffMultiplier = 1;

  /**
   * Check if request should be throttled
   */
  shouldThrottle(endpoint: string): boolean {
    const now = Date.now();
    const resetTime = this.resetTimes.get(endpoint) || 0;

    if (now > resetTime) {
      // Reset window expired
      this.requestCounts.set(endpoint, 0);
      this.resetTimes.set(endpoint, now + 60000); // 1 minute window
    }

    const count = this.requestCounts.get(endpoint) || 0;
    const limit = this.getRateLimit(endpoint);

    return count >= limit;
  }

  /**
   * Get rate limit for endpoint
   */
  private getRateLimit(endpoint: string): number {
    // Endpoint-specific limits
    if (endpoint.includes('/messages')) return 30;
    if (endpoint.includes('/sessions')) return 10;
    if (endpoint.includes('/compile')) return 5;
    return 50; // Default
  }

  /**
   * Record request
   */
  recordRequest(endpoint: string): void {
    const count = this.requestCounts.get(endpoint) || 0;
    this.requestCounts.set(endpoint, count + 1);
  }

  /**
   * Handle rate limit response
   */
  async handleRateLimitResponse(response: any): Promise<void> {
    const retryAfter = response.headers.get('Retry-After');
    const xRateLimitReset = response.headers.get('X-RateLimit-Reset');

    let waitTime = 60000; // Default 1 minute

    if (retryAfter) {
      waitTime = parseInt(retryAfter) * 1000;
    } else if (xRateLimitReset) {
      waitTime = parseInt(xRateLimitReset) - Date.now();
    }

    // Apply exponential backoff
    waitTime *= this.backoffMultiplier;
    this.backoffMultiplier = Math.min(this.backoffMultiplier * 2, 8);

    console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));

    // Reset backoff on successful wait
    this.backoffMultiplier = 1;
  }
}

/**
 * Claude Code Reverse Proxy
 * Routes requests through multiple sessions to avoid rate limits
 */
export class ClaudeCodeProxy {
  private sessionPool: ClaudeSessionPool;
  private rateLimiter: RateLimitHandler;
  private apiExtractor: ClaudeCodeAPIExtractor;

  constructor() {
    this.sessionPool = new ClaudeSessionPool(10, 5);
    this.rateLimiter = new RateLimitHandler();
    this.apiExtractor = new ClaudeCodeAPIExtractor();
  }

  /**
   * Initialize proxy with browser
   */
  async initialize(browser: Browser): Promise<void> {
    await this.sessionPool.initialize(browser);
  }

  /**
   * Route request through available session
   */
  async request(endpoint: string, options: any = {}): Promise<any> {
    // Check rate limiting
    if (this.rateLimiter.shouldThrottle(endpoint)) {
      await this.rateLimiter.handleRateLimitResponse({
        headers: new Map([['Retry-After', '60']])
      });
    }

    // Execute through session pool
    return this.sessionPool.executeWithSession(async (context) => {
      const page = await context.newPage();
      
      try {
        // Extract API details if not done
        if (!this.apiExtractor.hasSessionToken()) {
          await this.apiExtractor.extractFromBrowser(page);
        }

        // Make request
        const response = await this.apiExtractor.makeAPIRequest(endpoint, options);
        
        // Record for rate limiting
        this.rateLimiter.recordRequest(endpoint);

        return response;
      } finally {
        await page.close();
      }
    });
  }
}

/**
 * WebSocket Stream Handler for real-time code updates
 */
export class CodeStreamHandler {
  private ws?: WebSocket;
  private messageBuffer: any[] = [];
  private reconnectAttempts = 0;

  async connect(sessionId: string, token: string): Promise<void> {
    const wsUrl = `wss://claude.ai/ws/code/${sessionId}`;

    this.ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Origin': 'https://claude.ai'
      }
    });

    this.ws.on('open', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.flushMessageBuffer();
    });

    this.ws.on('message', (data: Buffer) => {
      this.handleStreamMessage(data);
    });

    this.ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      this.reconnect(sessionId, token);
    });

    this.ws.on('close', () => {
      console.log('WebSocket closed');
      this.reconnect(sessionId, token);
    });
  }

  private handleStreamMessage(data: any): void {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'token':
          // Handle streaming tokens
          process.stdout.write(message.content);
          break;
        
        case 'complete':
          console.log('\nStream complete');
          break;
        
        case 'error':
          console.error('Stream error:', message.error);
          break;
        
        case 'file_update':
          console.log('File updated:', message.path);
          break;
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  private async reconnect(sessionId: string, token: string): Promise<void> {
    if (this.reconnectAttempts >= 5) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Reconnecting in ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    await this.connect(sessionId, token);
  }

  private flushMessageBuffer(): void {
    while (this.messageBuffer.length > 0) {
      const message = this.messageBuffer.shift();
      this.ws?.send(JSON.stringify(message));
    }
  }

  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageBuffer.push(message);
    }
  }

  close(): void {
    this.ws?.close();
  }
}
