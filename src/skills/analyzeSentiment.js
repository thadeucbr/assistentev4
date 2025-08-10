
import chatAi from '../config/ai/chat.ai.js';
import { extractContent } from '../utils/aiResponseUtils.js';
import logger from '../utils/logger.js';

const SENTIMENT_ANALYSIS_PROMPT = {
  role: 'system',
  content: 'Você é um especialista em análise de sentimento. Analise o texto do usuário e classifique-o como "positivo", "neutro" ou "negativo". Responda apenas com uma dessas três palavras.'
};

export default async function analyzeSentiment(text) {
  try {
    logger.step('AnalyzeSentiment', 'Analisando sentimento do texto');
    
    const messages = [
      SENTIMENT_ANALYSIS_PROMPT,
      { role: 'user', content: text }
    ];
    const response = await chatAi(messages, []);
    
    // Extrair o conteúdo usando a função utilitária
    const content = extractContent(response);
    const sentiment = content.toLowerCase().trim();

    if (['positivo', 'neutro', 'negativo'].includes(sentiment)) {
      logger.debug('AnalyzeSentiment', `Sentimento analisado: ${sentiment}`, {
        textLength: text.length,
        sentiment
      });
      return sentiment;
    } else {
      logger.warn('AnalyzeSentiment', `Resposta inesperada da IA: ${content}`, {
        textLength: text.length,
        unexpectedResponse: content
      });
      return 'neutro'; // Retorna neutro em caso de resposta inesperada
    }
  } catch (error) {
    logger.error('AnalyzeSentiment', `Erro ao analisar sentimento: ${error.message}`, {
      textLength: text.length,
      textPreview: text.substring(0, 100),
      stack: error.stack
    });
    return 'neutro'; // Retorna neutro em caso de erro
  }
}
