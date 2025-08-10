import LtmService from '../services/LtmService.js';
import { normalizeAiResponse } from '../utils/aiResponseUtils.js';
import logger from '../utils/logger.js';

// Core modules
import { sanitizeMessagesForChat } from './processors/messageSanitizer.js';
import STMManager from './memory/stmManager.js';
import ImageProcessor from './processors/imageProcessor.js';
import DynamicPromptBuilder from './prompt/dynamicPromptBuilder.js';
import MCPToolExecutor from './tools/MCPToolExecutor.js';
import MessageAuthHandler from './processors/messageAuthHandler.js';
import AIAnalysisHandler from './processors/aiAnalysisHandler.js';

// Repository imports
import { getUserContext, updateUserContext } from '../repository/contextRepository.js';
import { getUserProfile } from '../repository/userProfileRepository.js';

// Skills imports
import updateUserProfileSummary from '../skills/updateUserProfileSummary.js';

// WhatsApp imports
import simulateTyping from '../whatsapp/simulateTyping.js';

// Config imports
import chatAi from '../config/ai/chat.ai.js';

// Environment config
const groups = JSON.parse(process.env.WHATSAPP_GROUPS) || [];

/**
 * Processador principal de mensagens - Refatorado
 * Núcleo central da aplicação que coordena todo o fluxo de processamento
 */
