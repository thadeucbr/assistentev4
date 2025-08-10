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
      try {
        return await openAiChat(chatMessages, tools);
      } catch (fallbackErr) {
        console.error('Both Ollama and OpenAI failed:', { ollama: err.message, openai: fallbackErr.message });
        throw new Error(`AI chat failed: Primary (Ollama): ${err.message}, Fallback (OpenAI): ${fallbackErr.message}`);
      }
    }
  } else if (provider === 'openai') {
    // If OpenAI is the provider, handle rate limits gracefully
    try {
      return await openAiChat(chatMessages, tools);
    } catch (err) {
      if (err.isRateLimit) {
        console.warn(`OpenAI rate limit hit, attempting fallback to Ollama: ${err.message}`);
        try {
          return await ollamaChat(chatMessages, tools);
        } catch (fallbackErr) {
          console.error('OpenAI rate limited and Ollama fallback failed:', { openai: err.message, ollama: fallbackErr.message });
          throw new Error(`AI chat failed: OpenAI rate limited: ${err.message}, Ollama fallback: ${fallbackErr.message}`);
        }
      } else {
        // Non-rate-limit OpenAI errors - propagate directly
        console.error('OpenAI chat error:', err.message);
        throw err;
      }
    }
  } else {
    // Default behavior if no provider is specified: try OpenAI first, then Ollama.
    try {
      return await openAiChat(chatMessages, tools);
    } catch (err) {
      console.warn(`OpenAI chat failed, falling back to Ollama: ${err.message}`);
      try {
        return await ollamaChat(chatMessages, tools);
      } catch (fallbackErr) {
        console.error('Both OpenAI and Ollama failed:', { openai: err.message, ollama: fallbackErr.message });
        throw new Error(`AI chat failed: Primary (OpenAI): ${err.message}, Fallback (Ollama): ${fallbackErr.message}`);
      }
    }
  }
}
