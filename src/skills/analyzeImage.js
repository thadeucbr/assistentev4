import 'dotenv/config';
import logger, { logError } from '../utils/logger.js';
import { analyzeImageWithOpenAIVision } from '../services/OpenAIVisionService.js';

async function getBase64Image(id) {
  if (!id) {
  logger.error('analyzeImage', 'getBase64Image: id is required');
    return false;
  }
  try {
    const payload = {
      args: {
        message: id
      }
    };
    const res = await fetch(`${process.env.WHATSAPP_URL}/decryptMedia`, {
      method: 'POST',
      headers: {
        'api_key': process.env.WHATSAPP_SECRET,
        'Content-Type': 'application/json',
        'accept': '*/*'
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.success && json.response) {
      return json.response;
    } else {
  logger.error('analyzeImage', 'getBase64Image error', { error: json.error || json });
      return false;
    }
  } catch (err) {
  logError(err, `getBase64Image - Failed to get base64 image for id: ${id}`);
  logger.error('analyzeImage', 'getBase64Image exception', { error: err });
    return false;
  }
}

async function analyzeImageWithOllama(base64Image, prompt) {
  logger.info('analyzeImage', 'Usando Ollama para análise de imagem (processamento local)...');
  
  const endpoint = process.env.OLLAMA_ANALYZE_URL || 'http://localhost:11434/api/generate';
  const model = process.env.OLLAMA_IMAGE_ANALYZE_MODEL || process.env.OLLAMA_ANALYZE_MODEL || 'llava';
  
  logger.debug('analyzeImage', `Endpoint Ollama: ${endpoint}`);
  logger.debug('analyzeImage', `Modelo Ollama: ${model}`);
  
  const payload = {
    model: model,
    prompt: prompt,
    stream: false,
    images: [base64Image.replace('data:image/jpeg;base64,', '')]
  };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (res.status !== 200) {
    const json = await res.json();
  logger.error('analyzeImage', `AnalyzeImage error: ${JSON.stringify(json)}`);
  logger.error('analyzeImage', `AnalyzeImage error status: ${res.status}`);
    return `Error: ${res.status}`;
  }
  const json = await res.json();
  logger.debug('analyzeImage', `AnalyzeImage response: ${JSON.stringify(json)}`);
  return json.response;
}

async function analyzeImageWithOpenAI(base64Image, prompt) {
  logger.info('analyzeImage', 'Usando OpenAI Vision Service para análise de imagem...');
  
  const result = await analyzeImageWithOpenAIVision(base64Image, prompt);
  
  if (result.success) {
    return result.content;
  } else {
    throw new Error(result.error || 'Falha na análise com OpenAI Vision');
  }
}

export default async function analyzeImage({ id, prompt = 'Descreva detalhadamente tudo o que está presente nesta imagem, se houver, transcreva todos os textos visíveis na imagem.' }) {
  try {
  logger.info('analyzeImage', `Initializing analyzeImage with prompt: ${prompt}`);
    const base64Image = await getBase64Image(id);
    if (!base64Image) {
      return 'Error: Could not retrieve image data.';
    }

    // Usar a nova variável de ambiente específica para análise de imagem
    const provider = process.env.IMAGE_ANALYSIS_PROVIDER || process.env.AI_PROVIDER;
    
  logger.info('analyzeImage', `Using image analysis provider: ${provider}`);

    if (provider === 'openai') {
  logger.info('analyzeImage', 'Usando OpenAI para análise de imagem (processamento remoto)');
      return await analyzeImageWithOpenAI(base64Image, prompt);
    } else {
  logger.info('analyzeImage', 'Usando Ollama para análise de imagem (processamento local)');
      // Default to ollama if provider is not openai or not set
      return await analyzeImageWithOllama(base64Image, prompt);
    }
  } catch (err) {
    logError(err, `analyzeImage - Failed to analyze image with prompt: "${prompt}"`);
    return { error: err.message || 'Erro desconhecido', stack: err.stack || undefined };
  }
}