import InMemoryVectorStore from '../lib/vectorStore.js';
import { Document } from '@langchain/core/documents';

const LtmService = {
  async getRelevantContext(userId, message) {
    const results = await InMemoryVectorStore.similaritySearch(userId, message, 4);
    return results.map((r) => r.pageContent).join('\n\n');
  },

  async summarizeAndStore(userId, conversation) {
    await InMemoryVectorStore.addDocuments(userId, [
      new Document({
        pageContent: conversation,
        metadata: {
          userId,
          timestamp: new Date().toISOString(),
        },
      }),
    ]);
  },
};

export default LtmService;