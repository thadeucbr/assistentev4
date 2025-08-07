import 'dotenv/config';
import { logError } from '../utils/logger.js';

/**
 * Gera imagens usando a API DALL-E da OpenAI
 * @param {Object} params - Parâmetros de configuração
 * @param {string} params.prompt - Prompt para geração da imagem (deve estar em inglês)
 * @param {string} [params.model='dall-e-3'] - Modelo DALL-E a ser usado
 * @param {string} [params.quality='standard'] - Qualidade da imagem (standard/hd)
 * @param {string} [params.size='1024x1024'] - Tamanho da imagem
 * @param {string} [params.style='vivid'] - Estilo da imagem (vivid/natural)
 * @returns {Promise<Object>} Resultado contendo a imagem base64 ou erro
 */
export async function generateImageWithDallE({
  prompt,
  model = process.env.OPENAI_DALLE_MODEL || 'dall-e-3',
  quality = process.env.OPENAI_DALLE_QUALITY || 'standard',
  size = process.env.OPENAI_DALLE_SIZE || '1024x1024',
  style = process.env.OPENAI_DALLE_STYLE || 'vivid'
}) {
  try {
    console.log('Iniciando geração de imagem com DALL-E...');
    console.log('Prompt:', prompt);
    console.log('Modelo:', model);
    console.log('Qualidade:', quality);
    console.log('Tamanho:', size);
    console.log('Estilo:', style);

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    // Preparar o payload baseado no modelo
    const payload = {
      model: model,
      prompt: prompt,
      n: 1, // Sempre gerar apenas 1 imagem
      response_format: 'b64_json' // Retornar como base64
    };

    // Adicionar parâmetros específicos para DALL-E 3
    if (model === 'dall-e-3') {
      payload.quality = quality;
      payload.style = style;
    }
    
    // Definir tamanho baseado no modelo
    payload.size = size;

    console.log('Fazendo requisição para OpenAI DALL-E API...');
    
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
      console.error('Erro na API OpenAI DALL-E:', response.status, errorData);
      throw new Error(`OpenAI DALL-E API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('Resposta recebida da OpenAI DALL-E API');

    if (!data.data || !data.data[0] || !data.data[0].b64_json) {
      throw new Error('Resposta inválida da OpenAI DALL-E API - imagem não encontrada');
    }

    const imageBase64 = data.data[0].b64_json;
    const revisedPrompt = data.data[0].revised_prompt;

    console.log('Imagem gerada com sucesso!');
    if (revisedPrompt && revisedPrompt !== prompt) {
      console.log('Prompt revisado pela OpenAI:', revisedPrompt);
    }

    return {
      success: true,
      imageBase64: imageBase64,
      originalPrompt: prompt,
      revisedPrompt: revisedPrompt,
      model: model,
      quality: quality,
      size: size,
      style: model === 'dall-e-3' ? style : null
    };

  } catch (error) {
    console.error('Erro ao gerar imagem com DALL-E:', error);
    logError(error, `generateImageWithDallE - Falha na geração com prompt: "${prompt}"`);
    
    return {
      success: false,
      error: error.message || 'Erro desconhecido na geração da imagem',
      originalPrompt: prompt
    };
  }
}

/**
 * Valida se os parâmetros estão corretos para o modelo DALL-E especificado
 * @param {string} model - Modelo DALL-E
 * @param {string} size - Tamanho solicitado
 * @param {string} quality - Qualidade solicitada
 * @param {string} style - Estilo solicitado
 * @returns {Object} Resultado da validação
 */
export function validateDallEParams(model, size, quality, style) {
  const validSizes = {
    'dall-e-2': ['256x256', '512x512', '1024x1024'],
    'dall-e-3': ['1024x1024', '1792x1024', '1024x1792']
  };

  const validQualities = ['standard', 'hd'];
  const validStyles = ['vivid', 'natural'];

  const errors = [];

  // Validar modelo
  if (!['dall-e-2', 'dall-e-3'].includes(model)) {
    errors.push(`Modelo inválido: ${model}. Use 'dall-e-2' ou 'dall-e-3'`);
  }

  // Validar tamanho
  if (validSizes[model] && !validSizes[model].includes(size)) {
    errors.push(`Tamanho inválido para ${model}: ${size}. Use: ${validSizes[model].join(', ')}`);
  }

  // Validar qualidade (apenas para DALL-E 3)
  if (model === 'dall-e-3' && !validQualities.includes(quality)) {
    errors.push(`Qualidade inválida: ${quality}. Use: ${validQualities.join(', ')}`);
  }

  // Validar estilo (apenas para DALL-E 3)
  if (model === 'dall-e-3' && !validStyles.includes(style)) {
    errors.push(`Estilo inválido: ${style}. Use: ${validStyles.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

export default {
  generateImageWithDallE,
  validateDallEParams
};
