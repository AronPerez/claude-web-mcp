// Main exports for the package
export { ClaudeCodeAutomation } from './core/claude-code-automation';
export { 
  ClaudeSessionPool,
  RateLimitHandler,
  ClaudeCodeAPIExtractor,
  CodeStreamHandler
} from './core/claude-code-advanced';

// Types
export type {
  ClaudeCodeConfig,
  CodeSession,
  PullRequest,
  FileChange,
  CaptchaSolverInterface
} from './core/claude-code-automation';
