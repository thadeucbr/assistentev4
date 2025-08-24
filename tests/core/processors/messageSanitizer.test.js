import { describe, test, expect, jest, afterEach } from '@jest/globals';

// Mock the logger using the modern ES module approach
jest.unstable_mockModule('../../../src/utils/logger.js', () => ({
  default: {
    debug: jest.fn(),
    warn: jest.fn(),
    milestone: jest.fn(),
  },
}));

// Dynamically import the module under test after setting up the mock
const { sanitizeMessagesForChat } = await import('../../../src/core/processors/messageSanitizer.js');

describe('sanitizeMessagesForChat', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test Case 1: Empty input
  test('should return an empty array when given an empty array', () => {
    expect(sanitizeMessagesForChat([])).toEqual([]);
  });

  // Test Case 2: Remove duplicate consecutive user messages
  test('should remove consecutive duplicate user messages', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
      { role: 'user', content: 'How are you?' },
      { role: 'user', content: 'How are you?' },
    ];
    const expected = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
    ];
    expect(sanitizeMessagesForChat(messages)).toEqual(expected);
  });

  test('should not remove non-consecutive duplicate user messages', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
      { role: 'user', content: 'Hello' },
    ];
    expect(sanitizeMessagesForChat(messages)).toEqual(messages);
  });

  // Test Case 3: Truncate message history
  test('should truncate messages exceeding MAX_HISTORY_LENGTH', () => {
    const messages = Array.from({ length: 60 }, (_, i) => ({
      role: 'user',
      content: `Message ${i}`,
    }));
    const result = sanitizeMessagesForChat(messages);
    expect(result.length).toBe(50);
    expect(result[0].content).toBe('Message 10');
  });

  test('should keep system message when truncating', () => {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      ...Array.from({ length: 60 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`,
      })),
    ];
    const result = sanitizeMessagesForChat(messages);
    expect(result.length).toBe(51); // 50 recent + system
    expect(result[0].role).toBe('system');
    expect(result[1].content).toBe('Message 10');
  });

  // Test Case 4: Sanitize tool calls
  test('should remove assistant message and corresponding tool calls if not all tool responses are present', () => {
    const messages = [
      { role: 'assistant', tool_calls: [{ id: 'tool1' }] },
      // no tool response for 'tool1'
      { role: 'tool', tool_call_id: 'tool2', content: 'response' }, // orphaned tool response
    ];
    const result = sanitizeMessagesForChat(messages);
    expect(result).toEqual([]);
  });

  test('should keep valid tool call sequences', () => {
    const messages = [
      { role: 'assistant', tool_calls: [{ id: 'tool1' }] },
      { role: 'tool', tool_call_id: 'tool1', content: 'response' },
    ];
    expect(sanitizeMessagesForChat(messages)).toEqual(messages);
  });

  test('should remove assistant message if its tool calls are not fully satisfied', () => {
    const messages = [
      { role: 'assistant', tool_calls: [{ id: 'tool1' }, { id: 'tool2' }] },
      { role: 'tool', tool_call_id: 'tool1', content: 'response1' },
    ];
    // The assistant call is removed because tool2 response is missing.
    // The tool response for tool1 is also removed because its corresponding assistant call is invalid.
    expect(sanitizeMessagesForChat(messages)).toEqual([]);
  });

  test('should handle complex tool call scenarios correctly', () => {
    const messages = [
        { role: 'user', content: '...'},
        { role: 'assistant', tool_calls: [{ id: 'A' }] },
        { role: 'tool', tool_call_id: 'A', content: '...' },
        { role: 'assistant', tool_calls: [{ id: 'B' }, { id: 'C' }] }, // This assistant call is incomplete
        { role: 'tool', tool_call_id: 'B', content: '...' },
        { role: 'tool', tool_call_id: 'D', content: '...' }, // Orphaned tool call
    ];

    const expected = [
        { role: 'user', content: '...'},
        { role: 'assistant', tool_calls: [{ id: 'A' }] },
        { role: 'tool', tool_call_id: 'A', content: '...' },
    ];

    const result = sanitizeMessagesForChat(messages);
    expect(result).toEqual(expected);
  });

  // Test Case 5: Combination of all sanitizations
  test('should apply all sanitizations together', () => {
    const messages = [
      { role: 'system', content: 'System message' },
      ...Array.from({ length: 60 }, (_, i) => ({ role: 'user', content: `Message ${i}`})),
      { role: 'user', content: 'Duplicate' },
      { role: 'user', content: 'Duplicate' },
      { role: 'assistant', tool_calls: [{ id: 'tool1' }] }, // valid
      { role: 'tool', tool_call_id: 'tool1', content: 'response' },
      { role: 'assistant', tool_calls: [{ id: 'tool2' }] }, // invalid
    ];

    const result = sanitizeMessagesForChat(messages);

    // 1. Deduplication: 'Duplicate' removed
    // 2. Tool call sanitization: assistant message with tool2 is removed
    // 3. Truncation: System message is kept, and the last 50 messages are kept.
    // After truncation, the invalid assistant call for 'tool2' is removed.
    // So the final count is 50.

    expect(result.length).toBe(50);
    expect(result[0].role).toBe('system');

    // Check that the duplicate message is not present
    const duplicates = result.filter(m => m.content === 'Duplicate');
    expect(duplicates.length).toBe(1);

    // Check that the invalid assistant call is removed
    const tool2calls = result.filter(m => m.tool_calls && m.tool_calls[0].id === 'tool2');
    expect(tool2calls.length).toBe(0);
  });
});
