import 'dotenv/config';
import { logError } from '../utils/logger.js';

/**
 * Gera imagens usando a ferramenta nativa de geração de imagem da OpenAI via function calling
 * @param {string} prompt - Prompt para geração da imagem
 * @param {Object} options - Opções adicionais
 * @returns {Promise<Object>} Resultado contendo a imagem ou erro
 */
export async function generateImageWithOpenAITool(prompt, options = {}) {
  try {
    console.log('Iniciando geração de imagem com OpenAI native image generation tool...');
    console.log('Prompt:', prompt);

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-nano-2025-08-07';
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    // Definir a ferramenta de geração de imagem
    const imageGenerationTool = {
      type: 'function',
      function: {
        name: 'generate_image',
        description: 'Generate an image based on a text description',
        parameters: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'A detailed description of the image to generate'
            },
            size: {
              type: 'string',
              description: 'The size of the image',
              enum: ['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'],
              default: '1024x1024'
            },
            quality: {
              type: 'string',
              description: 'The quality of the image',
              enum: ['standard', 'hd'],
              default: 'standard'
            },
            style: {
              type: 'string',
              description: 'The style of the image',
              enum: ['vivid', 'natural'],
              default: 'vivid'
            }
          },
          required: ['prompt']
        }
      }
    };

    const payload = {
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that can generate images. When asked to generate an image, use the generate_image function to create it.'
        },
        {
          role: 'user',
          content: `Please generate an image with this description: ${prompt}`
        }
      ],
      tools: [imageGenerationTool],
      tool_choice: 'auto',
      max_completion_tokens: 1000
    };

    console.log('Fazendo requisição para OpenAI com function calling...');
    
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
      console.error('Erro na API OpenAI:', response.status, errorData);
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('Resposta recebida da OpenAI API');

    // Verificar se houve chamada de ferramenta
    const message = data.choices?.[0]?.message;
    if (!message) {
      throw new Error('Resposta inválida da OpenAI API - mensagem não encontrada');
    }

    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log('Function call detectado para geração de imagem');
      
      const toolCall = message.tool_calls[0];
      if (toolCall.function.name === 'generate_image') {
        const functionArgs = JSON.parse(toolCall.function.arguments);
        console.log('Parâmetros da function call:', functionArgs);

        // Agora usar a API DALL-E com os parâmetros da function call
        const dalleResult = await callDalleAPI({
          prompt: functionArgs.prompt,
          size: functionArgs.size || '1024x1024',
          quality: functionArgs.quality || 'standard',
          style: functionArgs.style || 'vivid'
        });

        return {
          success: true,
          method: 'openai_native_tool',
          imageBase64: dalleResult.imageBase64,
          originalPrompt: prompt,
          processedPrompt: functionArgs.prompt,
          parameters: functionArgs,
          revisedPrompt: dalleResult.revisedPrompt,
          model: OPENAI_MODEL
        };
      }
    }

    // Se não houve chamada de ferramenta, verificar se há resposta de texto com informações de imagem
    const textResponse = message.content;
    if (textResponse) {
      console.log('Resposta de texto recebida:', textResponse.substring(0, 200) + '...');
      
      // Procurar por indicadores de que uma imagem deveria ter sido gerada
      if (textResponse.toLowerCase().includes('image') || textResponse.toLowerCase().includes('generate')) {
        return {
          success: false,
          method: 'openai_native_tool',
          error: 'Modelo não ativou a ferramenta de geração de imagem',
          response: textResponse,
          fallbackRequired: true
        };
      }
    }

    return {
      success: false,
      method: 'openai_native_tool',
      error: 'Nenhuma geração de imagem foi acionada',
      fallbackRequired: true
    };

  } catch (error) {
    console.error('Erro na geração de imagem com OpenAI native tool:', error);
    logError(error, `generateImageWithOpenAITool - Falha na geração com prompt: "${prompt}"`);
    
    return {
      success: false,
      method: 'openai_native_tool',
      error: error.message || 'Erro desconhecido',
      fallbackRequired: true
    };
  }
}

/**
 * Chama a API DALL-E diretamente (usado pela ferramenta nativa)
 * @param {Object} params - Parâmetros para DALL-E
 * @returns {Promise<Object>} Resultado da API DALL-E
 */
async function callDalleAPI({ prompt, size = '1024x1024', quality = 'standard', style = 'vivid' }) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  const payload = {
    model: 'dall-e-3',
    prompt: prompt,
    n: 1,
    size: size,
    quality: quality,
    style: style,
    response_format: 'b64_json'
  };

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`DALL-E API error: ${response.status} - ${errorData}`);
  }

  const data = await response.json();
  
  if (!data.data || !data.data[0] || !data.data[0].b64_json) {
    throw new Error('Resposta inválida da DALL-E API - imagem não encontrada');
  }

  return {
    imageBase64: data.data[0].b64_json,
    revisedPrompt: data.data[0].revised_prompt
  };
}

/**
 * Testa se o modelo suporta a ferramenta nativa de geração de imagem
 * @param {string} testPrompt - Prompt de teste
 * @returns {Promise<Object>} Resultado do teste
 */
export async function testOpenAIImageTool(testPrompt = "A simple red circle on white background") {
  try {
    console.log('Testando ferramenta nativa de geração de imagem da OpenAI...');
    
    const result = await generateImageWithOpenAITool(testPrompt);
    
    return {
      supportsNativeTool: result.success,
      method: result.method,
      error: result.error || null,
      details: result
    };

  } catch (error) {
    console.error('Erro ao testar ferramenta nativa OpenAI:', error);
    return {
      supportsNativeTool: false,
      method: 'openai_native_tool',
      error: error.message || 'Erro desconhecido',
      details: null
    };
  }
}

export default {
  generateImageWithOpenAITool,
  testOpenAIImageTool
};
