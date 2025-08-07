import 'dotenv/config';
import { logError } from '../utils/logger.js';

/**
 * Analisa imagens usando a API OpenAI Vision (GPT-4 Vision)
 * @param {string} base64Image - Imagem em formato base64
 * @param {string} prompt - Prompt para análise da imagem
 * @param {Object} options - Opções adicionais
 * @returns {Promise<Object>} Resultado da análise
 */
export async function analyzeImageWithOpenAIVision(base64Image, prompt, options = {}) {
  try {
    console.log('Iniciando análise de imagem com OpenAI Vision...');
    console.log('Prompt:', prompt);

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const OPENAI_VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
    const OPENAI_VISION_MAX_TOKENS = parseInt(process.env.OPENAI_VISION_MAX_TOKENS) || 500;
    const OPENAI_VISION_DETAIL = process.env.OPENAI_VISION_DETAIL || 'auto'; // low, high, auto
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    // Garantir que a imagem está no formato correto
    let imageUrl = base64Image;
    if (!base64Image.startsWith('data:image/')) {
      imageUrl = `data:image/jpeg;base64,${base64Image}`;
    }

    const payload = {
      model: OPENAI_VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: OPENAI_VISION_DETAIL
              }
            }
          ]
        }
      ],
      max_tokens: OPENAI_VISION_MAX_TOKENS,
      temperature: options.temperature || 0.3
    };

    console.log('Fazendo requisição para OpenAI Vision API...');
    
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
      console.error('Erro na API OpenAI Vision:', response.status, errorData);
      throw new Error(`OpenAI Vision API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('Resposta recebida da OpenAI Vision API');

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Resposta inválida da OpenAI Vision API - estrutura esperada não encontrada');
    }

    const result = {
      success: true,
      method: 'openai_vision',
      content: data.choices[0].message.content,
      model: OPENAI_VISION_MODEL,
      usage: data.usage || {},
      finishReason: data.choices[0].finish_reason,
      originalPrompt: prompt
    };

    return result;

  } catch (error) {
    console.error('Erro na análise de imagem com OpenAI Vision:', error);
    logError(error, `analyzeImageWithOpenAIVision - Falha na análise com prompt: "${prompt}"`);
    
    return {
      success: false,
      method: 'openai_vision',
      error: error.message || 'Erro desconhecido',
      originalPrompt: prompt
    };
  }
}

/**
 * Analisa múltiplas imagens em uma única requisição
 * @param {Array<string>} base64Images - Array de imagens em formato base64
 * @param {string} prompt - Prompt para análise das imagens
 * @param {Object} options - Opções adicionais
 * @returns {Promise<Object>} Resultado da análise
 */
export async function analyzeMultipleImagesWithOpenAIVision(base64Images, prompt, options = {}) {
  try {
    console.log(`Iniciando análise de ${base64Images.length} imagens com OpenAI Vision...`);
    
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const OPENAI_VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
    const OPENAI_VISION_MAX_TOKENS = parseInt(process.env.OPENAI_VISION_MAX_TOKENS) || 1000;
    const OPENAI_VISION_DETAIL = process.env.OPENAI_VISION_DETAIL || 'auto';
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    // Construir o conteúdo com texto e múltiplas imagens
    const content = [
      {
        type: 'text',
        text: prompt
      }
    ];

    // Adicionar cada imagem ao conteúdo
    base64Images.forEach((base64Image, index) => {
      let imageUrl = base64Image;
      if (!base64Image.startsWith('data:image/')) {
        imageUrl = `data:image/jpeg;base64,${base64Image}`;
      }

      content.push({
        type: 'image_url',
        image_url: {
          url: imageUrl,
          detail: OPENAI_VISION_DETAIL
        }
      });
    });

    const payload = {
      model: OPENAI_VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: content
        }
      ],
      max_tokens: OPENAI_VISION_MAX_TOKENS,
      temperature: options.temperature || 0.3
    };

    console.log('Fazendo requisição para OpenAI Vision API (múltiplas imagens)...');
    
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
      console.error('Erro na API OpenAI Vision (múltiplas imagens):', response.status, errorData);
      throw new Error(`OpenAI Vision API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('Resposta recebida da OpenAI Vision API (múltiplas imagens)');

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Resposta inválida da OpenAI Vision API - estrutura esperada não encontrada');
    }

    return {
      success: true,
      method: 'openai_vision_multiple',
      content: data.choices[0].message.content,
      model: OPENAI_VISION_MODEL,
      usage: data.usage || {},
      finishReason: data.choices[0].finish_reason,
      originalPrompt: prompt,
      imageCount: base64Images.length
    };

  } catch (error) {
    console.error('Erro na análise de múltiplas imagens com OpenAI Vision:', error);
    logError(error, `analyzeMultipleImagesWithOpenAIVision - Falha na análise com prompt: "${prompt}"`);
    
    return {
      success: false,
      method: 'openai_vision_multiple',
      error: error.message || 'Erro desconhecido',
      originalPrompt: prompt,
      imageCount: base64Images.length
    };
  }
}

/**
 * Testa a conectividade e funcionalidade da OpenAI Vision API
 * @returns {Promise<Object>} Resultado do teste
 */
export async function testOpenAIVision() {
  try {
    console.log('Testando OpenAI Vision API...');
    
    // Criar uma imagem de teste simples (pixel vermelho 1x1 em base64)
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    
    const result = await analyzeImageWithOpenAIVision(
      testImageBase64, 
      'Describe what you see in this image. This is a test image.'
    );
    
    return {
      success: result.success,
      method: 'openai_vision_test',
      error: result.error || null,
      details: result
    };

  } catch (error) {
    console.error('Erro ao testar OpenAI Vision:', error);
    return {
      success: false,
      method: 'openai_vision_test',
      error: error.message || 'Erro desconhecido'
    };
  }
}

export default {
  analyzeImageWithOpenAIVision,
  analyzeMultipleImagesWithOpenAIVision,
  testOpenAIVision
};
