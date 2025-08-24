import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Use unstable_mockModule to mock ES modules
jest.unstable_mockModule('../../src/lib/vectorStore.js', () => ({
  default: {
    similaritySearch: jest.fn(),
    addDocuments: jest.fn(),
  },
}));

// Dynamically import the modules after the mock is set up
const { default: LtmService } = await import('../../src/services/LtmService.js');
const { default: InMemoryVectorStore } = await import('../../src/lib/vectorStore.js');

describe('LtmService', () => {
  const userId = 'test-user';

  beforeEach(() => {
    // Limpa todos os mocks antes de cada teste
    jest.clearAllMocks();
  });

  describe('getRelevantContext', () => {
    it('should call similaritySearch and return formatted context', async () => {
      const message = 'test message';
      const searchResults = [
        { pageContent: 'context 1' },
        { pageContent: 'context 2' },
      ];
      // Mock the resolved value for the imported mock function
      InMemoryVectorStore.similaritySearch.mockResolvedValue(searchResults);

      const result = await LtmService.getRelevantContext(userId, message);

      expect(InMemoryVectorStore.similaritySearch).toHaveBeenCalledWith(userId, message, 4);
      expect(result).toBe('context 1\n\ncontext 2');
    });
  });

  describe('summarizeAndStore', () => {
    it('should call addDocuments with the correct arguments', async () => {
      const conversation = 'This is a conversation summary.';

      await LtmService.summarizeAndStore(userId, conversation);

      // Verifica se addDocuments foi chamado
      expect(InMemoryVectorStore.addDocuments).toHaveBeenCalledTimes(1);

      // Verifica os argumentos da chamada
      const callArgs = InMemoryVectorStore.addDocuments.mock.calls[0];
      expect(callArgs[0]).toBe(userId);
      expect(callArgs[1][0].pageContent).toBe(conversation);
      expect(callArgs[1][0].metadata.userId).toBe(userId);
      expect(callArgs[1][0].metadata.timestamp).toBeDefined();
    });
  });
});
