import 'dotenv/config'; // Ensure env variables are loaded

let chatModel;
let embeddingModel;

const AI_PROVIDER = process.env.AI_PROVIDER;

async function initializeModels() {
  if (AI_PROVIDER === 'openai') {
    const { ChatOpenAI, OpenAIEmbeddings } = await import('@langchain/openai');
    chatModel = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    });
    embeddingModel = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-large",
    });
  } else if (AI_PROVIDER === 'ollama') {
    const { ChatOllama, OllamaEmbeddings } = await import('@langchain/ollama');
    chatModel = new ChatOllama({
      baseUrl: process.env.OLLAMA_URL,
      model: process.env.OLLAMA_MODEL || 'llama3',
    });
    embeddingModel = new OllamaEmbeddings({
      baseUrl: process.env.OLLAMA_URL,
      model: process.env.OLLAMA_EMBEDDING_MODEL || 'llama3',
    });
  } else {
    console.warn(`AI_PROVIDER "${AI_PROVIDER}" not recognized. Defaulting to OpenAI.`);
    const { ChatOpenAI, OpenAIEmbeddings } = await import('@langchain/openai');
    chatModel = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    });
    embeddingModel = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-large",
    });
  }
}

// Initialize models immediately
initializeModels();

export { chatModel, embeddingModel };