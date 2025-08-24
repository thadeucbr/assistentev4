import { describe, test, expect, jest, afterEach, beforeEach } from '@jest/globals';

// Mock dependencies using the modern ES module approach
jest.unstable_mockModule('../../../src/core/tools/MCPToolExecutor.js', () => ({
  default: jest.fn().mockImplementation(() => ({
    executeTools: jest.fn(),
  })),
}));
jest.unstable_mockModule('../../../src/whatsapp/simulateTyping.js', () => ({
  default: jest.fn(),
}));
jest.unstable_mockModule('../../../src/utils/logger.js', () => ({
  default: {
    critical: jest.fn(),
    milestone: jest.fn(),
  }
}));

// Dynamically import modules after mocks are set up
const { default: ErrorHandler } = await import('../../../src/core/handlers/errorHandler.js');
const { default: MCPToolExecutor } = await import('../../../src/core/tools/MCPToolExecutor.js');

describe('ErrorHandler', () => {

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Pure Functions', () => {

    // Tests for isRateLimitError
    describe('isRateLimitError', () => {
      test('should return true for "Rate limit" message', () => {
        const error = new Error('API call failed due to Rate limit exceeded.');
        expect(ErrorHandler.isRateLimitError(error)).toBe(true);
      });

      test('should return true for "rate_limit_exceeded" message', () => {
        const error = new Error('Error: rate_limit_exceeded');
        expect(ErrorHandler.isRateLimitError(error)).toBe(true);
      });

      test('should return true for "Too Many Requests" message', () => {
        const error = new Error('HTTP 429: Too Many Requests');
        expect(ErrorHandler.isRateLimitError(error)).toBe(true);
      });

      test('should return false for other error messages', () => {
        const error = new Error('Invalid API key.');
        expect(ErrorHandler.isRateLimitError(error)).toBe(false);
      });
    });

    // Tests for isRecoverableError
    describe('isRecoverableError', () => {
      const recoverableCases = [
        'Request timed out.',
        'Connection reset by peer (ECONNRESET)',
        'Network error occurred.',
        'Service temporarily unavailable.',
        'ETIMEDOUT: The operation timed out.',
      ];

      test.each(recoverableCases)('should return true for recoverable error: %s', (message) => {
        const error = new Error(message);
        expect(ErrorHandler.isRecoverableError(error)).toBe(true);
      });

      test('should return false for non-recoverable errors', () => {
        const error = new Error('SyntaxError: Unexpected token');
        expect(ErrorHandler.isRecoverableError(error)).toBe(false);
      });

      test('should be case-insensitive', () => {
        const error = new Error('a network problem occurred');
        expect(ErrorHandler.isRecoverableError(error)).toBe(true);
      });
    });

    // Tests for generateUserFriendlyErrorMessage
    describe('generateUserFriendlyErrorMessage', () => {
      test('should return rate limit message for rate limit errors', () => {
        const error = new Error('rate_limit_exceeded');
        const expected = '🕐 Sistema temporariamente sobrecarregado. Tente novamente em alguns minutos.';
        expect(ErrorHandler.generateUserFriendlyErrorMessage(error)).toBe(expected);
      });

      test('should return connection issue message for recoverable errors', () => {
        const error = new Error('Connection timeout');
        const expected = '⚠️ Problema temporário de conexão. Tente novamente em alguns segundos.';
        expect(ErrorHandler.generateUserFriendlyErrorMessage(error)).toBe(expected);
      });

      test('should return generic internal error message for other errors', () => {
        const error = new Error('Something went wrong');
        const expected = '❌ Ocorreu um erro interno. Nossa equipe foi notificada.';
        expect(ErrorHandler.generateUserFriendlyErrorMessage(error)).toBe(expected);
      });
    });
  });

  describe('Impure Handlers', () => {

    test('handleAIResponseError should attempt to send a message via MCPToolExecutor', async () => {
        const error = new Error('AI failed');

        await ErrorHandler.handleAIResponseError(error, {});

        const mockMCPInstance = MCPToolExecutor.mock.results[0].value;
        expect(MCPToolExecutor).toHaveBeenCalledTimes(1);
        expect(mockMCPInstance.executeTools).toHaveBeenCalledTimes(1);
        expect(mockMCPInstance.executeTools).toHaveBeenCalledWith(expect.any(Array));
    });

    test('handleCriticalError should attempt to send a message via MCPToolExecutor', async () => {
        const error = new Error('Critical failure');
        const message = { data: { from: '123' } };

        await ErrorHandler.handleCriticalError(error, message);

        const mockMCPInstance = MCPToolExecutor.mock.results[0].value;
        expect(MCPToolExecutor).toHaveBeenCalledTimes(1);
        expect(mockMCPInstance.executeTools).toHaveBeenCalledTimes(1);
        expect(mockMCPInstance.executeTools).toHaveBeenCalledWith(expect.any(Array));
    });
  });
});
