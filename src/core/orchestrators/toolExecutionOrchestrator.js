import { sanitizeMessagesForChat } from '../processors/messageSanitizer.js';
import STMManager from '../memory/stmManager.js';
import chatAi from '../../config/ai/chat.ai.js';
import logger from '../../utils/logger.js';

/**
 * Orquestrador dedicado à execução de ferramentas (tools)
 * Gerencia o ciclo complexo de execução de ferramentas com detecção de loops
 */
class ToolExecutionOrchestrator {
  static MAX_TOOL_CYCLES = 3;

  /**
   * Executa o ciclo completo de ferramentas
   */

  static async executeToolCycle(messages, response, tools, data, userContent, imageAnalysisResult, mcpExecutor) {
    logger.debug('ToolExecutionOrchestrator', '🎬 === ENTRANDO EM executeToolCycle ===');
    
    let toolCycleCount = 0;
    let lastResponse = response.message;
    const executedTools = new Set();
    logger.debug('ToolExecutionOrchestrator', `🔧 Iniciando ciclo de ferramentas - Response: ${lastResponse.content ? 'com conteúdo' : 'sem conteúdo'}, Tool calls: ${lastResponse.tool_calls?.length || 0}`);
    let sendMessageFound = false;
    // Novo: lista para armazenar tool_call_ids removidos por deduplicação
    let dedupedToolCalls = [];

    // Novo: rastrear prompts de image_generation já executados neste ciclo
    const executedImagePrompts = new Set();

    while (toolCycleCount < this.MAX_TOOL_CYCLES) {
      logger.debug('ToolExecutionOrchestrator', `🔄 Ciclo ${toolCycleCount + 1}/${this.MAX_TOOL_CYCLES}`);

      if ((lastResponse.tool_calls && lastResponse.tool_calls.length > 0) || lastResponse.function_call) {
        // Verificar loops de image_generation
        const { lastResponse: dedupedResponse, dedupedToolCalls: removedToolCalls } = this._handleImageGenerationLoopsWithDedup(messages, lastResponse);
        lastResponse = dedupedResponse;
        dedupedToolCalls = removedToolCalls;

        if (lastResponse.tool_calls && lastResponse.tool_calls.length === 0) {
          logger.debug('ToolExecutionOrchestrator', '✅ Loop de image_generation resolvido - finalizando ciclo');
          // Adicionar respostas de erro para tool_call_ids deduplicados
          for (const tc of dedupedToolCalls) {
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: `Prompt duplicado detectado: "${tc.prompt?.substring(0, 60) || ''}". Nenhuma ação executada para evitar repetição.`
            });
            logger.debug('ToolExecutionOrchestrator', `Resposta de deduplicação adicionada para tool_call_id=${tc.id}`);
          }
          break;
        }

        // Bloquear prompts de image_generation já executados neste ciclo
        if (lastResponse.tool_calls) {
          // Lista para armazenar tool_calls ignorados por já terem sido executados
          const skippedToolCalls = [];
          lastResponse.tool_calls = lastResponse.tool_calls.filter(tc => {
            if (tc.function?.name === 'image_generation') {
              try {
                const prompt = JSON.parse(tc.function.arguments).prompt;
                if (executedImagePrompts.has(prompt)) {
                  logger.debug('ToolExecutionOrchestrator', `🛑 Prompt de image_generation já executado neste ciclo: "${prompt?.substring(0, 60) || ''}". Ignorando.`);
                  skippedToolCalls.push({ id: tc.id, prompt });
                  return false;
                }
                executedImagePrompts.add(prompt);
              } catch (e) {}
            }
            return true;
          });
          // Adiciona mensagens de tool para cada tool_call_id ignorado
          for (const tc of skippedToolCalls) {
            messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: `Prompt já executado neste ciclo: "${tc.prompt?.substring(0, 60) || ''}". Nenhuma ação executada para evitar repetição.`
            });
            logger.debug('ToolExecutionOrchestrator', `Resposta de ciclo já executado adicionada para tool_call_id=${tc.id}`);
          }
        }

        // Executar ferramentas
        const updatedMessages = await this._executeTools(
          messages, lastResponse, tools, data, userContent, imageAnalysisResult, mcpExecutor
        );

        messages.length = 0;
        messages.push(...updatedMessages);

        // Adicionar respostas de erro para tool_call_ids deduplicados
        for (const tc of dedupedToolCalls) {
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: `Prompt duplicado detectado: "${tc.prompt?.substring(0, 60) || ''}". Nenhuma ação executada para evitar repetição.`
          });
          logger.debug('ToolExecutionOrchestrator', `Resposta de deduplicação adicionada para tool_call_id=${tc.id}`);
        }

        // Interceptar erro crítico de tool (ex: Cannot find module)
        const lastToolMsg = messages.slice().reverse().find(m => m.role === 'tool' && typeof m.content === 'string');
        if (lastToolMsg && /Cannot find module|ferramenta não encontrada|falhou ao executar/i.test(lastToolMsg.content)) {
          logger.warn('ToolExecutionOrchestrator', `[ROBUST-TOOL-ERROR] Erro crítico detectado na tool: ${lastToolMsg.content}`);
          await this._handleFinalFallback(messages, data);
          break;
        }

        // Verificar se send_message foi executado
        sendMessageFound = lastResponse.tool_calls?.some(tc => tc.function.name === 'send_message');
        if (sendMessageFound) {
          logger.debug('ToolExecutionOrchestrator', '✅ Send_message executado - finalizando ciclo');
          break;
        }

        // Fazer nova chamada à IA
        lastResponse = await this._makeFollowUpAICall(messages, tools);

      } else if (lastResponse.tool_calls && lastResponse.tool_calls.length > 0) {
        logger.debug('ToolExecutionOrchestrator', '⚠️ Fallback: Adicionando respostas para tool_calls órfãs');
        this._addFallbackToolResponses(messages, lastResponse);
        break;
      } else {
        logger.debug('ToolExecutionOrchestrator', '✅ Sem tool_calls - encerrando ciclo normalmente');
        break;
      }

      toolCycleCount++;
    }

    // Fallback final se necessário (garante resposta ao usuário)
    const hasValidSendMessage = messages.some(m =>
      m.role === 'assistant' &&
      m.tool_calls &&
      m.tool_calls.some(tc => tc.function.name === 'send_message') &&
      (
        // Verifica se há conteúdo não nulo/vazio associado ao send_message
        (typeof m.content === 'string' && m.content.trim().length > 0) ||
        (Array.isArray(m.content) && m.content.length > 0)
      )
    );
    if ((!hasValidSendMessage && !sendMessageFound) || messages.filter(m => m.role === 'assistant' && m.tool_calls && m.tool_calls.some(tc => tc.function.name === 'send_message')).every(m => !m.content || (typeof m.content === 'string' && m.content.trim().length === 0))) {
      logger.warn('ToolExecutionOrchestrator', '[ROBUST-FALLBACK] Nenhum send_message válido (com conteúdo) detectado após ciclo de ferramentas. Forçando fallback para garantir resposta ao usuário.');
      await this._handleFinalFallback(messages, data);
    }
  }

  /**
   * Detecta e trata loops de geração de imagem
   * @private
   */
  // Nova versão: retorna também os tool_call_ids removidos
  static _handleImageGenerationLoopsWithDedup(messages, lastResponse) {
    const toolNames = lastResponse.tool_calls?.map(tc => tc.function.name) || [];
    const hasRecentImageGeneration = toolNames.includes('image_generation');
    if (!hasRecentImageGeneration) {
      return { lastResponse, dedupedToolCalls: [] };
    }

    // Obter prompts e ids das solicitações
    const dedupedToolCalls = [];
    const currentImagePrompts = lastResponse.tool_calls
      .filter(tc => tc.function.name === 'image_generation')
      .map(tc => {
        try {
          const args = JSON.parse(tc.function.arguments);
          return { prompt: args.prompt, id: tc.id };
        } catch (e) {
          return { prompt: null, id: tc.id };
        }
      });

    for (const { prompt, id } of currentImagePrompts) {
      if (!prompt) continue;
      // Só deduplicar se houver repetição no mesmo ciclo (mesma mensagem)
      const currentCycleImageCalls = lastResponse.tool_calls
        .filter(tc => tc.function.name === 'image_generation')
        .map(tc => {
          try { return JSON.parse(tc.function.arguments).prompt; } catch (e) { return null; }
        })
        .filter(p => p && p === prompt);
      const isImmediateLoop = currentCycleImageCalls.length > 1;
      // Não bloqueia mais repetições em mensagens diferentes do usuário
      if (isImmediateLoop) {
        logger.debug('ToolExecutionOrchestrator', `🖼️ LOOP detectado - prompt "${prompt?.substring(0, 50) || ''}..." repetido no mesmo ciclo - removendo duplicação`);
        dedupedToolCalls.push({ id, prompt });
      }
    }
    // Remover tool_calls duplicadas
    lastResponse.tool_calls = lastResponse.tool_calls.filter(tc => {
      try {
        if (tc.function.name !== 'image_generation') return true;
        const args = JSON.parse(tc.function.arguments);
        return !dedupedToolCalls.some(d => d.id === tc.id);
      } catch (e) {
        return true;
      }
    });
    return { lastResponse, dedupedToolCalls };
  }

  /**
   * Executa as ferramentas
   * @private
   */
  static async _executeTools(messages, lastResponse, tools, data, userContent, imageAnalysisResult, mcpExecutor) {
    logger.debug('ToolExecutionOrchestrator', `🛠️ Executando ${lastResponse.tool_calls?.length || 1} ferramenta(s)...`);
    
    const updatedMessages = await mcpExecutor.executeTools(
      messages, 
      { message: lastResponse }, 
      tools, 
      data.from, 
      data.id, 
      userContent, 
      data, 
      imageAnalysisResult
    );
    
    logger.debug('ToolExecutionOrchestrator', `📨 Mensagens atualizadas: ${updatedMessages.length} total`);
    
    // DEBUG: Log das últimas mensagens
    const lastMessages = updatedMessages.slice(-5);
    logger.debug('ToolExecutionOrchestrator', '🔍 DEBUG - Últimas 5 mensagens após execução:');
    lastMessages.forEach((msg, index) => {
      logger.debug('ToolExecutionOrchestrator', `  ${index}: role=${msg.role}, content="${msg.content?.substring(0, 50) || 'null'}...", tool_calls=${msg.tool_calls?.length || 0}, tool_call_id=${msg.tool_call_id || 'undefined'}`);
    });
    
    return updatedMessages;
  }

  /**
   * Faz nova chamada à IA após execução de ferramentas
   * @private
   */
  static async _makeFollowUpAICall(messages, tools) {
    logger.debug('ToolExecutionOrchestrator', '🔄 Fazendo nova chamada à IA para possível send_message');
    
    try {
      logger.debug('ToolExecutionOrchestrator', `📝 Mensagens antes da nova chamada IA: ${messages.length} total`);
      const aiResponse = await chatAi(messages, tools, 'auto');
      
      const newAssistantMessage = { role: 'assistant' };

      if (aiResponse.message.tool_calls && aiResponse.message.tool_calls.length > 0) {
        newAssistantMessage.tool_calls = aiResponse.message.tool_calls;
        newAssistantMessage.content = null;
      } else {
        newAssistantMessage.content = aiResponse.message.content || '';
      }

      messages.push(newAssistantMessage);
      
      const lastResponse = aiResponse.message;
      logger.debug('ToolExecutionOrchestrator', `🤖 Nova resposta da IA com ${lastResponse.tool_calls?.length || 0} tool calls`);
      logger.debug('ToolExecutionOrchestrator', `🤖 Conteúdo da resposta: "${lastResponse.content?.substring(0, 100)}..."`);
      
      return lastResponse;
    } catch (error) {
      logger.error('ToolExecutionOrchestrator', 'Erro ao fazer nova chamada à IA:', error);
      throw error;
    }
  }

  /**
   * Adiciona respostas de fallback para tool_calls órfãs
   * @private
   */
  static _addFallbackToolResponses(messages, lastResponse) {
    for (const toolCall of lastResponse.tool_calls) {
      const fallbackResponse = {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: 'Erro: ferramenta não encontrada ou falhou ao executar.',
      };
      messages.push(fallbackResponse);
      logger.debug('ToolExecutionOrchestrator', `Fallback: Adicionada resposta de erro para tool_call_id=${toolCall.id}`);
    }
  }

  /**
   * Lida com fallback final quando não há send_message
   * @private
   */
  static async _handleFinalFallback(messages, data) {
    const hasSendMessage = messages.some(m => 
      m.role === 'assistant' && 
      m.tool_calls && 
      m.tool_calls.some(tc => tc.function.name === 'send_message')
    );
    
    logger.debug('ToolExecutionOrchestrator', `🔍 Verificação send_message: ${hasSendMessage ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
    
    if (!hasSendMessage) {
      logger.warn('ToolExecutionOrchestrator', '⚠️ Fallback final: Solicitando à LLM uma mensagem amigável de erro.');
      
      const sanitizedFallbackHistory = sanitizeMessagesForChat(
        messages.slice(-STMManager.constants.MAX_STM_MESSAGES)
      );
      
      const fallbackPrompt = [
        {
          role: 'system',
          content: 'Você falhou em obter uma resposta útil usando ferramentas. Gere uma mensagem amigável para o usuário explicando que não foi possível atender ao pedido, sem citar ferramentas ou detalhes técnicos. Seja educado e sugira alternativas se possível.'
        },
        ...sanitizedFallbackHistory
      ];
      
      let fallbackResponse;
      try {
        logger.debug('ToolExecutionOrchestrator', '🤖 Gerando resposta de fallback...');
        fallbackResponse = await chatAi(fallbackPrompt);
      } catch (err) {
        logger.error('ToolExecutionOrchestrator', `❌ Erro ao gerar fallback: ${err.message}`);
        fallbackResponse = { message: { content: 'Desculpe, não consegui atender ao seu pedido neste momento.' } };
      }
      
      const fallbackContent = fallbackResponse?.message?.content || 'Desculpe, não consegui atender ao seu pedido neste momento.';
      
      logger.debug('ToolExecutionOrchestrator', `📨 Criando mensagem de fallback: "${fallbackContent.substring(0, 50)}..."`);
      
      const fallbackAssistant = {
        role: 'assistant',
        content: fallbackContent,
        tool_calls: [
          {
            id: `call_fallback_${Date.now()}`,
            type: 'function',
            function: {
              name: 'send_message',
              arguments: JSON.stringify({ content: fallbackContent })
            }
          }
        ],
        refusal: null,
        annotations: []
      };
      
      messages.push(fallbackAssistant);
      
      const fallbackTool = {
        role: 'tool',
        tool_call_id: fallbackAssistant.tool_calls[0].id,
        content: `Mensagem enviada ao usuário: "${fallbackContent}"`
      };
      
      messages.push(fallbackTool);
      logger.info('ToolExecutionOrchestrator', '✅ Fallback final: Mensagem de erro amigável enviada ao usuário.');
    } else {
      logger.debug('ToolExecutionOrchestrator', '✅ Send_message encontrado - não precisa de fallback');
    }
  }
}

export default ToolExecutionOrchestrator;
