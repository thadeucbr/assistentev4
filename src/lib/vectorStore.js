import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import { OpenAIEmbeddings } from '@langchain/openai';
import * as fs from 'fs/promises';

const VECTOR_STORE_PATH = './vector_store';

async function getVectorStore(userId) {
  const embeddings = new OpenAIEmbeddings();
  const userStorePath = `${VECTOR_STORE_PATH}/${userId}`;

  // Ensure the user-specific directory exists
  await fs.mkdir(userStorePath, { recursive: true });

  try {
    // Try to load the existing vector store
    return await HNSWLib.load(userStorePath, embeddings);
  } catch (error) {
    // If loading fails (e.g., directory exists but no store, or corrupted), create a new one
    console.warn(`Could not load vector store for user ${userId}. Creating a new one. Error: ${error.message}`);
    return new HNSWLib(embeddings, {});
  }
}

export default getVectorStore;