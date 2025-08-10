import ollamaChat from './ollama/ollamaChat.js';
import openAiChat from './openai/openAiChat.js';
import logger from '../../utils/logger.js';

export default async function chatAi(chatMessages, tools) {
  const provider = process.env.AI_PROVIDER;

  if (provider === 'ollama') {
    // If Ollama is the provider, try it and fallback to OpenAI on error.
    try {
      logger.systemStatus('Ollama', 'connecting');
      const result = await ollamaChat(chatMessages, tools);
      logger.systemStatus('Ollama', 'online');
      return result;
    } catch (err) {
      logger.systemStatus('Ollama', 'error', { error: err.message });
      logger.warn('ChatAI', `Ollama falhou, usando OpenAI como fallback: ${err.message}`);
      
      try {
        logger.systemStatus('OpenAI', 'connecting');
        const result = await openAiChat(chatMessages, tools);
        logger.systemStatus('OpenAI', 'online');
        return result;
      } catch (fallbackErr) {
        logger.systemStatus('OpenAI', 'error', { error: fallbackErr.message });
        logger.critical('ChatAI', 'Tanto Ollama quanto OpenAI falharam', { 
          ollama: err.message, 
          openai: fallbackErr.message 
        });
        throw new Error(`AI chat failed: Primary (Ollama): ${err.message}, Fallback (OpenAI): ${fallbackErr.message}`);
      }
    }
  } else if (provider === 'openai') {
    // If OpenAI is the provider, handle rate limits gracefully
    try {
      logger.systemStatus('OpenAI', 'connecting');
      const result = await openAiChat(chatMessages, tools);
      logger.systemStatus('OpenAI', 'online');
      return result;
    } catch (err) {
      if (err.isRateLimit) {
        logger.systemStatus('OpenAI', 'warning', { error: 'Rate limit atingido' });
        logger.warn('ChatAI', `OpenAI rate limit atingido, tentando Ollama: ${err.message}`);
        
        try {
          logger.systemStatus('Ollama', 'connecting');
          const result = await ollamaChat(chatMessages, tools);
          logger.systemStatus('Ollama', 'online');
          return result;
        } catch (fallbackErr) {
          logger.systemStatus('Ollama', 'error', { error: fallbackErr.message });
          logger.critical('ChatAI', 'OpenAI com rate limit e Ollama falhou', { 
            openai: err.message, 
            ollama: fallbackErr.message 
          });
          throw new Error(`AI chat failed: OpenAI rate limited: ${err.message}, Ollama fallback: ${fallbackErr.message}`);
        }
      } else {
        // Non-rate-limit OpenAI errors - propagate directly
        logger.systemStatus('OpenAI', 'error', { error: err.message });
        logger.error('ChatAI', `Erro no OpenAI: ${err.message}`);
        throw err;
      }
    }
  } else {
    // Default behavior if no provider is specified: try OpenAI first, then Ollama.
    try {
      logger.systemStatus('OpenAI', 'connecting');
      const result = await openAiChat(chatMessages, tools);
      logger.systemStatus('OpenAI', 'online');
      return result;
    } catch (err) {
      logger.systemStatus('OpenAI', 'error', { error: err.message });
      logger.warn('ChatAI', `OpenAI falhou, usando Ollama como fallback: ${err.message}`);
      
      try {
        logger.systemStatus('Ollama', 'connecting');
        const result = await ollamaChat(chatMessages, tools);
        logger.systemStatus('Ollama', 'online');
        return result;
      } catch (fallbackErr) {
        logger.systemStatus('Ollama', 'error', { error: fallbackErr.message });
        logger.critical('ChatAI', 'Tanto OpenAI quanto Ollama falharam', { 
          openai: err.message, 
          ollama: fallbackErr.message 
        });
        throw new Error(`AI chat failed: Primary (OpenAI): ${err.message}, Fallback (Ollama): ${fallbackErr.message}`);
      }
    }
  }
}
