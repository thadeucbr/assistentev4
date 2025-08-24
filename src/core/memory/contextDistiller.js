import chatAi from '../../config/ai/chat.ai.js';
import logger from '../../utils/logger.js';

/**
 * Destilador de Contexto
 * Responsável por analisar um turno de conversa e resumi-lo de forma concisa
 * para armazenamento de longo prazo, focando no que foi realizado.
 */
class ContextDistiller {
  /**
   * Analisa e resume o último turno de uma conversa.
   * @param {Array} messages - O histórico completo de mensagens da sessão.
   * @returns {Promise<Array>} - Um novo histórico de mensagens com o último turno sumarizado.
   */
  static async distill(messages) {
    logger.debug('ContextDistiller', 'Iniciando destilação do último turno da conversa.');

    // Encontrar o índice da última mensagem do usuário para isolar o turno.
    const lastUserMessageIndex = messages.map(m => m.role).lastIndexOf('user');

    // Se não houver mensagem de usuário, não há o que destilar.
    if (lastUserMessageIndex === -1) {
      logger.debug('ContextDistiller', 'Nenhuma mensagem de usuário encontrada. Nenhuma destilação necessária.');
      return messages;
    }

    const lastTurnMessages = messages.slice(lastUserMessageIndex);
    const previousMessages = messages.slice(0, lastUserMessageIndex);

    // Verifica se o turno contém chamadas de ferramenta, que são o alvo principal da destilação.
    const hasToolCalls = lastTurnMessages.some(m => m.role === 'assistant' && m.tool_calls);
    if (!hasToolCalls) {
      logger.debug('ContextDistiller', 'O último turno não contém tool_calls. Nenhuma destilação necessária.');
      return messages;
    }

    const turnAsString = this.formatTurnForSummary(lastTurnMessages);

    const prompt = `
      Você é um "Destilador de Contexto" para a memória de um assistente de IA.
      Sua tarefa é analisar o turno de uma conversa (o pedido do usuário e a subsequente execução de ferramentas pela IA)
      e criar um resumo extremamente conciso em um único parágrafo.
      O resumo deve focar no **resultado** e na **realização** da IA, não nos detalhes técnicos das chamadas de API.
      Este resumo substituirá todo o turno no histórico de longo prazo.

      Exemplo:
      - Turno Original: O usuário pede para enviar 4 imagens e 4 textos. A IA faz 8 chamadas de ferramenta (4 para gerar imagens, 4 para enviar textos).
      - Seu Resumo Ideal: "Atendendo ao pedido do usuário, gerei e enviei uma narrativa visual composta por 4 imagens e 4 textos intercalados, contando uma história fictícia sobre a personagem Brenda."

      ---
      Turno da Conversa para Analisar:
      ${turnAsString}
      ---

      Agora, gere o resumo conciso em um único parágrafo do que o assistente realizou neste turno.
      Responda APENAS com o texto do resumo.
    `;

    try {
      const response = await chatAi(
        [{ role: 'user', content: prompt }],
        null, 0.1
      );

      const summary = response.message?.content?.trim();
      if (!summary) {
        throw new Error('A destilação da IA retornou um conteúdo vazio.');
      }

      const distilledMessage = {
        role: 'assistant',
        content: summary,
      };

      logger.milestone('ContextDistiller', `Turno destilado com sucesso: "${summary.substring(0, 150)}..."`);

      // Retorna o histórico anterior mais a mensagem do usuário e o novo resumo do assistente.
      return [...previousMessages, messages[lastUserMessageIndex], distilledMessage];

    } catch (error) {
      logger.error('ContextDistiller', `Falha na destilação do contexto: ${error.message}`);
      // Em caso de falha, retorna as mensagens originais para não perder o contexto.
      return messages;
    }
  }

  /**
   * Formata as mensagens de um turno em uma string legível para o LLM.
   * @param {Array} turnMessages - As mensagens do turno a serem formatadas.
   * @returns {string} - Uma string representando o turno.
   */
  static formatTurnForSummary(turnMessages) {
    let content = '';
    turnMessages.forEach(msg => {
      if (msg.role === 'user') {
        content += `Usuário pediu: "${msg.content}"\n`;
      } else if (msg.role === 'assistant' && msg.tool_calls) {
        content += `Assistente decidiu usar as seguintes ferramentas:\n`;
        msg.tool_calls.forEach(tool => {
          content += `- ${tool.function.name} com argumentos: ${tool.function.arguments}\n`;
        });
      } else if (msg.role === 'tool') {
        content += `Resultado da ferramenta ${msg.tool_call_id}: "${msg.content}"\n`;
      }
    });
    return content;
  }
}

export default ContextDistiller;
