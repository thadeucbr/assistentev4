import ollamaChat from './ollama/ollamaChat.js';
import openAiChat from './openai/openAiChat.js';
export default async function chatAi(chatMessages, tools) {
  const provider = process.env.AI_PROVIDER;
  if (provider === 'ollama') {
    try {
      const ollamaResponse = await ollamaChat(chatMessages, tools);
      return { message: ollamaResponse.message };
    } catch (err) {
      const openaiResponse = await openAiChat(chatMessages, tools);
      return { message: openaiResponse.message };
    }
  }
  if (provider === 'openai') {
    try {
      const openaiResponse = await openAiChat(chatMessages, tools);
      return { message: openaiResponse.message };
    } catch (err) {
      const ollamaResponse = await ollamaChat(chatMessages, tools);
      return { message: ollamaResponse.message };
    }
  }
}