class MessageProcessor {
  /**
   * Processa mensagem recebida
   * @param {Object} message - Mensagem recebida
   */
  static async processMessage(message) {
    // Gerar ID único para esta mensagem
    const messageId = logger.generateMessageId();
    
    const startTime = Date.now();
    logger.start('MessageProcessor', 'Processamento de mensagem iniciado');
    
    try {
      const { data } = message;
      
      // Log da interação inicial
      logger.interaction('MessageProcessor', 'webhook-received', {
        from: data.from,
        messageType: data.messageType || 'text',
        hasImage: !!data.image
      });
      
      // Verificar autorização da mensagem
      if (!MessageAuthHandler.isMessageAuthorized(data, groups)) {
        logger.debug('MessageProcessor', 'Mensagem não autorizada - ignorando');
        return;
      }

      logger.milestone('MessageProcessor', 'Mensagem autorizada para processamento');
    
      // Feedback imediato: simular digitação no início
      simulateTyping(data.from, true); // Não aguardar - executar em background
    
      // Processar imagens automaticamente se detectadas
      logger.step('MessageProcessor', 'Processando imagens detectadas');
      const { userContent, imageAnalysisResult } = await ImageProcessor.processImage(data);
      const userId = MessageAuthHandler.extractUserId(data.from);
    
      // Carregar dados do usuário
      logger.step('MessageProcessor', 'Carregando contexto e perfil do usuário');
      
      const [
        { messages: rawMessages }, 
        userProfile, 
        ltmContext
      ] = await Promise.all([
        getUserContext(userId),
        getUserProfile(userId),
        LtmService.getRelevantContext(userId, userContent)
      ]);
    
      logger.timing('MessageProcessor', 'Dados do usuário carregados', {
        messagesCount: rawMessages.length,
        hasUserProfile: !!userProfile,
        ltmContextSize: ltmContext?.length || 0
      });
    
      // Sanitizar contexto histórico
      logger.step('MessageProcessor', 'Sanitizando contexto histórico');
      let messages = sanitizeMessagesForChat(rawMessages);
      logger.timing('MessageProcessor', 'Contexto histórico sanitizado', {
        originalCount: rawMessages.length,
        sanitizedCount: messages.length
      });
    
      // Gerenciar STM (Short Term Memory)
      logger.step('MessageProcessor', '🧠 Iniciando gerenciamento STM');
      try {
        messages = await STMManager.manageSTM(messages, userContent, userId, data.from);
        logger.timing('MessageProcessor', '🧠 Gerenciamento STM concluído', {
          finalMessageCount: messages.length
        });
      } catch (error) {
        logger.critical('MessageProcessor', `Erro no gerenciamento STM: ${error.message}`, {
          stack: error.stack
        });
        throw error;
      }

      // Construir prompt dinâmico
      logger.step('MessageProcessor', '🏗️ Construindo prompt dinâmico');
      let dynamicPrompt;
      try {
        dynamicPrompt = DynamicPromptBuilder.buildDynamicPrompt(userProfile, ltmContext, imageAnalysisResult);
        logger.timing('MessageProcessor', '🏗️ Prompt dinâmico construído');
      } catch (error) {
        logger.critical('MessageProcessor', `Erro na construção do prompt: ${error.message}`);
        throw error;
      }

      // Executar análises de IA
      simulateTyping(data.from, true);
      logger.step('MessageProcessor', '🤖 Iniciando análises de IA');
      try {
        const { currentSentiment, inferredStyle } = await AIAnalysisHandler.performAIAnalysis(userContent, userId, userProfile);
        logger.timing('MessageProcessor', '🤖 Análises de IA concluídas', {
          sentiment: currentSentiment,
          style: inferredStyle
        });
      } catch (error) {
        logger.error('MessageProcessor', `Erro nas análises de IA: ${error.message}`);
        // Não interromper o fluxo por erro nas análises
      }

      // Preparar mensagens para chat
      logger.step('MessageProcessor', '💬 Preparando mensagens para chat');
      const chatMessages = [dynamicPrompt, ...messages, { role: 'user', content: userContent }];
      const sanitizedChatMessages = sanitizeMessagesForChat(chatMessages);
    
      // Obter ferramentas disponíveis do MCP dinamicamente
      logger.step('MessageProcessor', '🔧 Obtendo ferramentas do MCP dinamicamente');
      const mcpExecutor = new MCPToolExecutor();
      const dynamicTools = await mcpExecutor.getToolsForOpenAI();
      logger.milestone('MessageProcessor', `${dynamicTools.length} ferramentas obtidas do MCP dinamicamente`);
    
      // Gerar resposta principal da IA com ferramentas dinâmicas
      logger.step('MessageProcessor', '🎯 Gerando resposta principal da IA com ferramentas dinâmicas');
      let response;
      try {
        const aiStartTime = Date.now();
        response = await chatAi(sanitizedChatMessages, dynamicTools);
        const aiEndTime = Date.now();
        
        response = normalizeAiResponse(response);
        
        // Log detalhado da resposta da IA
        logger.aiResponse('MessageProcessor', 'OpenAI', response, {
          requestTime: aiEndTime - aiStartTime,
          messageLength: sanitizedChatMessages.length,
          toolsAvailable: dynamicTools.length
        });
        
        logger.timing('MessageProcessor', '🎯 Resposta principal gerada', {
          aiTime: `${aiEndTime - aiStartTime}ms`,
          hasContent: !!response.message?.content,
          toolCallsCount: response.message?.tool_calls?.length || 0
        });
      } catch (error) {
        logger.critical('MessageProcessor', `Erro ao gerar resposta principal: ${error.message}`);
        
        // Try to send an error message to the user instead of crashing
        try {
          const mcpExecutor = new MCPToolExecutor();
          await mcpExecutor.executeTools([{
            name: 'send_message',
            arguments: {
              content: `❌ Desculpe, ocorreu um erro temporário ao processar sua mensagem. Tente novamente em alguns segundos.\n\nDetalhes: ${error.message.includes('Rate limit') ? 'Limite de uso da IA atingido temporariamente.' : 'Erro interno do sistema.'}`
            }
          }]);
          logger.milestone('MessageProcessor', 'Mensagem de erro enviada ao usuário');
          return; // Exit gracefully
        } catch (fallbackError) {
          logger.critical('MessageProcessor', `Falha ao enviar mensagem de erro: ${fallbackError.message}`);
        }
        
        throw error; // Only throw if we couldn't send error message to user
      }

      // Atualizar mensagens com interação atual
      logger.step('MessageProcessor', '📝 Atualizando mensagens com interação atual');
      messages.push({ role: 'user', content: userContent });
      messages.push(response.message);

      // Executar ciclo de ferramentas
      logger.step('MessageProcessor', '🔧 Iniciando ciclo de ferramentas');
      logger.debug('MessageProcessor', `Response tem tool_calls: ${response.message.tool_calls?.length || 0}`);
      await this._executeToolCycle(messages, response, dynamicTools, data, userContent, imageAnalysisResult, mcpExecutor);
      logger.timing('MessageProcessor', '🔧 Ciclo de ferramentas concluído');

      // Atualizações finais
      logger.step('MessageProcessor', '💾 Realizando atualizações finais');
    
      await updateUserContext(userId, { messages });

      // Atualizações assíncronas em background
      logger.debug('MessageProcessor', 'Iniciando atualizações assíncronas em background');
    
      // Limitar o texto para LTM a um tamanho razoável (aprox. 6000 tokens = 24000 chars)
      const conversationText = messages.map((m) => m.content).join('\n');
      const limitedText = conversationText.length > 24000 
        ? conversationText.substring(conversationText.length - 24000) 
        : conversationText;
      
      updateUserProfileSummary(userId, messages)
        .catch(err => logger.error('MessageProcessor', `Erro ao atualizar resumo do perfil em background: ${err}`));
        
      logger.timing('MessageProcessor', ' Atualizações concluídas');
      
      logger.end('MessageProcessor', `Processamento da mensagem concluído - TEMPO TOTAL: ${Date.now() - startTime}ms`);
      
    } catch (error) {
      logger.critical('MessageProcessor', `Erro crítico no processamento: ${error.message}`, {
        stack: error.stack
      });
      // Tentar enviar uma mensagem de erro para o usuário
      try {
        const { data } = message;
        await simulateTyping(data.from, false);
        
        // Try to use MCP to send error message
        const fallbackMcpExecutor = new MCPToolExecutor();
        await fallbackMcpExecutor.executeTools([{
          name: 'send_message',
          arguments: {
            content: `❌ Ocorreu um erro interno. Por favor, tente novamente em alguns minutos.\n\n${error.message.includes('Rate limit') ? '🕐 Sistema temporariamente sobrecarregado.' : '⚠️ Erro no processamento da mensagem.'}`
          }
        }]);
        
        logger.milestone('MessageProcessor', 'Mensagem de erro enviada ao usuário via MCP');
      } catch (fallbackError) {
        logger.critical('MessageProcessor', `Erro no fallback: ${fallbackError.message}`);
        logger.critical('MessageProcessor', 'CRÍTICO: Não foi possível notificar o usuário sobre o erro');
      }
      
      // Don't re-throw - let the application continue running
      logger.milestone('MessageProcessor', 'Erro tratado - aplicação continuará executando');
    }
  }

