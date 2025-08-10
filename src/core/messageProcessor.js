import LtmService from '../services/LtmService.js';
import { normalizeAiResponse } from '../utils/aiResponseUtils.js';
import logger from '../utils/logger.js';

// Core modules
import { sanitizeMessagesForChat } from './processors/messageSanitizer.js';
import STMManager from './memory/stmManager.js';
import ImageProcessor from './processors/imageProcessor.js';
import DynamicPromptBuilder from './prompt/dynamicPromptBuilder.js';
import ToolExecutor from './tools/toolExecutor.js';
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
    messages = await STMManager.manageSTM(messages, userContent, userId, data.from);
    logger.timing('MessageProcessor', 'Gerenciamento STM concluído');

    // Construir prompt dinâmico
    stepTime = Date.now();
    logger.debug('MessageProcessor', 'Construindo prompt dinâmico...');
    const dynamicPrompt = DynamicPromptBuilder.buildDynamicPrompt(userProfile, ltmContext, imageAnalysisResult);
    logger.timing('MessageProcessor', 'Prompt dinâmico construído');

    // Executar análises de IA
    stepTime = Date.now();
    simulateTyping(data.from, true);
    const { currentSentiment, inferredStyle } = await AIAnalysisHandler.performAIAnalysis(userContent, userId, userProfile);
    logger.timing('MessageProcessor', 'Análises de IA concluídas');

    // Preparar mensagens para chat
    const chatMessages = [dynamicPrompt, ...messages, { role: 'user', content: userContent }];
    const sanitizedChatMessages = sanitizeMessagesForChat(chatMessages);
    
    // Gerar resposta principal da IA
    stepTime = Date.now();
    logger.debug('MessageProcessor', 'Gerando resposta principal...');
    let response = await chatAi(sanitizedChatMessages);
    response = normalizeAiResponse(response);
    logger.timing('MessageProcessor', 'Resposta principal gerada');

    // Atualizar mensagens com interação atual
    messages.push({ role: 'user', content: userContent });
    messages.push(response.message);

    // Executar ciclo de ferramentas
    await this._executeToolCycle(messages, response, tools, data, userContent, imageAnalysisResult);

    // Atualizações finais
    stepTime = Date.now();
    logger.debug('MessageProcessor', 'Realizando atualizações finais...');
    
    await updateUserContext(userId, { messages });

    // Atualizações assíncronas em background
    LtmService.summarizeAndStore(userId, messages.map((m) => m.content).join('\n'))
        .catch(err => logger.error('MessageProcessor', `Erro ao armazenar na LTM em background: ${err}`));

    updateUserProfileSummary(userId, messages)
      .catch(err => logger.error('MessageProcessor', `Erro ao atualizar resumo do perfil em background: ${err}`));
      
    logger.timing('MessageProcessor', 'Atualizações concluídas');
    
    logger.end('MessageProcessor', `Processamento da mensagem concluído - TEMPO TOTAL: ${Date.now() - startTime}ms`);
  }

  /**
   * Executa ciclo de ferramentas com limite de tentativas
   * @private
   */
  static async _executeToolCycle(messages, response, tools, data, userContent, imageAnalysisResult) {
    let toolCycleCount = 0;
    const MAX_TOOL_CYCLES = 3;
    let lastResponse = response.message;
    
    while (toolCycleCount < MAX_TOOL_CYCLES) {
      if ((lastResponse.tool_calls && lastResponse.tool_calls.length > 0) || lastResponse.function_call) {
        logger.debug('MessageProcessor', 'Executando ferramentas...');
        
        const updatedMessages = await ToolExecutor.executeTools(
          messages, 
          { message: lastResponse }, 
          tools, 
          data.from, 
          data.id, 
          userContent, 
          data, 
          imageAnalysisResult
        );
        
        // Atualizar referência das mensagens
        messages.length = 0;
        messages.push(...updatedMessages);
        
        // Buscar a última mensagem assistant gerada
        const lastAssistantMsg = messages.filter(m => m.role === 'assistant').slice(-1)[0];
        if (lastAssistantMsg) {
          lastResponse = lastAssistantMsg;
        } else {
          break;
        }
        
        // Verificar condições de parada
        if (this._shouldStopToolCycle(lastResponse)) {
          break;
        }
      } else if (lastResponse.tool_calls && lastResponse.tool_calls.length > 0) {
        // Fallback: garantir que toda tool_call tenha uma mensagem tool
        this._addFallbackToolResponses(messages, lastResponse);
        break;
      } else {
        // Se não há tool_calls, encerra ciclo
        break;
      }
      toolCycleCount++;
    }

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
    
    if (!hasSendMessage) {
      logger.warn('MessageProcessor', 'Fallback final: Solicitando à LLM uma mensagem amigável de erro.');
      
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
        fallbackResponse = await chatAi(fallbackPrompt);
      } catch (err) {
        fallbackResponse = { message: { content: 'Desculpe, não consegui atender ao seu pedido neste momento.' } };
      }
      
      const fallbackContent = fallbackResponse?.message?.content || 'Desculpe, não consegui atender ao seu pedido neste momento.';
      
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
      logger.info('MessageProcessor', 'Fallback final: Mensagem de erro amigável enviada ao usuário.');
    }
  }
}

// Exportar função compatível com a API existente
export default async function processMessage(message) {
  return MessageProcessor.processMessage(message);
}
