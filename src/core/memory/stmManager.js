// Remove ou trunca campos base64 de objetos JSON em mensagens
function sanitizeBase64Fields(content, maxLength = 200) {
  if (typeof content !== 'string') return content;
  try {
    // Detecta JSON
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
    // Não é JSON, tenta detectar base64 "cru"
    if (content.length > maxLength && /^(?:[A-Za-z0-9+/=]{100,})$/.test(content.slice(0, 200))) {
      return `[base64 truncado: ${content.length} chars]`;
    }
    return content;
  }
}
import { embeddingModel, chatModel } from '../../lib/langchain.js';
import { cosineSimilarity } from './cosineSimilarity.js';
import LtmService from '../../services/LtmService.js';
import simulateTyping from '../../whatsapp/simulateTyping.js';
import logger from '../../utils/logger.js';

const MAX_STM_MESSAGES = 10; // Número máximo de mensagens na STM
const SUMMARIZE_THRESHOLD = 7; // Limite para acionar a sumarização

/**
 * Gerencia a Memória de Curto Prazo (STM) com reranking e sumarização
 */
export default class STMManager {
  /**
   * Gerencia a STM aplicando reranking baseado em similaridade e sumarização
   * @param {Array} messages - Mensagens da STM atual
   * @param {string} userContent - Conteúdo da mensagem do usuário
   * @param {string} userId - ID do usuário
   * @param {string} fromNumber - Número do WhatsApp para typing simulation
   * @returns {Promise<Array>} - Mensagens otimizadas da STM
   */
  static async manageSTM(messages, userContent, userId, fromNumber) {
  logger.debug('STMManager', 'Gerenciando memória de curto prazo (STM)...');
  // Sanitiza base64 em todas as mensagens antes de processar
  let currentSTM = messages.map(m => {
    if (typeof m.content === 'string') {
      return { ...m, content: sanitizeBase64Fields(m.content) };
    }
    return m;
  });
  logger.debug('STMManager', `STM inicial: ${currentSTM.length} mensagens`);
  logger.debug('STMManager', `Resumo STM inicial: ${currentSTM.map(m => `[${m.role}] ${typeof m.content === 'string' ? m.content.slice(0, 80) : '[obj]'}`).join(' | ')}`);

  const hotMessages = currentSTM.slice(-SUMMARIZE_THRESHOLD);
  const warmMessages = currentSTM.slice(0, currentSTM.length - SUMMARIZE_THRESHOLD);

  if (warmMessages.length > 0 && currentSTM.length >= MAX_STM_MESSAGES) {
      logger.info('STMManager', 'Aplicando reranking e sumarização da STM...');
      
      const stmTypingPromise = simulateTyping(fromNumber, true);
      
      const userEmbedding = await embeddingModel.embedQuery(userContent);

      const messagesWithEmbeddings = await Promise.all(
        warmMessages.map(async (msg) => {
          if ((msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string' && msg.content.length > 0) {
            const embedding = await embeddingModel.embedQuery(msg.content);
            return { ...msg, embedding };
          }
          return msg; // Retorna a mensagem sem embedding se o conteúdo for nulo ou vazio
        })
      );

      const rankedWarmMessages = messagesWithEmbeddings
        .map((msg) => {
          if (msg.embedding) {
            return { ...msg, similarity: cosineSimilarity(userEmbedding, msg.embedding) };
          }
          return { ...msg, similarity: -1 };
        })
        .sort((a, b) => b.similarity - a.similarity);

      const numWarmMessagesToKeep = MAX_STM_MESSAGES - hotMessages.length;
      const keptWarmMessages = rankedWarmMessages.slice(0, numWarmMessagesToKeep);

      const keptMessageContents = new Set(keptWarmMessages.map(m => m.content));
      const messagesToSummarize = warmMessages.filter(m => !keptMessageContents.has(m.content));

      if (messagesToSummarize.length > 0) {
        logger.debug('STMManager', 'Sumarizando mensagens antigas para LTM...');
        const summaryContent = messagesToSummarize.map(m => m.content).join('\n');
        
        // Limitar o tamanho do conteúdo antes de sumarizar (aprox. 6000 tokens = 24000 chars)
        const limitedContent = summaryContent.length > 24000 
          ? summaryContent.substring(0, 24000) + '\n[...conteúdo truncado...]'
          : summaryContent;
          
        const summaryResponse = await chatModel.invoke([
          { role: 'system', content: 'Resuma o seguinte trecho de conversa de forma concisa, focando nos fatos e informações importantes.' },
          { role: 'user', content: limitedContent }
        ]);
        LtmService.summarizeAndStore(userId, summaryResponse.content)
            .catch(err => logger.error('STMManager', `Erro ao sumarizar para LTM em background: ${err}`));
      }

  const optimizedMessages = [...hotMessages, ...keptWarmMessages.map(m => ({ role: m.role, content: m.content }))];
  logger.debug('STMManager', `STM otimizada: ${optimizedMessages.length} mensagens`);
  logger.debug('STMManager', `Resumo STM otimizada: ${optimizedMessages.map(m => `[${m.role}] ${typeof m.content === 'string' ? m.content.slice(0, 80) : '[obj]'}`).join(' | ')}`);
  logger.debug('STMManager', `Total de caracteres STM otimizada: ${optimizedMessages.reduce((acc, m) => acc + (typeof m.content === 'string' ? m.content.length : 0), 0)}`);
  await stmTypingPromise;
  return optimizedMessages;

    } else if (currentSTM.length > MAX_STM_MESSAGES) {
      logger.debug('STMManager', 'Truncando STM por janela deslizante...');
      const truncated = currentSTM.slice(-MAX_STM_MESSAGES);
      logger.debug('STMManager', `STM truncada: ${truncated.length} mensagens`);
      logger.debug('STMManager', `Resumo STM truncada: ${truncated.map(m => `[${m.role}] ${typeof m.content === 'string' ? m.content.slice(0, 80) : '[obj]'}`).join(' | ')}`);
      logger.debug('STMManager', `Total de caracteres STM truncada: ${truncated.reduce((acc, m) => acc + (typeof m.content === 'string' ? m.content.length : 0), 0)}`);
      return truncated;
    }

  logger.debug('STMManager', `STM final (sem alterações): ${currentSTM.length} mensagens`);
  logger.debug('STMManager', `Resumo STM final: ${currentSTM.map(m => `[${m.role}] ${typeof m.content === 'string' ? m.content.slice(0, 80) : '[obj]'}`).join(' | ')}`);
  logger.debug('STMManager', `Total de caracteres STM final: ${currentSTM.reduce((acc, m) => acc + (typeof m.content === 'string' ? m.content.length : 0), 0)}`);
  return currentSTM;
  }

  /**
   * Getter para constantes da STM
   */
  static get constants() {
    return {
      MAX_STM_MESSAGES,
      SUMMARIZE_THRESHOLD
    };
  }
}