  /**
   * Executa ciclo de ferramentas com limite de tentativas
   * @private
   */
  static async _executeToolCycle(messages, response, tools, data, userContent, imageAnalysisResult, mcpExecutor) {
    logger.debug('MessageProcessor', '🎬 === ENTRANDO EM _executeToolCycle ===');
    let toolCycleCount = 0;
    const MAX_TOOL_CYCLES = 3;
    let lastResponse = response.message;
    
    // Rastrear tools executadas para evitar loops
    const executedTools = new Set();
    
    logger.debug('MessageProcessor', `🔧 Iniciando ciclo de ferramentas - Response: ${lastResponse.content ? 'com conteúdo' : 'sem conteúdo'}, Tool calls: ${lastResponse.tool_calls?.length || 0}`);
    
    while (toolCycleCount < MAX_TOOL_CYCLES) {
      logger.debug('MessageProcessor', `🔄 Ciclo ${toolCycleCount + 1}/${MAX_TOOL_CYCLES}`);
      
      if ((lastResponse.tool_calls && lastResponse.tool_calls.length > 0) || lastResponse.function_call) {
        logger.debug('MessageProcessor', `🛠️ Executando ${lastResponse.tool_calls?.length || 1} ferramenta(s)...`);
        
        // Verificar se todas as tools já foram executadas (evitar loop infinito)
        const toolNames = lastResponse.tool_calls?.map(tc => tc.function.name) || [];
        const newTools = toolNames.filter(toolName => !executedTools.has(toolName));
        
        if (newTools.length === 0 && toolCycleCount > 0) {
          logger.warn('MessageProcessor', '🔄 Todas as tools já foram executadas - evitando loop infinito');
          break;
        }
        
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
        
        // Registrar tools executadas
        toolNames.forEach(toolName => executedTools.add(toolName));
        
        logger.debug('MessageProcessor', `📨 Mensagens atualizadas: ${updatedMessages.length} total`);
        logger.debug('MessageProcessor', `🔍 Tools executadas até agora: ${Array.from(executedTools).join(', ')}`);
        
        // DEBUG: Verificar estrutura das mensagens após execução das tools
        const lastMessages = updatedMessages.slice(-5);
        logger.debug('MessageProcessor', '🔍 DEBUG - Últimas 5 mensagens após execução das tools:');
        lastMessages.forEach((msg, index) => {
          logger.debug('MessageProcessor', `  ${index}: role=${msg.role}, content="${msg.content?.substring(0, 50) || 'null'}...", tool_calls=${msg.tool_calls?.length || 0}, tool_call_id=${msg.tool_call_id || 'undefined'}`);
        });
        
        // Atualizar referência das mensagens
        messages.length = 0;
        messages.push(...updatedMessages);
        
        // Verificar se alguma das tools executadas foi send_message
        const hasSendMessage = lastResponse.tool_calls?.some(tc => tc.function.name === 'send_message');
        
        logger.debug('MessageProcessor', `🔍 Verificando send_message: hasSendMessage=${hasSendMessage}, executedTools.has('send_message')=${executedTools.has('send_message')}`);
        
        if (hasSendMessage) {
          logger.debug('MessageProcessor', '✅ Send_message executado - finalizando ciclo');
          break;
        } else if (executedTools.has('send_message')) {
          logger.debug('MessageProcessor', '✅ Send_message já foi executado anteriormente - finalizando ciclo');
          break;
        } else {
          logger.debug('MessageProcessor', '🔄 Tools executadas, fazendo nova chamada à IA para possível send_message');
          
          // Fazer nova chamada à IA para que possa decidir próximos passos
          try {
            logger.debug('MessageProcessor', `📝 Mensagens antes da nova chamada IA: ${messages.length} total`);
            const aiResponse = await chatAi(messages, tools);
            messages.push({
              role: 'assistant',
              content: aiResponse.message.content || '',
              tool_calls: aiResponse.message.tool_calls || []
            });
            
            lastResponse = aiResponse.message;
            logger.debug('MessageProcessor', `🤖 Nova resposta da IA com ${lastResponse.tool_calls?.length || 0} tool calls`);
            logger.debug('MessageProcessor', `🤖 Conteúdo da resposta: "${lastResponse.content?.substring(0, 100)}..."`);
            
            // Verificar condições de parada
            if (this._shouldStopToolCycle(lastResponse)) {
              logger.debug('MessageProcessor', '🛑 Condição de parada atingida após nova chamada IA');
              break;
            }
          } catch (error) {
            logger.error('MessageProcessor', 'Erro ao fazer nova chamada à IA:', error);
            break;
          }
        }
      } else if (lastResponse.tool_calls && lastResponse.tool_calls.length > 0) {
        // Fallback: garantir que toda tool_call tenha uma mensagem tool
        logger.debug('MessageProcessor', '⚠️ Fallback: Adicionando respostas para tool_calls órfãas');
        this._addFallbackToolResponses(messages, lastResponse);
        break;
      } else {
        // Se não há tool_calls, encerra ciclo
        logger.debug('MessageProcessor', '✅ Sem tool_calls - encerrando ciclo normalmente');
        break;
      }
      toolCycleCount++;
    }

    logger.debug('MessageProcessor', '🔍 Verificando necessidade de fallback final...');
    // Fallback final se não houve resposta send_message
    await this._handleFinalFallback(messages, data);
  }

