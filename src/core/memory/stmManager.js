import { chatModel } from '../../lib/langchain.js';
import logger from '../../utils/logger.js';

// --- Configuration Constants ---
// Número máximo de mensagens a serem mantidas na STM antes de truncar.
const MAX_STM_MESSAGES = 20;
// Total de caracteres na STM que dispara a sumarização. (Aprox. 2.5k tokens)
const MAX_STM_CHARS_HARD_LIMIT = 10000;
// Número de mensagens recentes a serem mantidas "quentes" (não sumarizadas).
const HOT_MESSAGES_TO_KEEP = 4;

/**
 * Remove ou trunca campos que parecem ser strings base64 longas.
 * Isso previne que o histórico de contexto seja poluído por dados de imagem.
 */
function sanitizeBase64Fields(content, maxLength = 200) {
  if (typeof content !== 'string') return content;
  try {
    const obj = JSON.parse(content);
    let changed = false;
    function walk(o) {
      for (const k in o) {
        if (typeof o[k] === 'string' && o[k].length > maxLength && /^(?:[A-Za-z0-9+/=]{100,})$/.test(o[k].slice(0, 200))) {
          o[k] = `[base64 truncado: ${o[k].length} chars]`;
          changed = true;
        } else if (typeof o[k] === 'object' && o[k] !== null) {
          walk(o[k]);
        }
      }
    }
    walk(obj);
    return changed ? JSON.stringify(obj) : content;
  } catch {
    if (content.length > maxLength && /^(?:[A-Za-z0-9+/=]{100,})$/.test(content.slice(0, 200))) {
      return `[base64 truncado: ${content.length} chars]`;
    }
    return content;
  }
}

/**
 * Gerencia a Memória de Curto Prazo (STM) de forma proativa,
 * focando em sumarização para manter o contexto dentro dos limites.
 */
export default class STMManager {
  /**
   * Gerencia a STM aplicando sumarização proativa se os limites forem excedidos.
   * @param {Array} messages - As mensagens atuais da conversa.
   * @returns {Promise<Array>} - As mensagens da STM otimizadas.
   */
  static async manageSTM(messages) {
    logger.debug('STMManager', `Iniciando gerenciamento da STM com ${messages.length} mensagens.`);

    // Etapa 1: Sanitização inicial para remover base64 e calcular tamanho real.
    const sanitizedMessages = messages.map(m => {
        if (m.content && typeof m.content === 'string') {
            return { ...m, content: sanitizeBase64Fields(m.content) };
        }
        return m;
    });

    const totalChars = sanitizedMessages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
    logger.debug('STMManager', `Tamanho atual da STM: ${sanitizedMessages.length} mensagens, ${totalChars} caracteres.`);

    // Etapa 2: Verificar se a sumarização é necessária.
    const needsSummarization = totalChars > MAX_STM_CHARS_HARD_LIMIT || sanitizedMessages.length > MAX_STM_MESSAGES;

    if (!needsSummarization) {
      logger.debug('STMManager', 'STM dentro dos limites. Nenhuma ação necessária.');
      return sanitizedMessages;
    }

    logger.milestone('STMManager', `STM excedeu os limites (${totalChars} chars, ${sanitizedMessages.length} msgs). Iniciando sumarização proativa.`);

    // Etapa 3: Executar a sumarização.
    try {
      const systemMessage = sanitizedMessages.find(msg => msg.role === 'system');
      const conversationMessages = sanitizedMessages.filter(msg => msg.role !== 'system');

      if (conversationMessages.length <= HOT_MESSAGES_TO_KEEP) {
        logger.warn('STMManager', 'A sumarização foi acionada, mas há poucas mensagens para dividir. Retornando mensagens como estão para evitar erro.');
        return sanitizedMessages;
      }
      
      const hotMessages = conversationMessages.slice(-HOT_MESSAGES_TO_KEEP);
      const messagesToSummarize = conversationMessages.slice(0, -HOT_MESSAGES_TO_KEEP);

      const summaryPrompt = `
        Você é um assistente de IA especialista em otimização de contexto.
        Abaixo está um histórico de conversa que precisa ser resumido.
        Seu objetivo é criar um resumo conciso em um único parágrafo que capture os pontos essenciais,
        fatos importantes, e o estado atual da conversa para que a IA principal possa continuar o diálogo sem perder o fio da meada.
        O resumo substituirá este histórico antigo. Seja breve e eficiente.
        Responda APENAS com o resumo em texto puro.

        Histórico a ser resumido:
        ${messagesToSummarize.map(m => `[${m.role}]: ${m.content}`).join('\n')}
      `;

      logger.debug('STMManager', `Sumarizando ${messagesToSummarize.length} mensagens...`);

      const summaryResponse = await chatModel.invoke(summaryPrompt);
      const summaryText = summaryResponse.content;

      if (!summaryText || summaryText.trim().length === 0) {
          throw new Error("A sumarização da IA retornou um conteúdo vazio.");
      }

      const summaryMessage = {
        role: 'assistant',
        content: `Resumo da conversa anterior: ${summaryText}`
      };

      logger.milestone('STMManager', `Sumarização concluída. Resumo: "${summaryText.slice(0, 100)}..."`);

      // Etapa 4: Construir a nova STM otimizada.
      const optimizedSTM = [];
      if (systemMessage) {
        optimizedSTM.push(systemMessage);
      }
      optimizedSTM.push(summaryMessage);
      optimizedSTM.push(...hotMessages);

      const newTotalChars = optimizedSTM.reduce((acc, m) => acc + (m.content?.length || 0), 0);
      logger.milestone('STMManager', `STM otimizada. De ${totalChars} para ${newTotalChars} caracteres. De ${sanitizedMessages.length} para ${optimizedSTM.length} mensagens.`);

      return optimizedSTM;

    } catch (error) {
      logger.error('STMManager', `Falha crítica durante a sumarização da STM: ${error.message}`, { stack: error.stack });
      logger.warn('STMManager', 'Retornando as mensagens mais recentes como fallback para evitar falha total.');
      // Como fallback, retorna as mensagens mais recentes para não quebrar o fluxo.
      return sanitizedMessages.slice(-MAX_STM_MESSAGES);
    }
  }

  /**
   * Getter para constantes da STM, útil para outros módulos.
   */
  static get constants() {
    return {
      MAX_STM_MESSAGES,
      MAX_STM_CHARS_HARD_LIMIT,
      HOT_MESSAGES_TO_KEEP
    };
  }
}
