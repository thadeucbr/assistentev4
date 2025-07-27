import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import { OpenAIEmbeddings } from '@langchain/openai';
import * as fs from 'fs/promises';

const VECTOR_STORE_PATH = './vector_store';

async function getVectorStore(userId) {
  const embeddings = new OpenAIEmbeddings();
  const userStorePath = `${VECTOR_STORE_PATH}/${userId}`;

  // Ensure the base directory exists
  await fs.mkdir(VECTOR_STORE_PATH, { recursive: true });

  if (await fs.access(userStorePath).then(() => true).catch(() => false)) {
    // Load the existing vector store
    return await HNSWLib.load(userStorePath, embeddings);
  } else {
    // Create a new vector store (it will be saved when documents are added)
    return new HNSWLib(embeddings, {});
  }
}

export default getVectorStore;