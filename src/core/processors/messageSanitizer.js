import logger from '../../utils/logger.js';

/**
 * Função para sanitizar mensagens antes de enviar para a IA
 * Remove mensagens órfãs e garante consistência nas tool_calls
 */
export function sanitizeMessagesForChat(messages) {
  const cleanMessages = [];
  const validToolCallIds = new Set();
  const debugInfo = {
    originalCount: messages.length,
    removedAssistant: 0,
    removedTool: 0,
    orphanedToolCalls: [],
    incompleteToolCalls: []
  };
  
  logger.debug('Sanitize', `Iniciando sanitização de ${messages.length} mensagens`);
  
  // Primeira passada: coletar todos os tool_call_ids válidos
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
      const toolCallIds = message.tool_calls.map(tc => tc.id);
      
      logger.debug('Sanitize', `Analisando assistant message [${i}] com ${toolCallIds.length} tool_calls: ${toolCallIds.join(', ')}`);
      
      // Verificar se todas as tool responses existem para esta mensagem assistant
      let allToolResponsesFound = true;
      const toolResponsesMap = new Map();
      const foundResponses = [];
      
      // Procurar por todas as tool responses correspondentes
      for (let j = i + 1; j < messages.length; j++) {
        const nextMsg = messages[j];
        if (nextMsg.role === 'tool' && toolCallIds.includes(nextMsg.tool_call_id)) {
          toolResponsesMap.set(nextMsg.tool_call_id, nextMsg);
          foundResponses.push(`[${j}] tool_call_id=${nextMsg.tool_call_id}`);
        }
      }
      
      logger.debug('Sanitize', `  Procurando respostas para tool_calls: ${toolCallIds.join(', ')}`);
      logger.debug('Sanitize', `  Encontradas ${toolResponsesMap.size}/${toolCallIds.length} respostas: ${foundResponses.join(', ')}`);
      
      // Verificar se encontrou resposta para todos os tool_calls
      if (toolResponsesMap.size === toolCallIds.length) {
        // Todas as tool responses existem, adicionar os IDs como válidos
        toolCallIds.forEach(id => validToolCallIds.add(id));
        logger.debug('Sanitize', `  ✅ Todos os tool_calls têm respostas - marcando como válidos`);
      } else {
        const missingIds = toolCallIds.filter(id => !toolResponsesMap.has(id));
        debugInfo.incompleteToolCalls.push({
          assistantIndex: i,
          expected: toolCallIds,
          found: Array.from(toolResponsesMap.keys()),
          missing: missingIds
        });
        logger.warn('Sanitize', `  ❌ Tool_calls incompletos - esperado ${toolCallIds.length}, encontrado ${toolResponsesMap.size}`, {
          expected: toolCallIds,
          found: Array.from(toolResponsesMap.keys()),
          missing: missingIds
        });
      }
    }
  }
  
  // Segunda passada: construir mensagens limpas
  logger.debug('Sanitize', `Segunda passada - construindo mensagens limpas usando ${validToolCallIds.size} tool_call_ids válidos`);
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
      // Só incluir se todos os tool_calls desta mensagem são válidos
      const toolCallIds = message.tool_calls.map(tc => tc.id);
      const allToolCallsValid = toolCallIds.every(id => validToolCallIds.has(id));
      
      if (allToolCallsValid) {
        cleanMessages.push(message);
        logger.debug('Sanitize', `  ✅ [${i}] Assistant com tool_calls válidos mantida`);
      } else {
        debugInfo.removedAssistant++;
        const invalidIds = toolCallIds.filter(id => !validToolCallIds.has(id));
        logger.warn('Sanitize', `  🗑️ [${i}] Removendo assistant órfã com tool_calls inválidos`, {
          allToolCalls: toolCallIds,
          invalidToolCalls: invalidIds,
          toolNames: message.tool_calls?.map(tc => tc.function?.name) || []
        });
      }
    } else if (message.role === 'assistant') {
      // Para mensagens assistant sem tool_calls, verificar se têm conteúdo válido
      if (message.content && message.content.trim().length > 0) {
        cleanMessages.push(message);
        logger.debug('Sanitize', `  ✅ [${i}] Assistant com conteúdo mantida`);
      } else {
        debugInfo.removedAssistant++;
        logger.warn('Sanitize', `  🗑️ [${i}] Removendo assistant vazia ou sem conteúdo`, {
          content: message.content,
          contentLength: message.content?.length || 0
        });
      }
    } else if (message.role === 'tool') {
      // Só incluir tool messages que correspondem a tool_calls válidos
      if (message.tool_call_id && validToolCallIds.has(message.tool_call_id)) {
        cleanMessages.push(message);
        logger.debug('Sanitize', `  ✅ [${i}] Tool response mantida (tool_call_id=${message.tool_call_id})`);
      } else {
        debugInfo.removedTool++;
        debugInfo.orphanedToolCalls.push({
          index: i,
          tool_call_id: message.tool_call_id,
          content: message.content?.substring(0, 100) + '...',
          hasValidId: !!message.tool_call_id,
          isInValidSet: message.tool_call_id ? validToolCallIds.has(message.tool_call_id) : false
        });
        logger.warn('Sanitize', `  🗑️ [${i}] Removendo tool órfã`, {
          tool_call_id: message.tool_call_id || 'undefined',
          hasValidId: !!message.tool_call_id,
          isInValidSet: message.tool_call_id ? validToolCallIds.has(message.tool_call_id) : false,
          contentPreview: message.content?.substring(0, 100) + '...',
          validToolCallIds: Array.from(validToolCallIds)
        });
      }
    } else {
      // Para outras mensagens (user, system), sempre incluir
      cleanMessages.push(message);
      logger.debug('Sanitize', `  ✅ [${i}] ${message.role} message mantida`);
    }
  }
  
  // Log final com resumo detalhado
  logger.milestone('Sanitize', `Sanitização concluída: ${debugInfo.originalCount} → ${cleanMessages.length}`, {
    removed: {
      assistant: debugInfo.removedAssistant,
      tool: debugInfo.removedTool,
      total: debugInfo.removedAssistant + debugInfo.removedTool
    },
    kept: cleanMessages.length,
    validToolCallIds: Array.from(validToolCallIds),
    issues: {
      incompleteToolCalls: debugInfo.incompleteToolCalls.length,
      orphanedTools: debugInfo.orphanedToolCalls.length
    }
  });
  
  // Se houver problemas, logar detalhes adicionais
  if (debugInfo.incompleteToolCalls.length > 0) {
    logger.error('Sanitize', `Detectados ${debugInfo.incompleteToolCalls.length} conjuntos de tool_calls incompletos`, {
      details: debugInfo.incompleteToolCalls
    });
  }
  
  if (debugInfo.orphanedToolCalls.length > 0) {
    logger.error('Sanitize', `Detectados ${debugInfo.orphanedToolCalls.length} tool responses órfãos`, {
      details: debugInfo.orphanedToolCalls
    });
  }
  
  return cleanMessages;
}
