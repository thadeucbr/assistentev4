import ollamaChat from './ollama/ollamaChat.js';
import openAiChat from './openai/openAiChat.js';
export default async function chatAi(chatMessages, tools) {
  const provider = process.env.AI_PROVIDER;
  if (provider === 'ollama') {
    try {
      return await ollamaChat(chatMessages, tools);
    } catch (err) {
      return await openAiChat(chatMessages, tools);
    }
  }
  if (provider === 'openai') {
    try {
      return await openAiChat(chatMessages, tools);
    } catch (err) {
      return await ollamaChat(chatMessages, tools);
    }
  }
}