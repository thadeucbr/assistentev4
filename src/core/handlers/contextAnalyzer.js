import { chatAi } from '../../config/ai/chat.ai.js';
import logger from '../../utils/logger.js';

/**
 * Analisador de Contexto Situacional (Roteador de Intenção)
 * Utiliza um modelo de linguagem para classificar a intenção do usuário
 * e determinar o contexto da situação atual.
 */
class ContextAnalyzer {
  /**
   * Determina o tipo de situação contextual usando um LLM para classificação.
   * @param {string} userContent - A mensagem mais recente do usuário.
   * @param {Array} messageHistory - O histórico de mensagens da conversa.
   * @returns {Promise<string|null>} - O tipo de situação (ex: 'complex_task') ou null.
   */
  static async determineSituationalContext(userContent, messageHistory) {
    logger.debug('ContextAnalyzer', 'Determinando tipo de situação via LLM...');

    const history = messageHistory
      .slice(-4) // Pega as últimas 4 mensagens para contexto
      .map((msg) => `[${msg.role}]: ${typeof msg.content === 'string' ? msg.content.substring(0, 200) : '...'})`)
      .join('\n');

    const prompt = `
      Você é um "Roteador de Intenção" para uma IA. Sua única tarefa é analisar a ÚLTIMA mensagem do usuário e o histórico da conversa para classificar a intenção principal em uma das seguintes categorias. Responda APENAS com a categoria, em letras minúsculas e snake_case.

      Categorias Válidas:
      - 'greeting': Uma saudação simples ou conversa fiada inicial.
      - 'simple_question': Uma pergunta direta que provavelmente pode ser respondida com uma única ferramenta ou conhecimento básico.
      - 'complex_task': Um pedido que requer múltiplos passos, planejamento, ou o uso de várias ferramentas (ex: "planeje minha viagem", "escreva um roteiro").
      - 'creative_request': Um pedido para gerar conteúdo criativo como uma imagem, um poema, uma história.
      - 'error_recovery': O usuário está relatando um erro, expressando frustração com um problema anterior, ou o sistema precisa se corrigir.
      - 'follow_up': O usuário está continuando um tópico da mensagem anterior, fazendo uma pergunta de acompanhamento.
      - 'user_feedback': O usuário está fornecendo feedback sobre o assistente.
      - 'chit_chat': Conversa casual, não relacionada a uma tarefa específica.

      ---
      Histórico Recente da Conversa:
      ${history}
      ---
      ÚLTIMA MENSAGEM DO USUÁRIO:
      "${userContent}"
      ---

      Com base na ÚLTIMA mensagem e no histórico, qual é a categoria da intenção? Responda APENAS com a categoria.
    `;

    try {
      const response = await chatAi(
        [{ role: 'user', content: prompt }],
        null, // Sem ferramentas para esta chamada
        null, // Sem forçar ferramenta
        0.1   // Baixa temperatura para classificação
      );

      const situationType = response.message?.content?.trim().toLowerCase() || 'unknown';

      // Validação para garantir que a resposta está entre as categorias esperadas
      const validCategories = ['greeting', 'simple_question', 'complex_task', 'creative_request', 'error_recovery', 'follow_up', 'user_feedback', 'chit_chat'];
      if (validCategories.includes(situationType)) {
        logger.milestone('ContextAnalyzer', `Situação determinada via LLM: ${situationType}`);
        return situationType;
      } else {
        logger.warn('ContextAnalyzer', `LLM retornou uma categoria de situação inválida: "${situationType}". Usando 'simple_question' como padrão.`);
        return 'simple_question'; // Fallback para uma situação comum
      }
    } catch (error) {
      logger.error('ContextAnalyzer', `Erro ao determinar situação via LLM: ${error.message}`);
      // Em caso de erro na chamada da IA, retorna null para não quebrar o fluxo.
      return null;
    }
  }
}

export default ContextAnalyzer;
