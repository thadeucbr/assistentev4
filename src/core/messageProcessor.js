import LtmService from '../services/LtmService.js';
import { normalizeAiResponse } from '../utils/aiResponseUtils.js';
import logger from '../utils/logger.js';

// Core modules
import { sanitizeMessagesForChat } from './processors/messageSanitizer.js';
import STMManager from './memory/stmManager.js';
import ImageProcessor from './processors/imageProcessor.js';
import DynamicPromptBuilder from './prompt/dynamicPromptBuilder.js';
import HybridToolExecutor from './tools/HybridToolExecutor.js';
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
import tools from '../config/ai/tools.ai.js';

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
    logger.start('MessageProcessor', 'Iniciando processamento da mensagem');
    
    try {
      const { data } = message;
      
      // Verificar autorização da mensagem
      if (!MessageAuthHandler.isMessageAuthorized(data, groups)) {
        logger.debug('MessageProcessor', 'Mensagem não autorizada - ignorando');
        return;
      }

      let stepTime = Date.now();
      logger.milestone('MessageProcessor', 'Mensagem autorizada para processamento');
    
    // Feedback imediato: simular digitação no início
    simulateTyping(data.from, true); // Não aguardar - executar em background
    
    // Processar imagens automaticamente se detectadas
    const { userContent, imageAnalysisResult } = await ImageProcessor.processImage(data);
    const userId = MessageAuthHandler.extractUserId(data.from);
    
    // Carregar dados do usuário
    stepTime = Date.now();
    logger.debug('MessageProcessor', 'Carregando contexto e perfil do usuário...');
    
    const [
      { messages: rawMessages }, 
      userProfile, 
      ltmContext
    ] = await Promise.all([
      getUserContext(userId),
      getUserProfile(userId),
      LtmService.getRelevantContext(userId, userContent)
    ]);
    
    logger.timing('MessageProcessor', 'Dados do usuário carregados');
    
    // Sanitizar contexto histórico
    stepTime = Date.now();
    logger.debug('MessageProcessor', 'Sanitizando contexto histórico...');
    let messages = sanitizeMessagesForChat(rawMessages);
    logger.timing('MessageProcessor', 'Contexto histórico sanitizado');
    
    // Gerenciar STM (Short Term Memory)
    stepTime = Date.now();
    logger.debug('MessageProcessor', '🧠 Iniciando gerenciamento STM...');
    try {
      messages = await STMManager.manageSTM(messages, userContent, userId, data.from);
      logger.timing('MessageProcessor', '🧠 Gerenciamento STM concluído');
    } catch (error) {
      logger.error('MessageProcessor', `❌ Erro no gerenciamento STM: ${error.message}`);
      logger.error('MessageProcessor', `Stack: ${error.stack}`);
      throw error;
    }

    // Construir prompt dinâmico
    stepTime = Date.now();
    logger.debug('MessageProcessor', '🏗️ Construindo prompt dinâmico...');
    let dynamicPrompt;
    try {
      dynamicPrompt = DynamicPromptBuilder.buildDynamicPrompt(userProfile, ltmContext, imageAnalysisResult);
      logger.timing('MessageProcessor', '🏗️ Prompt dinâmico construído');
    } catch (error) {
      logger.error('MessageProcessor', `❌ Erro na construção do prompt: ${error.message}`);
      throw error;
    }

    // Executar análises de IA
    stepTime = Date.now();
    simulateTyping(data.from, true);
    logger.debug('MessageProcessor', '🤖 Iniciando análises de IA...');
    try {
      const { currentSentiment, inferredStyle } = await AIAnalysisHandler.performAIAnalysis(userContent, userId, userProfile);
      logger.timing('MessageProcessor', '🤖 Análises de IA concluídas');
    } catch (error) {
      logger.error('MessageProcessor', `❌ Erro nas análises de IA: ${error.message}`);
      throw error;
    }

    // Preparar mensagens para chat
    logger.debug('MessageProcessor', '💬 Preparando mensagens para chat...');
    const chatMessages = [dynamicPrompt, ...messages, { role: 'user', content: userContent }];
    const sanitizedChatMessages = sanitizeMessagesForChat(chatMessages);
    
    // Gerar resposta principal da IA
    stepTime = Date.now();
    logger.debug('MessageProcessor', '🎯 Gerando resposta principal da IA...');
    let response;
    try {
      response = await chatAi(sanitizedChatMessages);
      response = normalizeAiResponse(response);
      logger.timing('MessageProcessor', '🎯 Resposta principal gerada');
    } catch (error) {
      logger.error('MessageProcessor', `❌ Erro ao gerar resposta principal: ${error.message}`);
      throw error;
    }

    // Atualizar mensagens com interação atual
    logger.debug('MessageProcessor', '📝 Atualizando mensagens com interação atual...');
    messages.push({ role: 'user', content: userContent });
    messages.push(response.message);

    // Executar ciclo de ferramentas
    logger.debug('MessageProcessor', '🔧 Iniciando ciclo de ferramentas...');
    await this._executeToolCycle(messages, response, tools, data, userContent, imageAnalysisResult);
    logger.debug('MessageProcessor', '🔧 Ciclo de ferramentas concluído');

    // Atualizações finais
    stepTime = Date.now();
    logger.debug('MessageProcessor', '💾 Realizando atualizações finais...');
    
    await updateUserContext(userId, { messages });

    // Atualizações assíncronas em background
    logger.debug('MessageProcessor', '📚 Iniciando atualizações assíncronas em background...');
    LtmService.summarizeAndStore(userId, messages.map((m) => m.content).join('\n'))
        .catch(err => logger.error('MessageProcessor', `Erro ao armazenar na LTM em background: ${err}`));

    updateUserProfileSummary(userId, messages)
      .catch(err => logger.error('MessageProcessor', `Erro ao atualizar resumo do perfil em background: ${err}`));
      
    logger.timing('MessageProcessor', '💾 Atualizações concluídas');
    
    logger.end('MessageProcessor', `Processamento da mensagem concluído - TEMPO TOTAL: ${Date.now() - startTime}ms`);
    
    } catch (error) {
      logger.error('MessageProcessor', `❌ Erro crítico no processamento: ${error.message}`);
      logger.error('MessageProcessor', `Stack trace: ${error.stack}`);
      
      // Tentar enviar uma mensagem de erro para o usuário
      try {
        const { data } = message;
        await simulateTyping(data.from, false);
        // Aqui você pode adicionar um fallback para enviar uma mensagem de erro
      } catch (fallbackError) {
        logger.error('MessageProcessor', `❌ Erro no fallback: ${fallbackError.message}`);
      }
      
      throw error; // Re-throw para que seja capturado pelos logs gerais
    }
  }

  /**
   * Executa ciclo de ferramentas com limite de tentativas
   * @private
   */
  static async _executeToolCycle(messages, response, tools, data, userContent, imageAnalysisResult) {
    let toolCycleCount = 0;
    const MAX_TOOL_CYCLES = 3;
    let lastResponse = response.message;
    
    logger.debug('MessageProcessor', `🔧 Iniciando ciclo de ferramentas - Response: ${lastResponse.content ? 'com conteúdo' : 'sem conteúdo'}, Tool calls: ${lastResponse.tool_calls?.length || 0}`);
    
    // Inicializar executor híbrido
    const hybridExecutor = new HybridToolExecutor();
    
    while (toolCycleCount < MAX_TOOL_CYCLES) {
      logger.debug('MessageProcessor', `🔄 Ciclo ${toolCycleCount + 1}/${MAX_TOOL_CYCLES}`);
      
      if ((lastResponse.tool_calls && lastResponse.tool_calls.length > 0) || lastResponse.function_call) {
        logger.debug('MessageProcessor', `🛠️ Executando ${lastResponse.tool_calls?.length || 1} ferramenta(s)...`);
        
        const updatedMessages = await hybridExecutor.executeTools(
          messages, 
          { message: lastResponse }, 
          tools, 
          data.from, 
          data.id, 
          userContent, 
          data, 
          imageAnalysisResult
        );
        
        logger.debug('MessageProcessor', `📨 Mensagens atualizadas: ${updatedMessages.length} total`);
        
        // Atualizar referência das mensagens
        messages.length = 0;
        messages.push(...updatedMessages);
        
        // Buscar a última mensagem assistant gerada
        const lastAssistantMsg = messages.filter(m => m.role === 'assistant').slice(-1)[0];
        if (lastAssistantMsg) {
          lastResponse = lastAssistantMsg;
          logger.debug('MessageProcessor', `🤖 Nova resposta assistant encontrada com ${lastAssistantMsg.tool_calls?.length || 0} tool calls`);
        } else {
          logger.debug('MessageProcessor', '❌ Nenhuma mensagem assistant encontrada - encerrando ciclo');
          break;
        }
        
        // Verificar condições de parada
        if (this._shouldStopToolCycle(lastResponse)) {
          logger.debug('MessageProcessor', '🛑 Condição de parada atingida');
          break;
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
    if (lastResponse.tool_calls && lastResponse.tool_calls.some(tc => tc.function.name === 'send_message')) {
      logger.debug('MessageProcessor', 'Send_message detectado - encerrando ciclo de ferramentas');
      return true;
    }
    
    if (lastResponse.tool_calls && lastResponse.tool_calls.some(tc => tc.function.name !== 'send_message')) {
      logger.debug('MessageProcessor', 'Ferramentas não-send_message executadas - encerrando ciclo para evitar duplicatas');
      return true;
    }
    
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
