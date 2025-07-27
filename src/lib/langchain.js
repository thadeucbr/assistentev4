import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';

const chatModel = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-4-turbo-preview',
});

const embeddingModel = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    model: "text-embedding-3-large"
});

export { chatModel, embeddingModel };