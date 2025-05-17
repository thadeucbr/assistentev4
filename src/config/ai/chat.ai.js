import ollamaChat from './ollama/ollamaChat.js';
import openAiChat from './openai/openAiChat.js';
export default async function chatAi(chatMessages) {
  if (process.env.AI_PROVIDER === 'ollama') {
    return await ollamaChat(chatMessages);
  }
  if (process.env.AI_PROVIDER === 'openai') {
    return await openAiChat(chatMessages);
  }
}