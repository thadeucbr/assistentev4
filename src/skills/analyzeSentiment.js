
import chatAi from '../config/ai/chat.ai.js';
import { extractContent } from '../utils/aiResponseUtils.js';
import { logError } from '../utils/logger.js';

const SENTIMENT_ANALYSIS_PROMPT = {
  role: 'system',
  content: 'Você é um especialista em análise de sentimento. Analise o texto do usuário e classifique-o como "positivo", "neutro" ou "negativo". Responda apenas com uma dessas três palavras.'
};

export default async function analyzeSentiment(text) {
  try {
    const messages = [
      SENTIMENT_ANALYSIS_PROMPT,
      { role: 'user', content: text }
    ];
    const response = await chatAi(messages, []);
    
    // Extrair o conteúdo usando a função utilitária
    const content = extractContent(response);
    const sentiment = content.toLowerCase().trim();

    if (['positivo', 'neutro', 'negativo'].includes(sentiment)) {
      return sentiment;
    } else {
      return 'neutro'; // Retorna neutro em caso de resposta inesperada
    }
  } catch (error) {
    logError(error, `analyzeSentiment - Failed to analyze sentiment for text: "${text}"`);
    console.error('Erro ao analisar sentimento:', error);
    return 'neutro'; // Retorna neutro em caso de erro
  }
}
