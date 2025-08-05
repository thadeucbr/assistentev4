import 'dotenv/config';
import { logError } from '../utils/logger.js';

async function getBase64Image(id) {
  if (!id) {
    console.error('getBase64Image: id is required');
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
      console.error('getBase64Image error:', json.error || json);
      return false;
    }
  } catch (err) {
    logError(err, `getBase64Image - Failed to get base64 image for id: ${id}`);
    console.error('getBase64Image exception:', err);
    return false;
  }
}

async function analyzeImageWithOllama(base64Image, prompt) {
  const endpoint = process.env.OLLAMA_ANALYZE_URL || 'http://localhost:11434/api/generate';
  const payload = {
    model: process.env.OLLAMA_ANALYZE_MODEL || 'llava',
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
    console.log(`AnalyzeImage error: ${JSON.stringify(json)}`);
    console.log(`AnalyzeImage error status: ${res.status}`);
    return `Error: ${res.status}`;
  }
  const json = await res.json();
  console.log(`AnalyzeImage response: ${JSON.stringify(json)}`);
  return json.response;
}

async function analyzeImageWithOpenAI(base64Image, prompt) {
  const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
  const OPENAI_MODEL = 'gpt-4o-mini'; // ou outro modelo de visão da OpenAI
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_KEY) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }

  const payload = {
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: base64Image
            }
          }
        ]
      }
    ],
    max_tokens: 300
  };

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI chat failed: ${res.status} ${errText}`);
  }

  const json = await res.json();
  return json.choices[0].message.content;
}

export default async function analyzeImage({ id, prompt = 'Descreva detalhadamente tudo o que está presente nesta imagem, se houver, transcreva todos os textos visíveis na imagem.' }) {
  try {
    console.log(`Initializing analyzeImage with prompt: ${prompt}`);
    const base64Image = await getBase64Image(id);
    if (!base64Image) {
      return 'Error: Could not retrieve image data.';
    }

    const provider = process.env.AI_PROVIDER;

    if (provider === 'openai') {
      return await analyzeImageWithOpenAI(base64Image, prompt);
    } else {
      // Default to ollama if provider is not openai or not set
      return await analyzeImageWithOllama(base64Image, prompt);
    }
  } catch (err) {
    logError(err, `analyzeImage - Failed to analyze image with prompt: "${prompt}"`);
    return { error: err.message || 'Erro desconhecido', stack: err.stack || undefined };
  }
}