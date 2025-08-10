import logger from '../../utils/logger.js';

/**
 * Função para sanitizar mensagens antes de enviar para a IA
 * Remove mensagens órfãs e garante consistência nas tool_calls
 */
export function sanitizeMessagesForChat(messages) {
  const cleanMessages = [];
  const validToolCallIds = new Set();
  
  // Primeira passada: coletar todos os tool_call_ids válidos
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
      const toolCallIds = message.tool_calls.map(tc => tc.id);
      
      // Verificar se todas as tool responses existem para esta mensagem assistant
      let allToolResponsesFound = true;
      const toolResponsesMap = new Map();
      
      // Procurar por todas as tool responses correspondentes
      for (let j = i + 1; j < messages.length; j++) {
        const nextMsg = messages[j];
        if (nextMsg.role === 'tool' && toolCallIds.includes(nextMsg.tool_call_id)) {
          toolResponsesMap.set(nextMsg.tool_call_id, nextMsg);
        }
      }
      
      // Verificar se encontrou resposta para todos os tool_calls
      if (toolResponsesMap.size === toolCallIds.length) {
        // Todas as tool responses existem, adicionar os IDs como válidos
        toolCallIds.forEach(id => validToolCallIds.add(id));
      } else {
        logger.debug('Sanitize', `Mensagem assistant com tool_calls incompletas será removida: esperado ${toolCallIds.length}, encontrado ${toolResponsesMap.size}`);
      }
    }
  }
  
  // Segunda passada: construir mensagens limpas
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    if (message.role === 'assistant' && message.tool_calls && message.tool_calls.length > 0) {
      // Só incluir se todos os tool_calls desta mensagem são válidos
      const toolCallIds = message.tool_calls.map(tc => tc.id);
      const allToolCallsValid = toolCallIds.every(id => validToolCallIds.has(id));
      
      if (allToolCallsValid) {
        cleanMessages.push(message);
      } else {
        logger.debug('Sanitize', `Removendo mensagem assistant órfã com tool_calls: ${toolCallIds.join(', ')}`, message);
      }
    } else if (message.role === 'assistant') {
      // Para mensagens assistant sem tool_calls, verificar se têm conteúdo válido
      if (message.content && message.content.trim().length > 0) {
        cleanMessages.push(message);
      } else {
        logger.debug('Sanitize', 'Removendo mensagem assistant vazia ou sem conteúdo', message);
      }
    } else if (message.role === 'tool') {
      // Só incluir tool messages que correspondem a tool_calls válidos
      if (message.tool_call_id && validToolCallIds.has(message.tool_call_id)) {
        cleanMessages.push(message);
      } else {
        logger.debug('Sanitize', `Removendo mensagem tool órfã: tool_call_id=${message.tool_call_id}`, message);
      }
    } else {
      // Para outras mensagens (user, system, assistant sem tool_calls), sempre incluir
      cleanMessages.push(message);
    }
  }
  
  logger.debug('Sanitize', `Mensagens sanitizadas: ${messages.length} -> ${cleanMessages.length}`);
  return cleanMessages;
}
