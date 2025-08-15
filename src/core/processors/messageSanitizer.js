import logger from '../../utils/logger.js';

const MAX_HISTORY_LENGTH = 50; // Max number of messages to keep

/**
 * Função para sanitizar mensagens antes de enviar para a IA
 * - Remove mensagens de usuário duplicadas e consecutivas.
 * - Trunca o histórico para evitar sobrecarga de tokens.
 * - Remove mensagens órfãs e garante consistência nas tool_calls.
 */
export function sanitizeMessagesForChat(messages) {
  logger.debug('Sanitize', `Iniciando sanitização completa de ${messages.length} mensagens`);

  // Etapa 1: Remover mensagens de usuário duplicadas e consecutivas
  const uniqueUserMessages = [];
  if (messages.length > 0) {
    // Adiciona a última mensagem incondicionalmente para começar a comparação
    uniqueUserMessages.push(messages[messages.length - 1]);

    for (let i = messages.length - 2; i >= 0; i--) {
      const currentMsg = messages[i];
      const lastAddedMsg = uniqueUserMessages[uniqueUserMessages.length - 1];

      // Se a mensagem atual e a última adicionada são do usuário e têm o mesmo conteúdo, ignore a atual.
      if (
        currentMsg.role === 'user' &&
        lastAddedMsg.role === 'user' &&
        currentMsg.content === lastAddedMsg.content
      ) {
        logger.warn('Sanitize', `Removendo mensagem de usuário duplicada consecutiva no índice ${i}`);
        continue;
      }
      uniqueUserMessages.push(currentMsg);
    }
    uniqueUserMessages.reverse(); // Reverter para a ordem cronológica original
  }

  const dedupedMessages = uniqueUserMessages;
  if (messages.length !== dedupedMessages.length) {
      logger.milestone('Sanitize', `Removidas ${messages.length - dedupedMessages.length} mensagens de usuário duplicadas. ${messages.length} -> ${dedupedMessages.length}`);
  }

  // Etapa 2: Truncar histórico se exceder o limite
  let truncatedMessages = dedupedMessages;
  if (dedupedMessages.length > MAX_HISTORY_LENGTH) {
    logger.warn('Sanitize', `Histórico com ${dedupedMessages.length} mensagens excede o limite de ${MAX_HISTORY_LENGTH}. Truncando...`);
    const systemMessage = dedupedMessages.find(msg => msg.role === 'system');
    const recentMessages = dedupedMessages.slice(-MAX_HISTORY_LENGTH);

    truncatedMessages = systemMessage && !recentMessages.includes(systemMessage)
      ? [systemMessage, ...recentMessages]
      : recentMessages;

    logger.milestone('Sanitize', `Histórico truncado para ${truncatedMessages.length} mensagens.`);
  }


  // Etapa 3: Sanitização de tool_calls (lógica original)
  const cleanMessages = [];
  const validToolCallIds = new Set();
  const debugInfo = {
    originalCount: truncatedMessages.length,
    removedAssistant: 0,
    removedTool: 0,
    orphanedToolCalls: [],
    incompleteToolCalls: []
  };

  // Primeira passada: coletar todos os tool_call_ids válidos
  for (let i = 0; i < truncatedMessages.length; i++) {
    const message = truncatedMessages[i];
    if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
      const toolCallIds = message.tool_calls.map(tc => tc.id);
      let allToolResponsesFound = true;
      const toolResponsesMap = new Map();
      
      for (let j = i + 1; j < truncatedMessages.length; j++) {
        const nextMsg = truncatedMessages[j];
        if (nextMsg.role === 'tool' && toolCallIds.includes(nextMsg.tool_call_id)) {
          toolResponsesMap.set(nextMsg.tool_call_id, nextMsg);
        }
      }
      
      if (toolResponsesMap.size === toolCallIds.length) {
        toolCallIds.forEach(id => validToolCallIds.add(id));
      } else {
        const missingIds = toolCallIds.filter(id => !toolResponsesMap.has(id));
        debugInfo.incompleteToolCalls.push({ assistantIndex: i, missing: missingIds });
      }
    }
  }

  // Segunda passada: construir mensagens limpas
  for (let i = 0; i < truncatedMessages.length; i++) {
    const message = truncatedMessages[i];
    
    if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
      const toolCallIds = message.tool_calls.map(tc => tc.id);
      const allToolCallsValid = toolCallIds.every(id => validToolCallIds.has(id));
      if (allToolCallsValid) {
        cleanMessages.push(message);
      } else {
        debugInfo.removedAssistant++;
      }
    } else if (message.role === 'assistant') {
      if (message.content && message.content.trim().length > 0) {
        cleanMessages.push(message);
      } else {
        debugInfo.removedAssistant++;
      }
    } else if (message.role === 'tool') {
      if (message.tool_call_id && validToolCallIds.has(message.tool_call_id)) {
        cleanMessages.push(message);
      } else {
        debugInfo.removedTool++;
        debugInfo.orphanedToolCalls.push({ index: i, tool_call_id: message.tool_call_id });
      }
    } else {
      cleanMessages.push(message);
    }
  }
  
  logger.milestone('Sanitize', `Sanitização de tool_calls concluída: ${debugInfo.originalCount} → ${cleanMessages.length}`, {
    removed: {
      assistant: debugInfo.removedAssistant,
      tool: debugInfo.removedTool,
      total: debugInfo.removedAssistant + debugInfo.removedTool
    },
    kept: cleanMessages.length,
  });

  return cleanMessages;
}
