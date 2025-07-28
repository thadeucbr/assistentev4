import * as fs from 'fs/promises';
import { embeddingModel } from './langchain.js';

const VECTOR_STORE_DIR = './vector_store';

// Helper function to calculate cosine similarity
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  if (magnitudeA === 0 || magnitudeB === 0) return 0; // Avoid division by zero
  return dotProduct / (magnitudeA * magnitudeB);
}

async function loadVectorStore(userId) {
  const userStorePath = `${VECTOR_STORE_DIR}/${userId}.json`;
  try {
    const data = await fs.readFile(userStorePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File not found, return empty store
      return [];
    }
    console.error(`Error loading vector store for user ${userId}:`, error);
    return [];
  }
}

async function saveVectorStore(userId, store) {
  const userStorePath = `${VECTOR_STORE_DIR}/${userId}.json`;
  await fs.mkdir(VECTOR_STORE_DIR, { recursive: true });
  await fs.writeFile(userStorePath, JSON.stringify(store, null, 2), 'utf8');
}

const InMemoryVectorStore = {
  async addDocuments(userId, documents) {
    const store = await loadVectorStore(userId);

    for (const doc of documents) {
      const embedding = await embeddingModel.embedQuery(doc.pageContent);
      store.push({
        pageContent: doc.pageContent,
        metadata: doc.metadata,
        embedding: embedding,
      });
    }
    await saveVectorStore(userId, store);
  },

  async similaritySearch(userId, query, k = 4) {
    const store = await loadVectorStore(userId);
    const queryEmbedding = await embeddingModel.embedQuery(query);

    const results = store.map(item => ({
      item: item,
      similarity: cosineSimilarity(queryEmbedding, item.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity) // Sort by similarity (descending)
    .slice(0, k) // Take top k results
    .map(result => ({
      pageContent: result.item.pageContent,
      metadata: result.item.metadata,
    }));

    return results;
  },
};

export default InMemoryVectorStore;