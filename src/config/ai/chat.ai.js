import ollamaChat from './ollama/ollamaChat.js';
import openAiChat from './openai/openAiChat.js';

export async function chatAi(chatMessages, tools) {
  const provider = process.env.AI_PROVIDER;
  if (provider === 'ollama') {
    return await ollamaChat(chatMessages, tools);
  } else if (provider === 'openai') {
    return await openAiChat(chatMessages, tools);
  } else {
    throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
  }
}

export async function lightChatAi(chatMessages) {
  const provider = process.env.LIGHT_AI_PROVIDER || process.env.AI_PROVIDER;
  if (provider === 'ollama') {
    return await ollamaChat(chatMessages, []); // Light models usually don't need tools
  } else if (provider === 'openai') {
    return await openAiChat(chatMessages, []); // Light models usually don't need tools
  } else {
    throw new Error(`Unsupported LIGHT_AI_PROVIDER: ${provider}`);
  }
}