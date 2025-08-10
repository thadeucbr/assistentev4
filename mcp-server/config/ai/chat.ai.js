import ollamaChat from './ollama/ollamaChat.js';
import openAiChat from './openai/openAiChat.js';

export default async function chatAi(chatMessages, tools) {
  const provider = process.env.AI_PROVIDER;

  if (provider === 'ollama') {
    // If Ollama is the provider, try it and fallback to OpenAI on error.
    try {
      return await ollamaChat(chatMessages, tools);
    } catch (err) {
      console.warn(`Ollama chat failed, falling back to OpenAI: ${err.message}`);
      return await openAiChat(chatMessages, tools);
    }
  } else if (provider === 'openai') {
    // If OpenAI is the provider, use it exclusively. Do not fall back to Ollama.
    // Any errors from OpenAI will be propagated directly.
    return await openAiChat(chatMessages, tools);
  } else {
    // Default behavior if no provider is specified: try OpenAI first, then Ollama.
    try {
      return await openAiChat(chatMessages, tools);
    } catch (err) {
      console.warn(`OpenAI chat failed, falling back to Ollama: ${err.message}`);
      return await ollamaChat(chatMessages, tools);
    }
  }
}
