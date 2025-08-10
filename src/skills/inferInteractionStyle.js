import chatAi from '../config/ai/chat.ai.js';
import { retryAiJsonCall } from '../utils/aiResponseUtils.js';
import logger from '../utils/logger.js';

const SYSTEM_PROMPT = {
  role: 'system',
  content: `Você é um analista de estilo de comunicação. Sua tarefa é analisar a mensagem do usuário e inferir seu estilo de interação em termos de formalidade, humor, tom e verbosidade. Sua resposta DEVE ser APENAS um objeto JSON, sem nenhum texto adicional.

Exemplos de formalidade: 'formal', 'informal', 'neutro'.
Exemplos de humor: 'sarcastic', 'funny', 'direct', 'none'.
Exemplos de tom: 'friendly', 'neutral', 'demanding', 'curious'.
Exemplos de verbosidade: 'concise', 'detailed'.

Se não conseguir inferir uma característica, use 'unknown'.

Exemplo de resposta JSON:
{
  "formality": "informal",
  "humor": "sarcastic",
  "tone": "friendly",
  "verbosity": "concise"
}`
};

export default async function inferInteractionStyle(userMessage) {
  const defaultStyle = {
    formality: 'unknown',
    humor: 'unknown',
    tone: 'unknown',
    verbosity: 'unknown',
  };

  logger.step('InferInteractionStyle', 'Inferindo estilo de interação do usuário');

  // Função que faz a chamada de IA, recebendo o número da tentativa
  const makeAiCall = async (attemptNumber) => {
    let messages = [
      SYSTEM_PROMPT,
      { role: 'user', content: userMessage }
    ];

    // Para retries, adiciona instrução específica sobre o formato JSON
    if (attemptNumber > 0) {
      messages.push({
        role: 'user',
        content: 'Por favor, responda APENAS com um objeto JSON válido, sem nenhum texto adicional antes ou depois.'
      });
    }

    return await chatAi(messages, []);
  };

  try {
    // Usar a função de retry com JSON
    const result = await retryAiJsonCall(makeAiCall, 3, 1000);
    
    if (result.success) {
      logger.debug('InferInteractionStyle', 'Estilo de interação inferido com sucesso', {
        messageLength: userMessage.length,
        inferredStyle: result.data
      });
      return result.data;
    } else {
      logger.warn('InferInteractionStyle', 'Todas as tentativas de inferir estilo falharam, usando estilo padrão', {
        messageLength: userMessage.length,
        attempts: 3
      });
      return defaultStyle;
    }
  } catch (error) {
    logger.error('InferInteractionStyle', `Erro ao inferir estilo de interação: ${error.message}`, {
      messageLength: userMessage.length,
      messagePreview: userMessage.substring(0, 100),
      stack: error.stack
    });
    return defaultStyle;
  }
}
