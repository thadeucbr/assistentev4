import 'dotenv/config';
import { logError } from '../utils/logger.js';

/**
 * Testa se o modelo GPT-5-nano-2025-08-07 suporta geração de imagens nativa
 * @param {string} prompt - Prompt de teste para geração de imagem
 * @returns {Promise<Object>} Resultado do teste
 */
export async function testGPT5NanoImageGeneration(prompt = "A beautiful sunset over the ocean") {
  try {
    console.log('Testando capacidade de geração de imagem do GPT-5-nano-2025-08-07...');
    
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-nano-2025-08-07';
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    // Tentar usar o modelo para geração de imagem via chat completions
    const payload = {
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that can generate images. When asked to generate an image, create it and return the result.'
        },
        {
          role: 'user',
          content: `Generate an image of: ${prompt}`
        }
      ],
      max_completion_tokens: 1000,
      temperature: 0.7
    };

    console.log('Fazendo requisição para testar geração de imagem...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.log('Resposta da API:', data);
      return {
        supportsImageGeneration: false,
        method: null,
        error: `API Error: ${response.status} - ${data.error?.message || 'Unknown error'}`,
        fallbackToDalle: true
      };
    }

    // Analisar a resposta para ver se contém dados de imagem
    const assistantMessage = data.choices?.[0]?.message?.content || '';
    
    // Procurar por indicadores de que uma imagem foi gerada
    const imageIndicators = [
      'base64',
      'image_url',
      'data:image',
      'generated image',
      'image has been created'
    ];

    const hasImageIndicators = imageIndicators.some(indicator => 
      assistantMessage.toLowerCase().includes(indicator.toLowerCase())
    );

    console.log('Resposta do GPT-5-nano:', assistantMessage);

    if (hasImageIndicators) {
      return {
        supportsImageGeneration: true,
        method: 'chat_completions',
        response: assistantMessage,
        fallbackToDalle: false
      };
    } else {
      return {
        supportsImageGeneration: false,
        method: null,
        response: assistantMessage,
        fallbackToDalle: true,
        note: 'O modelo respondeu mas não gerou uma imagem diretamente'
      };
    }

  } catch (error) {
    console.error('Erro ao testar geração de imagem do GPT-5-nano:', error);
    logError(error, 'testGPT5NanoImageGeneration - Failed to test image generation');
    
    return {
      supportsImageGeneration: false,
      method: null,
      error: error.message || 'Erro desconhecido',
      fallbackToDalle: true
    };
  }
}

/**
 * Tenta gerar uma imagem usando o GPT-5-nano diretamente
 * @param {string} prompt - Prompt para geração da imagem
 * @returns {Promise<Object>} Resultado da geração
 */
export async function generateImageWithGPT5Nano(prompt) {
  try {
    console.log('Tentando gerar imagem com GPT-5-nano diretamente...');
    
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-nano-2025-08-07';
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    // Tentar método 1: Chat completions com instrução específica
    const payload = {
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant with integrated image generation capabilities. When asked to generate an image, you should create the image and return it in base64 format or provide a direct image URL. Always respond with the actual image data when possible.`
        },
        {
          role: 'user',
          content: `Please generate an image of: ${prompt}. Return the image as base64 data or provide the image directly.`
        }
      ],
      max_completion_tokens: 2000,
      temperature: 0.7
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || '';

    // Procurar por dados base64 na resposta
    const base64Match = assistantMessage.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
    if (base64Match) {
      return {
        success: true,
        method: 'gpt5_nano_direct',
        imageBase64: base64Match[1],
        fullResponse: assistantMessage,
        originalPrompt: prompt
      };
    }

    // Procurar por base64 puro (sem data URI)
    const pureBase64Match = assistantMessage.match(/([A-Za-z0-9+/]{50,}={0,2})/);
    if (pureBase64Match && pureBase64Match[1].length > 100) {
      return {
        success: true,
        method: 'gpt5_nano_direct',
        imageBase64: pureBase64Match[1],
        fullResponse: assistantMessage,
        originalPrompt: prompt
      };
    }

    // Se chegou aqui, o modelo não gerou uma imagem diretamente
    return {
      success: false,
      method: 'gpt5_nano_direct',
      error: 'Modelo não retornou dados de imagem',
      response: assistantMessage,
      fallbackRequired: true
    };

  } catch (error) {
    console.error('Erro na geração direta com GPT-5-nano:', error);
    logError(error, `generateImageWithGPT5Nano - Falha na geração com prompt: "${prompt}"`);
    
    return {
      success: false,
      method: 'gpt5_nano_direct',
      error: error.message || 'Erro desconhecido',
      fallbackRequired: true
    };
  }
}

export default {
  testGPT5NanoImageGeneration,
  generateImageWithGPT5Nano
};