  /**
   * Verifica se deve parar o ciclo de ferramentas
   * @private
   */
  static _shouldStopToolCycle(lastResponse) {
    // Parar apenas se send_message foi executado (resposta final ao usuário)
    if (lastResponse.tool_calls && lastResponse.tool_calls.some(tc => tc.function.name === 'send_message')) {
      logger.debug('MessageProcessor', 'Send_message detectado - encerrando ciclo de ferramentas');
      return true;
    }
    
    // Não há tool_calls - pode continuar para permitir novas chamadas de IA
    if (!lastResponse.tool_calls || lastResponse.tool_calls.length === 0) {
      logger.debug('MessageProcessor', 'Sem tool_calls - permitindo nova iteração da IA');
      return false;
    }
    
    // Continuar o ciclo para permitir que a IA faça novas chamadas após executar tools
    logger.debug('MessageProcessor', 'Tools executadas - permitindo nova iteração da IA');
    return false;
  }

  /**
   * Adiciona respostas de fallback para tool_calls órfãas
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
      logger.debug('MessageProcessor', `Fallback: Adicionada resposta de erro para tool_call_id=${toolCall.id}`);
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
    
    logger.debug('MessageProcessor', `🔍 Verificação send_message: ${hasSendMessage ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
    
    if (!hasSendMessage) {
      logger.warn('MessageProcessor', '⚠️ Fallback final: Solicitando à LLM uma mensagem amigável de erro.');
      
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
        logger.debug('MessageProcessor', '🤖 Gerando resposta de fallback...');
        fallbackResponse = await chatAi(fallbackPrompt);
      } catch (err) {
        logger.error('MessageProcessor', `❌ Erro ao gerar fallback: ${err.message}`);
        fallbackResponse = { message: { content: 'Desculpe, não consegui atender ao seu pedido neste momento.' } };
      }
      
      const fallbackContent = fallbackResponse?.message?.content || 'Desculpe, não consegui atender ao seu pedido neste momento.';
      
      logger.debug('MessageProcessor', `📨 Criando mensagem de fallback: "${fallbackContent.substring(0, 50)}..."`);
      
      const fallbackAssistant = {
        role: 'assistant',
        content: null,
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
      logger.info('MessageProcessor', '✅ Fallback final: Mensagem de erro amigável enviada ao usuário.');
    } else {
      logger.debug('MessageProcessor', '✅ Send_message encontrado - não precisa de fallback');
    }
  }
}

// Exportar função compatível com a API existente
export default async function processMessage(message) {
  return MessageProcessor.processMessage(message);
}
