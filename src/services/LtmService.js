import getVectorStore from '../lib/vectorStore.js';
import { Document } from '@langchain/core/documents';

const LtmService = {
  async getRelevantContext(userId, message) {
    const vectorStore = await getVectorStore(userId);
    const response = await vectorStore.similaritySearch(message, 4);
    return response.map((r) => r.pageContent).join('\n\n');
  },

  async summarizeAndStore(userId, conversation) {
    const vectorStore = await getVectorStore(userId);
    await vectorStore.addDocuments([
      new Document({
        pageContent: conversation,
        metadata: {
          userId,
          timestamp: new Date().toISOString(),
        },
      }),
    ]);
    // Save the updated vector store to disk
    await vectorStore.save(`./vector_store/${userId}`);
  },
};

export default LtmService;