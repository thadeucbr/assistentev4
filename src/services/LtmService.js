import { ChromaClient } from 'chromadb';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Chroma } from '@langchain/community/vectorstores/chroma';

const chromaClient = new ChromaClient({ path: process.env.CHROMA_URL });

const LtmService = {
  async getRelevantContext(userId, message) {
    const vectorStore = new Chroma(new OpenAIEmbeddings(), {
      collectionName: `context_${userId}`,
      client: chromaClient,
    });

    const response = await vectorStore.similaritySearch(message, 4);
    return response.map((r) => r.pageContent).join('\n\n');
  },

  async summarizeAndStore(userId, conversation) {
    const vectorStore = new Chroma(new OpenAIEmbeddings(), {
      collectionName: `context_${userId}`,
      client: chromaClient,
    });

    await vectorStore.addDocuments([
      {
        pageContent: conversation,
        metadata: {
          userId,
          timestamp: new Date().toISOString(),
        },
      },
    ]);
  },
};

export default LtmService;